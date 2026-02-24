-- name: CreateUser :one
INSERT INTO users (
  id, username, password_hash, full_name, role
) VALUES (
  $1, $2, $3, $4, $5
)
RETURNING *;

-- name: GetUserByUsername :one
SELECT * FROM users
WHERE username = $1 LIMIT 1;

-- name: GetUser :one
SELECT * FROM users
WHERE id = $1 LIMIT 1;
