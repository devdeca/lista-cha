#!/bin/sh
set -e

node /app/backend/index.js &

exec nginx -g 'daemon off;'
