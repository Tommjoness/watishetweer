"use strict";

const BASIS = "https://anonymous.api.dataplatform.knmi.nl/wms/adaguc-server";

(async () => {
  const u = new URL(BASIS);
  u.searchParams.set("DATASET", "radar_forecast_2.0");
  u.searchParams.set("SERVICE", "WMS");
  u.searchParams.set("REQUEST", "GetMetaData");
  u.searchParams.set("VERSION", "1.1.1");
  u.searchParams.set("LAYER", "precipitation_nowcast");
  u.searchParams.set("FORMAT", "text/plain");

  const response = await fetch(u, { headers: { Accept: "text/plain,text/html", "User-Agent": "watishetweer.nl-audit/1.0" } });
  const tekst = await response.text();
  const regels = tekst.split(/\r?\n/).filter(regel =>
    /forecast|precip|units|fill|missing|nodata|scale|offset|valid|transform|threshold|minimum|maximum/i.test(regel)
  );
  console.log(JSON.stringify({ status: response.status, relevanteRegels: regels.slice(0, 120) }, null, 2));
})().catch(err => {
  console.error("KNMI live-diagnose kon niet worden uitgevoerd:", err && err.stack || err);
  process.exitCode = 1;
});