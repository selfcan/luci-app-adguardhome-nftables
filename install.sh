#!/bin/sh
set -e

REPO="w9315273/luci-app-adguardhome"
API="https://api.github.com/repos/${REPO}/releases/latest"

URL="$(
  uclient-fetch -qO- "$API" \
  | jsonfilter -e '@.assets[*].browser_download_url' \
  | grep -m1 '\.apk$'
)"

[ -n "$URL" ] || { echo "ERR: no .apk found in latest release assets"; exit 1; }

uclient-fetch -O /tmp/agh.apk "$URL"
apk add --allow-untrusted /tmp/agh.apk
rm -f /tmp/agh.apk