package middleware

import (
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"log/slog"
	"net/http"
	"sync"
	"time"

	"github.com/PUSBANGKOMSDACKPS-Bag-Keuangan/internal/services"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/labstack/echo/v4"
)

const UserClaimsKey = "user_claims"

type revocationCacheEntry struct {
	revoked    bool
	validUntil time.Time
}

type revocationCache struct {
	mu     sync.RWMutex
	items  map[string]revocationCacheEntry
	negTTL time.Duration
}

func newRevocationCache(negTTL time.Duration) *revocationCache {
	if negTTL <= 0 {
		negTTL = 5 * time.Second
	}
	return &revocationCache{items: make(map[string]revocationCacheEntry), negTTL: negTTL}
}

func (c *revocationCache) get(tokenHash string, now time.Time) (revoked bool, ok bool) {
	c.mu.RLock()
	e, exists := c.items[tokenHash]
	c.mu.RUnlock()
	if !exists {
		return false, false
	}
	if !now.Before(e.validUntil) {
		c.mu.Lock()
		delete(c.items, tokenHash)
		c.mu.Unlock()
		return false, false
	}
	return e.revoked, true
}

func (c *revocationCache) setNotRevoked(tokenHash string, now time.Time) {
	c.mu.Lock()
	c.items[tokenHash] = revocationCacheEntry{revoked: false, validUntil: now.Add(c.negTTL)}
	c.mu.Unlock()
}

func (c *revocationCache) setRevoked(tokenHash string, expiresAt time.Time) {
	if expiresAt.IsZero() {
		expiresAt = time.Now().Add(30 * time.Second)
	}
	c.mu.Lock()
	c.items[tokenHash] = revocationCacheEntry{revoked: true, validUntil: expiresAt}
	c.mu.Unlock()
}

func RequireAuth(authService *services.AuthService, pool *pgxpool.Pool) echo.MiddlewareFunc {
	revCache := newRevocationCache(5 * time.Second)

	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			switch c.Request().URL.Path {
			case "/healthz", "/readyz", "/api/v1/healthz", "/api/v1/readyz":
				return next(c)
			}

			cookie, err := c.Cookie("session")
			if err != nil {
				return c.JSON(http.StatusUnauthorized, map[string]string{"message": "Unauthorized: no session cookie"})
			}

			tokenString := cookie.Value
			if tokenString == "" {
				return c.JSON(http.StatusUnauthorized, map[string]string{"message": "Unauthorized: empty token"})
			}

			claims, err := authService.ValidateToken(tokenString)
			if err != nil {
				return c.JSON(http.StatusUnauthorized, map[string]string{"message": "Unauthorized: invalid token"})
			}

			if pool != nil {
				h := sha256.Sum256([]byte(tokenString))
				tokenHashHex := hex.EncodeToString(h[:])
				now := time.Now()

				if revoked, ok := revCache.get(tokenHashHex, now); ok {
					if revoked {
						return c.JSON(http.StatusUnauthorized, map[string]string{"message": "Unauthorized: token revoked"})
					}
					c.Set(UserClaimsKey, claims)
					return next(c)
				}

				var expiresAt time.Time
				err := pool.QueryRow(
					c.Request().Context(),
					"SELECT expires_at FROM revoked_tokens WHERE token_sha256 = $1 AND expires_at > now()",
					tokenHashHex,
				).Scan(&expiresAt)
				if err == nil {
					revCache.setRevoked(tokenHashHex, expiresAt)
					return c.JSON(http.StatusUnauthorized, map[string]string{"message": "Unauthorized: token revoked"})
				}
				if !errors.Is(err, pgx.ErrNoRows) {
					slog.Error("token revocation check failed", "error", err)
					return c.JSON(http.StatusServiceUnavailable, map[string]string{"message": "Service unavailable"})
				}

				revCache.setNotRevoked(tokenHashHex, now)
			}

			c.Set(UserClaimsKey, claims)
			return next(c)
		}
	}
}

func RequireRole(roles ...string) echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			val := c.Get(UserClaimsKey)
			claims, ok := val.(*services.Claims)
			if !ok || claims == nil {
				return c.JSON(http.StatusUnauthorized, map[string]string{"message": "Unauthorized"})
			}

			for _, role := range roles {
				if claims.Role == role {
					return next(c)
				}
			}

			return c.JSON(http.StatusForbidden, map[string]string{"message": "Forbidden: insufficient permissions"})
		}
	}
}

func GetClaims(c echo.Context) *services.Claims {
	val := c.Get(UserClaimsKey)
	claims, ok := val.(*services.Claims)
	if !ok {
		return nil
	}
	return claims
}
