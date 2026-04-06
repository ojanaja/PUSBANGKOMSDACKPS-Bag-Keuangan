FROM postgres:16-alpine

# Install rclone for downloading backups from OneDrive
RUN apk add --no-cache rclone tzdata

# Set timezone to Asia/Jakarta (WIB)
ENV TZ="Asia/Jakarta"
