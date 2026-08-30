"use strict";

const KNMI_WMS_BASIS = "https://anonymous.api.dataplatform.knmi.nl/wms/adaguc-server";
const ACTUEEL_DATASET = "nl_rdr_data_rtcor_5m";
const ACTUEEL_LAAG = "precipitation_real_time";
const NOWCAST_DATASET = "radar_forecast_2.0";
const NOWCAST_LAAG = "precipitation_nowcast";
const MAX_OUDERDOM_MS = 10 * 60 * 1000;
const MAX_TOEKOMST_MS = 5 * 60 * 1000;
const NOWCAST_STAP_MS = 5 * 60 * 1000;
const NOWCAST_PUNTEN = 25;
const NOWCAST_METADATA_CACHE_MAX_MS = 10 * 1000;
let nowcastMetadataCaches = new WeakMap();

function leesCoord(v) {
  if (v == null || String(v).trim() === "") return NaN;
  return Number(v);
}

function binnenKnmiDekking(lat, lon) {
  return Number.isFinite(lat) && Number.isFinite(lon)
    && lat >= 48.9 && lat <= 55.97 && lon >= 0 && lon <= 10.86;
}

function puntBasisUrl(dataset, laag, lat, lon) {
  const u = new URL(KNMI_WMS_BASIS);
  u.searchParams.set("DATASET", dataset);
  u.searchParams.set("SERVICE", "WMS");
  u.searchParams.set("REQUEST", "GetPointValue");
  u.searchParams.set("VERSION", "1.1.1");
  u.searchParams.set("SRS", "EPSG:4326");
  u.searchParams.set("QUERY_LAYERS", laag);
  u.searchParams.set("X", Number(lon).toFixed(5));
  u.searchParams.set("Y", Number(lat).toFixed(5));
  u.searchParams.set("INFO_FORMAT", "application/json");
  return u;
}

function actueelPuntUrl(lat, lon) {
  return puntBasisUrl(ACTUEEL_DATASET, ACTUEEL_LAAG, lat, lon).toString();
}

function capabilitiesUrl(dataset) {
  const u = new URL(KNMI_WMS_BASIS);
  u.searchParams.set("DATASET", dataset);
  u.searchParams.set("SERVICE", "WMS");
  u.searchParams.set("VERSION", "1.3.0");
  u.searchParams.set("REQUEST", "GetCapabilities");
  return u.toString();
}

function isoZonderMillis(ms) {
  return new Date(ms).toISOString().replace(/\.000Z$/, "Z");
}

function nowcastPuntUrl(lat, lon, referenceTime, tijd) {
  const refMs = Date.parse(referenceTime);
  if (!Number.isFinite(refMs)) throw new Error("ongeldige KNMI reference_time");
  if (!Number.isFinite(Date.parse(tijd))) throw new Error("ongeldige KNMI nowcasttijd");
  const u = new URL(KNMI_WMS_BASIS);
  u.searchParams.set("DATASET", NOWCAST_DATASET);
  u.searchParams.set("SERVICE", "WCS");
  u.searchParams.set("REQUEST", "GetCoverage");
  u.searchParams.set("VERSION", "1.0.0");
  u.searchParams.set("COVERAGE", NOWCAST_LAAG);
  u.searchParams.set("CRS", "EPSG:4326");
  const y=Number(lat),x=Number(lon),marge=0.0001;
  u.searchParams.set("BBOX", [x-marge,y-marge,x+marge,y+marge].map(v=>v.toFixed(5)).join(","));
  u.searchParams.set("WIDTH", "2");
  u.searchParams.set("HEIGHT", "2");
  u.searchParams.set("FORMAT", "NetCDF3");
  u.searchParams.set("TIME", tijd);
  u.searchParams.set("DIM_forecast_reference_time", referenceTime);
  return u.toString();
}

function intensiteitsEenheid(units) {
  return /^(?:mm\s*\/\s*(?:h|hr|hour)|mm\s*h\^-?1)$/i.test(String(units || "").trim());
}

function isVers(tijd, nuMs = Date.now()) {
  const ms = Date.parse(tijd);
  if (!Number.isFinite(ms)) return false;
  const leeftijd = nuMs - ms;
  return leeftijd >= -MAX_TOEKOMST_MS && leeftijd <= MAX_OUDERDOM_MS;
}

function normaliseerPuntAntwoord(payload) {
  if (!Array.isArray(payload) || !payload.length) return null;
  const item = payload.find(x => x && x.data && typeof x.data === "object") || payload[0];
  if (!item || !item.data || typeof item.data !== "object" || !intensiteitsEenheid(item.units)) return null;

  const vlak = [];
  function verzamel(obj, pad) {
    for (const [sleutel, waarde] of Object.entries(obj || {})) {
      const nieuwPad = pad.concat(sleutel);
      if (waarde && typeof waarde === "object" && !Array.isArray(waarde)) verzamel(waarde, nieuwPad);
      else {
        const n = Number(waarde);
        if (Number.isFinite(n) && n >= 0) vlak.push({ sleutel, pad: nieuwPad, waarde: n });
      }
    }
  }
  verzamel(item.data, []);
  if (!vlak.length) return null;

  const metTijd = vlak.filter(x => Number.isFinite(Date.parse(x.sleutel)));
  const laatste = (metTijd.length ? metTijd : vlak).sort((a, b) => {
    const ta = Date.parse(a.sleutel), tb = Date.parse(b.sleutel);
    if (Number.isFinite(ta) && Number.isFinite(tb)) return ta - tb;
    return 0;
  }).at(-1);
  const tijd = Number.isFinite(Date.parse(laatste.sleutel)) ? laatste.sleutel : null;
  return {
    waarde: laatste.waarde,
    tijd,
    units: item.units || null,
    naam: item.name || item.standard_name || null,
    punt: item.point || null
  };
}

function referenceTimeUitCapabilities(xml) {
  const tekst = String(xml || "");
  const tags = [...tekst.matchAll(/<(?:Dimension|Extent)\b([^>]*)>/gi)];
  for (const m of tags) {
    const attrs = m[1] || "";
    if (!/\bname=["'](?:forecast_)?reference_time["']/i.test(attrs)) continue;
    const d = /\bdefault=["']([^"']+)["']/i.exec(attrs);
    if (d && Number.isFinite(Date.parse(d[1]))) return d[1];
  }
  return null;
}

const NC_TYPES={1:{bytes:1,read:(b,o)=>b.readInt8(o)},2:{bytes:1,read:(b,o)=>b[o]},3:{bytes:2,read:(b,o)=>b.readInt16BE(o)},4:{bytes:4,read:(b,o)=>b.readInt32BE(o)},5:{bytes:4,read:(b,o)=>b.readFloatBE(o)},6:{bytes:8,read:(b,o)=>b.readDoubleBE(o)}};
function parseNetcdf3(buffer){
  const b=Buffer.isBuffer(buffer)?buffer:Buffer.from(buffer||[]);
  if(b.length<12||b.toString("ascii",0,3)!=="CDF"||![1,2].includes(b[3]))throw new Error("KNMI WCS gaf geen NetCDF3");
  const cdf2=b[3]===2;let o=4;
  const u32=()=>{if(o+4>b.length)throw new Error("afgebroken NetCDF-header");const v=b.readUInt32BE(o);o+=4;return v;};
  const naam=()=>{const n=u32();if(o+n>b.length)throw new Error("afgebroken NetCDF-naam");const s=b.toString("utf8",o,o+n);o+=n;o+=(4-(n%4))%4;return s;};
  const waarden=(type,n)=>{const info=NC_TYPES[type];if(!info)throw new Error("onbekend NetCDF-type "+type);const uit=[];for(let i=0;i<n;i++){if(o+info.bytes>b.length)throw new Error("afgebroken NetCDF-waarde");uit.push(info.read(b,o));o+=info.bytes;}o+=(4-((n*info.bytes)%4))%4;return uit;};
  const lijstStart=verwacht=>{const tag=u32(),n=u32();if(tag===0&&n===0)return 0;if(tag!==verwacht)throw new Error("ongeldige NetCDF-lijst");return n;};
  u32();
  const dims=[];for(let i=0,n=lijstStart(10);i<n;i++)dims.push({naam:naam(),lengte:u32()});
  function attributen(){const uit={};for(let i=0,n=lijstStart(12);i<n;i++){const k=naam(),type=u32(),aantal=u32();uit[k]=waarden(type,aantal);}return uit;}
  attributen();
  const vars=[];
  for(let i=0,n=lijstStart(11);i<n;i++){
    const k=naam(),nd=u32(),dimids=[];for(let d=0;d<nd;d++)dimids.push(u32());
    const attrs=attributen(),type=u32(),vsize=u32();
    let begin;if(cdf2){if(o+8>b.length)throw new Error("afgebroken NetCDF-offset");begin=Number(b.readBigUInt64BE(o));o+=8;}else begin=u32();
    vars.push({naam:k,dimids,attrs,type,vsize,begin});
  }
  return {buffer:b,dims,vars};
}
function attrGetal(attrs,naam,standaard){const a=attrs&&attrs[naam];return Array.isArray(a)&&Number.isFinite(Number(a[0]))?Number(a[0]):standaard;}
function leesVariabele(nc,v){
  const info=NC_TYPES[v.type];if(!info)throw new Error("onbekend NetCDF-type "+v.type);
  const aantal=Math.max(1,v.dimids.reduce((p,id)=>p*Math.max(1,(nc.dims[id]&&nc.dims[id].lengte)||1),1));
  const uit=[];for(let i=0;i<aantal&&v.begin+(i+1)*info.bytes<=nc.buffer.length;i++)uit.push(info.read(nc.buffer,v.begin+i*info.bytes));return uit;
}
function normaliseerWcsPunt(buffer,tijd){
  const nc=parseNetcdf3(buffer);
  const v=nc.vars.find(x=>x.naam===NOWCAST_LAAG)||nc.vars.find(x=>x.naam==="forecast")||nc.vars.find(x=>/precip/i.test(x.naam));
  if(!v)throw new Error("KNMI WCS mist neerslagvariabele");
  const schaal=attrGetal(v.attrs,"scale_factor",1),offset=attrGetal(v.attrs,"add_offset",0);
  const missen=[attrGetal(v.attrs,"_FillValue",NaN),attrGetal(v.attrs,"missing_value",NaN)].filter(Number.isFinite);
  const geldig=leesVariabele(nc,v).filter(x=>Number.isFinite(x)&&!missen.includes(x)).map(x=>x*schaal+offset).filter(x=>Number.isFinite(x)&&x>=0);
  if(!geldig.length)throw new Error("KNMI WCS gaf geen bruikbare mm/uur-puntwaarde");
  geldig.sort((a,b)=>a-b);const midden=Math.floor(geldig.length/2),waarde=geldig.length%2?geldig[midden]:(geldig[midden-1]+geldig[midden])/2;
  return {tijd,waarde};
}

function nowcastReeksCompleet(punten, referenceTime) {
  const refMs = Date.parse(referenceTime);
  if (!Number.isFinite(refMs) || !Array.isArray(punten) || punten.length !== NOWCAST_PUNTEN) return false;
  return punten.every((punt, index) => Date.parse(punt && punt.tijd) === refMs + index * NOWCAST_STAP_MS);
}

function normaliseerNowcastAntwoord(payload, referenceTime) {
  if (!Array.isArray(payload) || !payload.length) return null;
  const item = payload.find(x => x && x.data && typeof x.data === "object") || payload[0];
  if (!item || !item.data || typeof item.data !== "object" || !intensiteitsEenheid(item.units)) return null;
  const reeks = item.data[referenceTime]
    || Object.values(item.data).find(v => v && typeof v === "object" && !Array.isArray(v));
  if (!reeks || typeof reeks !== "object") return null;

  const punten = Object.entries(reeks)
    .map(([tijd, waarde]) => ({ tijd, waarde: Number(waarde) }))
    .filter(p => Number.isFinite(Date.parse(p.tijd)) && Number.isFinite(p.waarde) && p.waarde >= 0)
    .sort((a, b) => Date.parse(a.tijd) - Date.parse(b.tijd));
  if (!nowcastReeksCompleet(punten, referenceTime)) return null;
  const refMs = Date.parse(referenceTime);
  const horizonMinuten = (Date.parse(punten.at(-1).tijd) - refMs) / 60000;
  if (horizonMinuten !== 120) return null;
  return {
    referenceTime,
    units: item.units || null,
    naam: item.name || item.standard_name || null,
    punt: item.point || null,
    punten,
    horizonMinuten
  };
}

async function fetchTekst(url, fetchImpl, timeoutMs, accept) {
  const r = await fetchImpl(url, {
    headers: { "Accept": accept, "User-Agent": "watishetweer.nl/1.0" },
    signal: AbortSignal.timeout(timeoutMs)
  });
  const tekst = await r.text();
  if (!r.ok) throw new Error("KNMI WMS status " + r.status);
  return tekst;
}

async function fetchBuffer(url,fetchImpl,timeoutMs,accept){
  const r=await fetchImpl(url,{headers:{Accept:accept,"User-Agent":"watishetweer.nl/1.0"},signal:AbortSignal.timeout(timeoutMs)});
  if(!r.ok)throw new Error("KNMI WCS status "+r.status);
  const type=String(r.headers&&r.headers.get?r.headers.get("content-type")||"":"");
  if(type&&!/(?:netcdf|octet-stream)/i.test(type))throw new Error("KNMI WCS gaf onverwacht content-type");
  return Buffer.from(await r.arrayBuffer());
}

function metadataMaxAgeMs(headers) {
  const waarde = String(headers && typeof headers.get === "function" ? headers.get("cache-control") || "" : "");
  const match = /(?:^|,)\s*max-age=(\d+)/i.exec(waarde);
  const seconden = match ? Number(match[1]) : 0;
  if (!Number.isFinite(seconden) || seconden <= 0) return 0;
  return Math.min(seconden * 1000, NOWCAST_METADATA_CACHE_MAX_MS);
}

function metadataCacheVoor(fetchImpl) {
  let cache = nowcastMetadataCaches.get(fetchImpl);
  if (!cache) {
    cache = { waarde: null, vervaltOp: 0, belofte: null };
    nowcastMetadataCaches.set(fetchImpl, cache);
  }
  return cache;
}

async function laadNowcastMetadata(fetchImpl) {
  const r = await fetchImpl(capabilitiesUrl(NOWCAST_DATASET), {
    headers: { "Accept": "text/xml", "User-Agent": "watishetweer.nl/1.0" },
    signal: AbortSignal.timeout(6500)
  });
  const xml = await r.text();
  if (!r.ok) throw new Error("KNMI WMS status " + r.status);
  if (!xml.includes("<Name>" + NOWCAST_LAAG + "</Name>")) throw new Error("KNMI nowcastlaag ontbreekt");
  const referenceTime = referenceTimeUitCapabilities(xml);
  if (!referenceTime) throw new Error("KNMI nowcast reference_time ontbreekt");
  return { waarde: { referenceTime }, ttlMs: metadataMaxAgeMs(r.headers) };
}

async function haalNowcastMetadata(fetchImpl = fetch, nuMs = Date.now(), cacheNuMs = Date.now()) {
  const cache = metadataCacheVoor(fetchImpl);
  if (cache.waarde && cache.vervaltOp > cacheNuMs) {
    if (!isVers(cache.waarde.referenceTime, nuMs)) throw new Error("KNMI nowcast is verouderd");
    return cache.waarde;
  }

  if (!cache.belofte) {
    const gestartOp = cacheNuMs;
    const belofte = (async () => {
      const geladen = await laadNowcastMetadata(fetchImpl);
      if (geladen.ttlMs > 0) {
        cache.waarde = geladen.waarde;
        cache.vervaltOp = gestartOp + geladen.ttlMs;
      } else {
        cache.waarde = null;
        cache.vervaltOp = 0;
      }
      return geladen.waarde;
    })();
    cache.belofte = belofte;
    belofte.finally(() => {
      if (cache.belofte === belofte) cache.belofte = null;
    }).catch(() => {});
  }

  const waarde = await cache.belofte;
  if (!isVers(waarde.referenceTime, nuMs)) throw new Error("KNMI nowcast is verouderd");
  return waarde;
}

async function haalActueelPunt(lat, lon, fetchImpl = fetch, nuMs = Date.now()) {
  const tekst = await fetchTekst(actueelPuntUrl(lat, lon), fetchImpl, 5500, "application/json");
  let payload;
  try { payload = JSON.parse(tekst); }
  catch { throw new Error("KNMI actuele WMS gaf geen JSON"); }
  const punt = normaliseerPuntAntwoord(payload);
  if (!punt) throw new Error("KNMI actuele WMS gaf geen bruikbare mm/uur-puntwaarde");
  if (!punt.tijd || !isVers(punt.tijd, nuMs)) throw new Error("KNMI actuele puntwaarde is verouderd");
  return { ...punt, bron: "KNMI RTCOR 5m", dataset: ACTUEEL_DATASET, laag: ACTUEEL_LAAG };
}

async function haalNowcastPunt(lat, lon, fetchImpl = fetch, nuMs = Date.now()) {
  const { referenceTime } = await haalNowcastMetadata(fetchImpl, nuMs);

  const refMs=Date.parse(referenceTime),tijden=Array.from({length:NOWCAST_PUNTEN},(_,i)=>isoZonderMillis(refMs+i*NOWCAST_STAP_MS));
  const punten=new Array(tijden.length);let volgende=0;
  async function werker(){while(volgende<tijden.length){const i=volgende++,tijd=tijden[i];const buffer=await fetchBuffer(nowcastPuntUrl(lat,lon,referenceTime,tijd),fetchImpl,5000,"application/netcdf");punten[i]=normaliseerWcsPunt(buffer,tijd);}}
  await Promise.all(Array.from({length:5},werker));
  if(!nowcastReeksCompleet(punten,referenceTime))throw new Error("KNMI nowcast gaf geen volledige aaneengesloten 5-minutenreeks");
  return {referenceTime,units:"mm/hr",naam:NOWCAST_LAAG,punt:{SRS:"EPSG:4326",coords:Number(lon).toFixed(5)+","+Number(lat).toFixed(5)},punten,horizonMinuten:120,bron:"KNMI radar-nowcast",dataset:NOWCAST_DATASET,laag:NOWCAST_LAAG};
}

async function handler(req, res) {
  res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=60");
  const q = req.query || {};
  const lat = leesCoord(q.lat), lon = leesCoord(q.lon);
  if (!binnenKnmiDekking(lat, lon)) {
    return res.status(200).json({ beschikbaar: false, reden: "buiten KNMI-dekking" });
  }

  const [actueelResultaat, nowcastResultaat] = await Promise.allSettled([
    haalActueelPunt(lat, lon),
    haalNowcastPunt(lat, lon)
  ]);
  const actueel = actueelResultaat.status === "fulfilled" ? actueelResultaat.value : null;
  const nowcast = nowcastResultaat.status === "fulfilled" ? nowcastResultaat.value : null;
  if (!actueel && !nowcast) {
    const redenen = [actueelResultaat, nowcastResultaat]
      .filter(x => x.status === "rejected")
      .map(x => String((x.reason && x.reason.message) || x.reason))
      .filter(Boolean);
    return res.status(200).json({ beschikbaar: false, reden: redenen.join("; ") || "KNMI-neerslag niet beschikbaar" });
  }
  return res.status(200).json({
    beschikbaar: true,
    bron: "KNMI",
    actueel,
    nowcast,
    opgehaaldOp: new Date().toISOString()
  });
}

module.exports = handler;
module.exports._intern = {
  KNMI_WMS_BASIS,
  ACTUEEL_DATASET,
  ACTUEEL_LAAG,
  NOWCAST_DATASET,
  NOWCAST_LAAG,
  MAX_OUDERDOM_MS,
  NOWCAST_STAP_MS,
  NOWCAST_PUNTEN,
  NOWCAST_METADATA_CACHE_MAX_MS,
  leesCoord,
  binnenKnmiDekking,
  actueelPuntUrl,
  capabilitiesUrl,
  nowcastPuntUrl,
  intensiteitsEenheid,
  isVers,
  normaliseerPuntAntwoord,
  referenceTimeUitCapabilities,
  parseNetcdf3,
  normaliseerWcsPunt,
  nowcastReeksCompleet,
  normaliseerNowcastAntwoord,
  metadataMaxAgeMs,
  haalNowcastMetadata,
  haalActueelPunt,
  haalNowcastPunt
};