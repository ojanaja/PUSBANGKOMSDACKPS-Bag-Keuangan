-- name: CreateActivityLog :one
INSERT INTO activity_logs (
    id, user_id, action, target_type, target_id, details, ip_address, user_agent
) VALUES (
    $1, $2, $3, $4, $5, $6, $7, $8
)
RETURNING *;

-- name: ListActivityLogs :many
SELECT 
    al.*,
    u.full_name as user_full_name,
    u.username as user_username
FROM activity_logs al
JOIN users u ON al.user_id = u.id
ORDER BY al.created_at DESC
LIMIT $1 OFFSET $2;

-- name: CountActivityLogs :one
SELECT COUNT(*) FROM activity_logs;

-- name: DeleteActivityLogsBefore :execrows
DELETE FROM activity_logs
WHERE created_at < $1;
