#!/bin/sh
set -e

REPO="w9315273/luci-app-adguardhome"
API="https://api.github.com/repos/${REPO}/releases/latest"

URL="$(
  uclient-fetch -qO- "$API" \
  | jsonfilter -e '@.assets[@.name~="\\.apk$"].browser_download_url' \
  | head -n1
)"

[ -n "$URL" ] || { echo "ERR: failed to find .apk asset in latest release"; exit 1; }

uclient-fetch -O /tmp/agh.apk "$URL"
apk add --allow-untrusted /tmp/agh.apk
rm -f /tmp/agh.apk