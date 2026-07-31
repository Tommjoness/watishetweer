// Bouwt een volledige nagebootste API-respons, zodat elk scenario dezelfde vorm heeft.
function bouw(o){
  o=o||{};
  // De app vraagt 24 uur historie op; het uurblok begint daarom een dag eerder dan het dagblok.
  const dagen=7, uur=[],T=[],AP=[],RH=[],DP=[],PP=[],PR=[],WC=[],CC=[],WS=[],WD=[],WG=[],VIS=[],UV=[],PM=[],ISD=[];
  for(let d=-1;d<dagen;d++) for(let u=0;u<24;u++){
    const dag="2026-07-"+String(22+d).padStart(2,"0");
    uur.push(dag+"T"+String(u).padStart(2,"0")+":00");
    const t=o.temp?o.temp(u,d):+(16+4*Math.sin((u-4)/24*2*Math.PI)).toFixed(1);
    T.push(t); AP.push(t-1); RH.push(o.rh??75); DP.push(+(t-(o.spreiding??5)).toFixed(1));
    PP.push(o.pp?o.pp(u,d):5); PR.push(o.pr?o.pr(u,d):0);
    WC.push(o.wc?o.wc(u,d):3); CC.push(o.cc?o.cc(u,d):40);
    WS.push(o.ws??14); WD.push(315); WG.push(o.wg?o.wg(u,d):26);
    VIS.push(o.zicht===undefined?20000:o.zicht); UV.push(Math.max(0,+(4.5*Math.sin((u-6)/12*Math.PI)).toFixed(1)));
    PM.push(1020); ISD.push(o.poolzon?1:(u>=6&&u<21?1:0));
  }
  const dt=[],sr=[],ss=[],wcm=[],tmax=[],tmin=[],ppm=[],psum=[],uvm=[],wsm=[],wgm=[],wdm=[];
  for(let d=0;d<dagen;d++){
    const dag="2026-07-"+String(22+d).padStart(2,"0");
    dt.push(dag);
    sr.push(o.poolzon?null:dag+"T05:44"); ss.push(o.poolzon?null:dag+"T21:46");
    wcm.push(61); tmax.push(20); tmin.push(14); ppm.push(40); psum.push(o.som===undefined?0.8:o.som);
    uvm.push(4.5); wsm.push(20); wgm.push(30); wdm.push(315);
  }
  const hourly={time:uur,temperature_2m:T,apparent_temperature:AP,relative_humidity_2m:RH,dew_point_2m:DP,
    precipitation_probability:PP,precipitation:PR,weather_code:WC,cloud_cover:CC,wind_speed_10m:WS,
    wind_direction_10m:WD,wind_gusts_10m:WG,uv_index:UV,pressure_msl:PM,is_day:ISD};
  if(o.zicht!==null) hourly.visibility=VIS;
  // Het huidige weer hoort bij hetzelfde moment als de uurreeks, anders kan de app
  // in de test niets tegenstrijdigs opleveren en toetsen we een situatie die
  // in het echt nooit voorkomt. 14:00 op de eerste hele dag is index 24+14.
  const NU=24+14;
  const d={timezone:"Europe/Amsterdam", utc_offset_seconds:7200,
    current:{time:"2026-07-22T14:00",
      temperature_2m:o.tempNu===undefined?T[NU]:o.tempNu,
      apparent_temperature:(o.tempNu===undefined?T[NU]:o.tempNu)-1,
      relative_humidity_2m:o.rh??RH[NU],
      is_day:o.nacht?0:ISD[NU],
      precipitation:o.nu===undefined?PR[NU]:o.nu,
      weather_code:o.wcNu===undefined?WC[NU]:o.wcNu,
      cloud_cover:o.ccNu===undefined?CC[NU]:o.ccNu,
      pressure_msl:PM[NU],
      wind_speed_10m:o.wsNu===undefined?WS[NU]:o.wsNu,
      wind_direction_10m:WD[NU],
      wind_gusts_10m:WG[NU]},
    hourly:hourly,
    daily:{time:dt,weather_code:wcm,temperature_2m_max:tmax,temperature_2m_min:tmin,sunrise:sr,sunset:ss,
      precipitation_probability_max:ppm,precipitation_sum:psum,uv_index_max:uvm,
      wind_speed_10m_max:wsm,wind_gusts_10m_max:wgm,wind_direction_10m_dominant:wdm}};
  if(!o.geenKwartier) d.minutely_15={time:["2026-07-22T14:00","2026-07-22T14:15"],precipitation:[0,0]};
  return d;
}
module.exports={bouw};
