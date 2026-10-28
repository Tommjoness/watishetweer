#!/bin/bash
# Gebruik: meet.sh <uitvoer.csv> <rondes> <pauze-sec> <label-vantage>
OUT=$1; N=${2:-30}; PAUZE=${3:-1}; VANT=${4:-sandbox}
echo "ts,vantage,doel,code,ttfb,totaal,connect,tls,bytes,cf_ray,cf_cache,age,server_timing" > $OUT
doelen=(
"zone-/|https://watishetweer.nl/"
"zone-/weer/|https://watishetweer.nl/weer/"
"zone-robots|https://watishetweer.nl/robots.txt"
"zone-js-hash|https://watishetweer.nl/app-b862a5c5fb3f.min.js"
"zone-js-miss|https://watishetweer.nl/app-b862a5c5fb3f.min.js?x=@R"
"zone-edge-trace|https://watishetweer.nl/cdn-cgi/trace"
"zone-api-fn|https://watishetweer.nl/api/waarschuwingen?lat=52.37&lon=4.9&land=NL"
"pagesdev-/|https://watishetweer.pages.dev/"
"www-/|https://www.watishetweer.nl/"
)
for r in $(seq 1 $N); do
  for d in "${doelen[@]}"; do
    naam=${d%%|*}; url=${d#*|}; url=${url//@R/$RANDOM$RANDOM}
    line=$(curl -sS -m 45 -o /dev/null -D /tmp/h.$$ -w "%{http_code},%{time_starttransfer},%{time_total},%{time_connect},%{time_appconnect},%{size_download}" "$url" 2>/dev/null || echo "ERR,45,45,0,0,0")
    ray=$(grep -i '^cf-ray' /tmp/h.$$ 2>/dev/null | tr -d '\r' | awk '{print $2}')
    cc=$(grep -i '^cf-cache-status' /tmp/h.$$ 2>/dev/null | tr -d '\r' | awk '{print $2}')
    age=$(grep -i '^age:' /tmp/h.$$ 2>/dev/null | tr -d '\r' | awk '{print $2}')
    st=$(grep -i '^server-timing' /tmp/h.$$ 2>/dev/null | tr -d '\r' | cut -d' ' -f2- | tr ',' ';')
    echo "$(date -u +%H:%M:%S),$VANT,$naam,$line,$ray,$cc,$age,\"$st\"" >> $OUT
    rm -f /tmp/h.$$
  done
  sleep $PAUZE
done
echo KLAAR >> $OUT
