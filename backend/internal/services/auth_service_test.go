package services

import (
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

func TestAuthService_PasswordHashing(t *testing.T) {
	svc := NewAuthService("secret")

	hash, err := svc.HashPassword("password-123")
	if err != nil {
		t.Fatalf("HashPassword returned error: %v", err)
	}
	if hash == "password-123" {
		t.Fatalf("expected hashed password to differ from plain text")
	}

	if ok := svc.CheckPasswordHash("password-123", hash); !ok {
		t.Fatalf("CheckPasswordHash should return true for valid password")
	}
	if ok := svc.CheckPasswordHash("wrong-password", hash); ok {
		t.Fatalf("CheckPasswordHash should return false for invalid password")
	}
}

func TestAuthService_GenerateAndValidateToken(t *testing.T) {
	svc := NewAuthService("super-secret")

	token, err := svc.GenerateToken("u-1", "fauzan", "SUPER_ADMIN")
	if err != nil {
		t.Fatalf("GenerateToken returned error: %v", err)
	}

	claims, err := svc.ValidateToken(token)
	if err != nil {
		t.Fatalf("ValidateToken returned error: %v", err)
	}

	if claims.UserID != "u-1" {
		t.Fatalf("unexpected user_id: got=%q", claims.UserID)
	}
	if claims.Username != "fauzan" {
		t.Fatalf("unexpected username: got=%q", claims.Username)
	}
	if claims.Role != "SUPER_ADMIN" {
		t.Fatalf("unexpected role: got=%q", claims.Role)
	}
	if claims.ExpiresAt == nil || !claims.ExpiresAt.After(time.Now()) {
		t.Fatalf("expected token expiration in the future")
	}
}

func TestAuthService_ValidateToken_InvalidAndExpired(t *testing.T) {
	t.Run("invalid token format", func(t *testing.T) {
		svc := NewAuthService("secret")
		if _, err := svc.ValidateToken("not-a-jwt"); err == nil {
			t.Fatalf("expected error for invalid token format")
		}
	})

	t.Run("expired token", func(t *testing.T) {
		svc := NewAuthService("secret")

		expiredClaims := &Claims{
			UserID:   "u-1",
			Username: "user",
			Role:     "PPK",
			RegisteredClaims: jwt.RegisteredClaims{
				ExpiresAt: jwt.NewNumericDate(time.Now().Add(-2 * time.Hour)),
				IssuedAt:  jwt.NewNumericDate(time.Now().Add(-3 * time.Hour)),
			},
		}

		token := jwt.NewWithClaims(jwt.SigningMethodHS256, expiredClaims)
		tokenString, err := token.SignedString([]byte("secret"))
		if err != nil {
			t.Fatalf("failed to sign token: %v", err)
		}

		if _, err := svc.ValidateToken(tokenString); err == nil {
			t.Fatalf("expected error for expired token")
		}
	})
}
