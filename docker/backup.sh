#!/bin/sh
# Dumps the database to /backups, keeps 14 daily and 8 weekly (Sunday) dumps, then mirrors the dumps
# and the file bucket off-site when OFFSITE_BUCKET is set (rclone remotes come from RCLONE_CONFIG_* env).
set -eu

DIR=/backups
TODAY=$(date -u +%Y-%m-%d)
mkdir -p "$DIR"

echo "[backup] dumping database ($TODAY)"
pg_dump --format=custom --no-owner "$DATABASE_URL" > "$DIR/db-$TODAY.dump.tmp"
mv "$DIR/db-$TODAY.dump.tmp" "$DIR/db-$TODAY.dump"
pg_restore --list "$DIR/db-$TODAY.dump" > /dev/null # fails loudly if the dump is unreadable

# Retention: keep everything from the last 14 days, Sundays for 8 weeks, delete the rest.
NOW=$(date -u +%s)
for f in "$DIR"/db-*.dump; do
  d=$(basename "$f" .dump | cut -c4-)
  ts=$(date -u -d "$d" +%s 2>/dev/null) || continue
  age_days=$(( (NOW - ts) / 86400 ))
  weekday=$(date -u -d "$d" +%u)
  if [ "$age_days" -gt 14 ] && { [ "$weekday" != 7 ] || [ "$age_days" -gt 56 ]; }; then
    echo "[backup] removing $f"
    rm -f "$f"
  fi
done

if [ -n "${OFFSITE_BUCKET:-}" ]; then
  echo "[backup] mirroring to offsite:$OFFSITE_BUCKET"
  rclone sync "$DIR" "offsite:$OFFSITE_BUCKET/db"
  rclone sync "local:${S3_BUCKET:-omb}" "offsite:$OFFSITE_BUCKET/files"
else
  echo "[backup] OFFSITE_BUCKET not set: dumps stay on this server only"
fi
echo "[backup] done"
