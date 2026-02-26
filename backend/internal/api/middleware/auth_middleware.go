package middleware

import (
	"net/http"

	"github.com/labstack/echo/v4"
	"github.com/vandal/keuangan-pusbangkom/internal/services"
)

const UserClaimsKey = "user_claims"

func RequireAuth(authService *services.AuthService) echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			cookie, err := c.Cookie("session")
			if err != nil {
				return c.JSON(http.StatusUnauthorized, map[string]string{"message": "Unauthorized: no session cookie"})
			}

			claims, err := authService.ValidateToken(cookie.Value)
			if err != nil {
				return c.JSON(http.StatusUnauthorized, map[string]string{"message": "Unauthorized: invalid token"})
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
