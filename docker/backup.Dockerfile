# Nightly Postgres dump with local retention, mirrored with the file bucket to off-site storage.
FROM alpine:3.22
RUN apk add --no-cache postgresql17-client rclone tzdata
COPY backup.sh /usr/local/bin/backup.sh
RUN chmod 755 /usr/local/bin/backup.sh \
  && echo "0 3 * * * /usr/local/bin/backup.sh >> /proc/1/fd/1 2>&1" > /etc/crontabs/root
CMD ["crond", "-f", "-l", "8"]
