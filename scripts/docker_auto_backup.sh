#!/bin/sh

# ==============================================================================
# SIAP-BPK DOCKERIZED BACKUP TO SHAREPOINT SCRIPT
# ==============================================================================
# Runs inside the dedicated `backup` container

BACKUP_DIR="/tmp/backups"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
DB_HOST="db"
DB_NAME=${POSTGRES_DB:-keuangan_pusbangkom}
DB_USER=${POSTGRES_USER:-keuangan_admin}
PROJECT_NAME="keuangan-pusbangkom"
GDRIVE_REMOTE="gdrive-remote"
GDRIVE_PATH="Backups/Keuangan-Pusbangkom"
export PGPASSWORD=${POSTGRES_PASSWORD}

mkdir -p "$BACKUP_DIR"

echo "[$TIMESTAMP] Starting daily backup process..."

# 1. Database Backup (Using pg_dump over internal network)
DB_BACKUP_FILE="$BACKUP_DIR/${PROJECT_NAME}_db_$TIMESTAMP.sql.gz"
echo "--- Dumping database: $DB_NAME ---"

pg_dump -h $DB_HOST -U $DB_USER $DB_NAME | gzip > "$DB_BACKUP_FILE"

if [ $? -eq 0 ]; then
    echo "✔ Database dump successful: $DB_BACKUP_FILE"
else
    echo "✘ Database dump failed!"
    exit 1
fi

# 2. Files/Storage Backup
STORAGE_BACKUP_FILE="$BACKUP_DIR/${PROJECT_NAME}_storage_$TIMESTAMP.tar.gz"
echo "--- Archiving storage directory ---"
# We assume the volume is mounted at /app/storage
if [ -d "/app/storage" ]; then
    tar -czf "$STORAGE_BACKUP_FILE" -C /app storage 2>/dev/null
    if [ $? -eq 0 ]; then
        echo "✔ Storage archival successful: $STORAGE_BACKUP_FILE"
    else
        echo "✘ Storage archival failed!"
    fi
else
    echo "Storage folder /app/storage not found, skipping..."
fi

# 3. Upload to Google Drive using Rclone
echo "--- Uploading to Google Drive ($GDRIVE_REMOTE) ---"

rclone copy "$DB_BACKUP_FILE" "$GDRIVE_REMOTE:$GDRIVE_PATH" --progress
if [ -f "$STORAGE_BACKUP_FILE" ]; then
    rclone copy "$STORAGE_BACKUP_FILE" "$GDRIVE_REMOTE:$GDRIVE_PATH" --progress
fi

if [ $? -eq 0 ]; then
    echo "✔ Upload to Google Drive successful!"
else
    echo "✘ Upload to Google Drive failed! Please check 'rclone config'."
    exit 1
fi

# 4. Cleanup local temp
rm -rf "$BACKUP_DIR"

echo "[$TIMESTAMP] Backup process completed successfully."
