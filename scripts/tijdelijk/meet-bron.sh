#!/bin/bash
# Alleen-lezen: bereikbaarheid van Open-Meteo en de eigen reserveroute per locatie, vanaf deze runner.
echo "ts,doel,locatie,poging,code,ttfb,totaal"
locs=("Amsterdam|52.3676|4.9041|NL" "Singapore|1.3521|103.8198|SG" "Ushuaia|-54.8019|-68.303|AR" "La Paz|-16.5|-68.15|BO" "Kathmandu|27.7172|85.324|NP" "Longyearbyen|78.2232|15.6469|NO" "Dubai|25.2048|55.2708|AE")
for r in 1 2 3; do
 for l in "${locs[@]}"; do IFS='|' read n la lo land <<< "$l"
  for d in "open-meteo|https://api.open-meteo.com/v1/forecast?latitude=$la&longitude=$lo&current=temperature_2m&hourly=temperature_2m&daily=weather_code&timezone=auto&forecast_days=1" "eigen-reserve|https://watishetweer.nl/api/forecast?lat=$la&lon=$lo&land=$land"; do
   naam=${d%%|*}; url=${d#*|}
   out=$(curl -sS -m 30 -o /dev/null -w "%{http_code},%{time_starttransfer},%{time_total}" "$url" 2>/dev/null || echo "ERR,30,30")
   echo "$(date -u +%H:%M:%S),$naam,$n,$r,$out"
  done; sleep 1
 done
done
