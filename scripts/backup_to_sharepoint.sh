#!/bin/bash

# ==============================================================================
# SIAP-BPK BACKUP TO SHAREPOINT SCRIPT
# ==============================================================================
# This script performs:
# 1. PostgreSQL database dump (using docker exec)
# 2. Archival of storage/cas (Uploaded documents)
# 3. Upload to Microsoft SharePoint via Rclone
# 4. Cleanup of local temporary files
# ==============================================================================

# --- CONFIGURATION ---
BACKUP_DIR="./backups"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
DB_CONTAINER_NAME="keuangan-db"
DB_NAME="keuangan_pusbangkom"
DB_USER="keuangan_admin"
PROJECT_NAME="siap-bpk"
SHAREPOINT_REMOTE="sharepoint-remote" # Name configured in rclone config
SHAREPOINT_PATH="Backups/SIAP-BPK"    # Destination folder in SharePoint

# Create local backup directory if not exists
mkdir -p "$BACKUP_DIR"

echo "[$TIMESTAMP] Starting backup process..."

# 1. Database Backup
DB_BACKUP_FILE="$BACKUP_DIR/${PROJECT_NAME}_db_$TIMESTAMP.sql.gz"
echo "--- Dumping database: $DB_NAME ---"
docker exec $DB_CONTAINER_NAME pg_dump -U $DB_USER $DB_NAME | gzip > "$DB_BACKUP_FILE"

if [ $? -eq 0 ]; then
    echo "✔ Database dump successful: $DB_BACKUP_FILE"
else
    echo "✘ Database dump failed!"
    exit 1
fi

# 2. Files/Storage Backup
STORAGE_BACKUP_FILE="$BACKUP_DIR/${PROJECT_NAME}_storage_$TIMESTAMP.tar.gz"
echo "--- Archiving storage directory ---"
# Note: Adjust path if running from root. We assume running from project root.
tar -czf "$STORAGE_BACKUP_FILE" -C ./backend storage/cas 2>/dev/null

if [ $? -eq 0 ]; then
    echo "✔ Storage archival successful: $STORAGE_BACKUP_FILE"
else
    echo "✘ Storage archival failed!"
    # We continue even if files fail, to keep the DB backup
fi

# 3. Upload to SharePoint using Rclone
# Ensure rclone is installed: sudo apt install rclone
echo "--- Uploading to SharePoint ($SHAREPOINT_REMOTE) ---"

# Upload DB
rclone copy "$DB_BACKUP_FILE" "$SHAREPOINT_REMOTE:$SHAREPOINT_PATH" --progress
# Upload Storage
rclone copy "$STORAGE_BACKUP_FILE" "$SHAREPOINT_REMOTE:$SHAREPOINT_PATH" --progress

if [ $? -eq 0 ]; then
    echo "✔ Upload to SharePoint successful!"
else
    echo "✘ Upload to SharePoint failed! Please check 'rclone config'."
    exit 1
fi

# 4. Retention (Cleanup local files older than 7 days)
echo "--- Cleaning up local temporary files ---"
find "$BACKUP_DIR" -type f -name "*.gz" -mtime +7 -delete

# 5. SharePoint Retention (Optional: keep only last 30 backups on SharePoint)
# rclone delete "$SHAREPOINT_REMOTE:$SHAREPOINT_PATH" --min-age 30d

echo "[$TIMESTAMP] Backup process completed successfully."
