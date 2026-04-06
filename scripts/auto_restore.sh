#!/bin/bash
set -e

# This script runs during standard Postgres docker-entrypoint-initdb.d execution ONLY if the PGDATA dir is empty.
# It uses rclone to find the latest .sql.gz backup in OneDrive and restores it.

echo "========================================="
echo "AUTO RESTORE FROM GOOGLE DRIVE INITIATED"
echo "========================================="

GDRIVE_REMOTE="gdrive-remote"
GDRIVE_PATH="Backups/Keuangan-Pusbangkom"
TEMP_FILE="/tmp/latest_backup.sql.gz"

echo "Checking for rclone configuration..."
if [ ! -f /root/.config/rclone/rclone.conf ]; then
    echo "ERROR: /root/.config/rclone/rclone.conf not found. Skipping auto-restore."
    echo "========================================="
    exit 0
fi

echo "Connecting to Google Drive to find the latest database backup..."
LATEST_BACKUP=$(rclone lsf "$GDRIVE_REMOTE:$GDRIVE_PATH" --include "*_db_*.sql.gz" | sort -r | head -n 1)

if [ -z "$LATEST_BACKUP" ]; then
    echo "No backup found in $GDRIVE_REMOTE:$GDRIVE_PATH. Starting as a fresh database."
    echo "========================================="
    exit 0
fi

echo "Found latest backup: $LATEST_BACKUP"
echo "Downloading $LATEST_BACKUP..."

rclone copy "$GDRIVE_REMOTE:$GDRIVE_PATH/$LATEST_BACKUP" /tmp/

echo "Restoring database from backup..."
# The container provides $POSTGRES_USER and $POSTGRES_DB natively via entrypoint arguments/env
# We use standard psql to pipe the uncompressed SQL
gunzip -c "/tmp/$LATEST_BACKUP" | psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB"

if [ $? -eq 0 ]; then
    echo "✔ Database successfully restored from Google Drive backup."
else
    echo "✘ Database restoration encountered an error!"
fi

echo "Cleaning up temporary files..."
rm -f "/tmp/$LATEST_BACKUP"

echo "========================================="
echo "AUTO RESTORE COMPLETED"
echo "========================================="
