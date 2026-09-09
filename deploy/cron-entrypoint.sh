#!/bin/sh
# Cron service entrypoint: materialize the crontab with the runtime
# CRON_SECRET substituted in, then run busybox crond in the foreground.
set -e

export CRON_SECRET="${CRON_SECRET:?CRON_SECRET is required for the cron service}"

mkdir -p /var/spool/cron/crontabs
sed "s|\$CRON_SECRET|${CRON_SECRET}|g" /opt/cron-jobs > /var/spool/cron/crontabs/root

echo "[cron] crond started with $(grep -c . /opt/cron-jobs) jobs"
exec crond -f -l 8
