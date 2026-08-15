const ENDPOINT="https://anonymous.api.dataplatform.knmi.nl/wms/adaguc-server";
const Vianen={lat:51.9925,lon:5.0917};
const queries=[
  {
    label:"nowcast-current-selector",
    dataset:"radar_forecast_2.0",layer:"precipitation_nowcast",
    time:"2026-08-15T09:00:00Z/2026-08-15T11:00:00Z",
    dims:{reference_time:"current"}
  },
  {
    label:"nowcast-latest-cycle-explicit",
    dataset:"radar_forecast_2.0",layer:"precipitation_nowcast",
    time:"2026-08-15T09:00:00Z/2026-08-15T11:00:00Z",
    dims:{reference_time:"2026-08-15T09:00:00Z"}
  }
];

for(const q of queries){
  const u=new URL(ENDPOINT);
  u.searchParams.set("DATASET",q.dataset);
  u.searchParams.set("SERVICE","WMS");
  u.searchParams.set("REQUEST","GetPointValue");
  u.searchParams.set("VERSION","1.1.1");
  u.searchParams.set("SRS","EPSG:4326");
  u.searchParams.set("QUERY_LAYERS",q.layer);
  u.searchParams.set("X",String(Vianen.lon));
  u.searchParams.set("Y",String(Vianen.lat));
  u.searchParams.set("INFO_FORMAT","application/json");
  u.searchParams.set("time",q.time);
  for(const [naam,waarde] of Object.entries(q.dims||{}))u.searchParams.set("DIM_"+naam,waarde);
  const r=await fetch(u,{headers:{"user-agent":"watishetweer.nl point validation"},signal:AbortSignal.timeout(10000)});
  const text=await r.text();
  let parsed=null;
  try{parsed=JSON.parse(text);}catch{}
  console.log("KNMI_POINT",JSON.stringify({label:q.label,status:r.status,parsed,raw:text.slice(0,6000)}));
  if(!r.ok||!parsed)process.exitCode=1;
}
