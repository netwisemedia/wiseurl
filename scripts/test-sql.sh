#!/bin/sh
set -eu

PGHOST="${WISEURL_TEST_PGHOST:-127.0.0.1}"
PGPORT="${WISEURL_TEST_PGPORT:-55439}"
PGUSER="${WISEURL_TEST_PGUSER:-$(id -un)}"
case "$PGHOST" in
  127.0.0.1|localhost|::1|/*) ;;
  *)
    if [ "${WISEURL_ALLOW_REMOTE_TEST_DB:-}" != "yes" ]; then
      echo "Refusing to recreate WiseURL test databases on non-loopback host ${PGHOST}. Set WISEURL_ALLOW_REMOTE_TEST_DB=yes to override." >&2
      exit 2
    fi
    ;;
esac

run_sql_test() {
  test_name="$1"
  test_file="$2"
  database="wiseurl_test_${test_name}"

  dropdb --if-exists --host "$PGHOST" --port "$PGPORT" --username "$PGUSER" "$database"
  createdb --host "$PGHOST" --port "$PGPORT" --username "$PGUSER" "$database"
  psql --host "$PGHOST" --port "$PGPORT" --username "$PGUSER" --dbname "$database" \
    --set ON_ERROR_STOP=1 \
    --file "$test_file"
}

run_sql_test "source_analytics" "tests/sql/source-analytics.sql"
run_sql_test "overview" "tests/sql/overview.sql"
