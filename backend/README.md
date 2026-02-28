# Backend (API)

## Runtime configuration (env)

These environment variables are read by the API process at startup.

### Database pool (pgxpool)

- `DB_URL` (required)
- `DB_MAX_CONNS` (default: `4`)
- `DB_MIN_CONNS` (default: `0`)
- `DB_MAX_CONN_IDLE_TIME` (default: `5m`)
- `DB_MAX_CONN_LIFETIME` (default: `30m`)
- `DB_HEALTHCHECK_PERIOD` (default: `1m`)

Duration values use Go duration syntax (examples: `30s`, `5m`, `1h`).

Example:

```bash
export DB_MAX_CONNS=4
export DB_MAX_CONN_IDLE_TIME=5m
export DB_MAX_CONN_LIFETIME=30m
export DB_HEALTHCHECK_PERIOD=1m
```

### Audit log retention

If enabled, the API periodically deletes rows from `activity_logs` older than N days.

- `AUDIT_LOG_RETENTION_DAYS` (default: `0` = disabled)
- `AUDIT_LOG_CLEANUP_INTERVAL` (default: `24h`)

Example:

```bash
export AUDIT_LOG_RETENTION_DAYS=30
export AUDIT_LOG_CLEANUP_INTERVAL=24h
```

## Paket list pagination

`GET /api/v1/paket` supports pagination:

- `limit` (default: `50`, max: `200`)
- `offset` (default: `0`)
- `tahun` (optional)

Example:

```bash
curl -s \
  'http://localhost:8080/api/v1/paket?limit=50&offset=0&tahun=2025' \
  -H 'Accept: application/json'
```
