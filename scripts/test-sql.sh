#!/bin/sh
set -eu

PGHOST="${WISEURL_TEST_PGHOST:-127.0.0.1}"
PGPORT="${WISEURL_TEST_PGPORT:-55439}"
PGUSER="${WISEURL_TEST_PGUSER:-$(id -un)}"
PGDATABASE="wiseurl_test"

case "$PGHOST" in
  127.0.0.1|localhost|::1) ;;
  *)
    if [ "${WISEURL_ALLOW_REMOTE_TEST_DB:-}" != "yes" ]; then
      echo "Refusing to recreate ${PGDATABASE} on non-loopback host ${PGHOST}. Set WISEURL_ALLOW_REMOTE_TEST_DB=yes to override." >&2
      exit 2
    fi
    ;;
esac

dropdb --if-exists --host "$PGHOST" --port "$PGPORT" --username "$PGUSER" "$PGDATABASE"
createdb --host "$PGHOST" --port "$PGPORT" --username "$PGUSER" "$PGDATABASE"
psql "postgresql://${PGUSER}@${PGHOST}:${PGPORT}/${PGDATABASE}" \
  --set ON_ERROR_STOP=1 \
  --file tests/sql/source-analytics.sql
