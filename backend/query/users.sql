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

-- name: ListUsers :many
SELECT id, username, full_name, role, created_at, updated_at
FROM users
ORDER BY created_at DESC;

-- name: UpdateUser :one
UPDATE users
SET 
  full_name = sqlc.arg('full_name'),
  role = sqlc.arg('role'),
  password_hash = sqlc.arg('password_hash'),
  updated_at = NOW()
WHERE id = $1
RETURNING *;

-- name: DeleteUser :exec
DELETE FROM users
WHERE id = $1;
