#!/bin/bash
# Alleen-lezen GET's naar de Cloudflare-preview (achter Access). Secrets komen via env en worden nooit geprint.
set +x
OUT=$1; N=${2:-20}; PAUZE=${3:-2}; VANT=${4:-github-runner}
echo "ts,vantage,doel,code,ttfb,totaal,connect,tls,bytes,cf_ray,cf_cache,age,server_timing" > $OUT
H1="CF-Access-Client-Id: $CF_ACCESS_CLIENT_ID"; H2="CF-Access-Client-Secret: $CF_ACCESS_CLIENT_SECRET"
JS=$(curl -sS -m 30 -H "$H1" -H "$H2" "$PREVIEW_ROOT/" | grep -o '/app-[0-9a-f]\{12\}\.min\.js' | head -1)
echo "preview-js-asset: ${JS:-NIET GEVONDEN}"
doelen=("prev-/|$PREVIEW_ROOT/" "prev-/weer/|$PREVIEW_ROOT/weer/" "prev-robots|$PREVIEW_ROOT/robots.txt" "prev-js-hash|$PREVIEW_ROOT$JS" "prev-api-fn|$PREVIEW_ROOT/api/waarschuwingen?lat=52.37&lon=4.9&land=NL" "prod-/|https://watishetweer.nl/" "prod-/weer/|https://watishetweer.nl/weer/")
for r in $(seq 1 $N); do
  for d in "${doelen[@]}"; do
    naam=${d%%|*}; url=${d#*|}
    line=$(curl -sS -m 45 -H "$H1" -H "$H2" -o /dev/null -D /tmp/hp.$$ -w "%{http_code},%{time_starttransfer},%{time_total},%{time_connect},%{time_appconnect},%{size_download}" "$url" 2>/dev/null || echo "ERR,45,45,0,0,0")
    ray=$(grep -i '^cf-ray' /tmp/hp.$$ 2>/dev/null | tr -d '\r' | awk '{print $2}'); cc=$(grep -i '^cf-cache-status' /tmp/hp.$$ 2>/dev/null | tr -d '\r' | awk '{print $2}')
    echo "$(date -u +%H:%M:%S),$VANT,$naam,$line,$ray,$cc,," >> $OUT; rm -f /tmp/hp.$$
  done
  sleep $PAUZE
done
