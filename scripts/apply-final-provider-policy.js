"use strict";
const fs=require("fs");
const path=require("path");
const R=path.join(__dirname,"..");
const lees=p=>fs.readFileSync(path.join(R,p),"utf8");
const schrijf=(p,s)=>fs.writeFileSync(path.join(R,p),s,"utf8");
function exact(src,oud,nieuw,label){
  const n=src.split(oud).length-1;
  if(n===0&&src.includes(nieuw)) return src;
  if(n!==1) throw new Error(label+": verwacht 1 match, gevonden "+n);
  return src.replace(oud,nieuw);
}

let index=lees("index.html");
index=exact(index,
'const S={lat:null,lon:null,label:"",d:null,air:null,i0:0,dag:null,op:0,geo:null,bereik:24,actieveWaarschuwingen:[]};',
'const S={lat:null,lon:null,label:"",land:null,d:null,air:null,i0:0,dag:null,op:0,geo:null,bereik:24,actieveWaarschuwingen:[]};',
"state landcode");
index=exact(index,
'const coordOpslag=v=>Number(Number(v).toFixed(3));',
`const coordOpslag=v=>Number(Number(v).toFixed(3));
const normLand=v=>/^[A-Z]{2}$/.test(String(v||"").toUpperCase())?String(v).toUpperCase():null;
function onthoudLand(v){
  const code=normLand(v); if(!code) return;
  S.land=code;
  const p=ls.get(KEY_P,null);
  if(p&&S.lat!=null&&Math.abs(Number(p.lat)-S.lat)<0.02&&Math.abs(Number(p.lon)-S.lon)<0.02){p.land=code;ls.set(KEY_P,p);}
  const lijst=ls.get(KEY_L,[]);let gewijzigd=false;
  lijst.forEach(p=>{if(S.lat!=null&&Math.abs(Number(p.lat)-S.lat)<0.02&&Math.abs(Number(p.lon)-S.lon)<0.02&&p.land!==code){p.land=code;gewijzigd=true;}});
  if(gewijzigd) ls.set(KEY_L,lijst);
}`,
"land helper");
index=exact(index,
'async function load(lat,lon,label,stil,opslaan){\n  if(opslaan===undefined) opslaan=true;\n  const mijnBeurt=++laadTeller;\n  const nieuweLat=Number(lat),nieuweLon=Number(lon);\n  if(S.lat!==nieuweLat||S.lon!==nieuweLon){',
'async function load(lat,lon,label,stil,opslaan,land){\n  if(opslaan===undefined) opslaan=true;\n  const mijnBeurt=++laadTeller;\n  const nieuweLat=Number(lat),nieuweLon=Number(lon);\n  const plaatsWijzigt=S.lat!==nieuweLat||S.lon!==nieuweLon;\n  if(plaatsWijzigt){',
"load signature");
index=exact(index,
'  const st=document.getElementById("state");\n  if(!stil){st.style.display="block";st.className="msg";st.textContent="Gegevens ophalen.";}\n  S.lat=nieuweLat;S.lon=nieuweLon;S.label=label;',
'  if(land!==undefined) S.land=normLand(land);\n  else if(plaatsWijzigt) S.land=null;\n  const st=document.getElementById("state");\n  if(!stil){st.style.display="block";st.className="msg";st.textContent="Gegevens ophalen.";}\n  S.lat=nieuweLat;S.lon=nieuweLon;S.label=label;',
"load land state");
index=index.replace('ls.set(KEY_P,{lat:coordOpslag(S.lat),lon:coordOpslag(S.lon),label:label});','ls.set(KEY_P,{lat:coordOpslag(S.lat),lon:coordOpslag(S.lon),label:label,land:S.land});');
index=index.replace('ls.set(KEY_D,{d:S.d,air:null,label:label,lat:coordOpslag(S.lat),lon:coordOpslag(S.lon),op:S.op});','ls.set(KEY_D,{d:S.d,air:null,label:label,lat:coordOpslag(S.lat),lon:coordOpslag(S.lon),op:S.op,land:S.land});');
index=index.replace('ls.set(KEY_D,{d:S.d,air:S.air,label:S.label,lat:coordOpslag(S.lat),lon:coordOpslag(S.lon),op:S.op});','ls.set(KEY_D,{d:S.d,air:S.air,label:S.label,lat:coordOpslag(S.lat),lon:coordOpslag(S.lon),op:S.op,land:S.land});');
index=exact(index,
'S.d=oud.d;S.air=oud.air;S.label=oud.label;S.lat=oud.lat;S.lon=oud.lon;S.op=oud.op;',
'S.d=oud.d;S.air=oud.air;S.label=oud.label;S.lat=oud.lat;S.lon=oud.lon;S.op=oud.op;S.land=normLand(oud.land)||S.land;',
"offline land behoud");
index=exact(index,
'    const d=await j("/api/waarschuwingen?lat="+lat+"&lon="+lon,{timeoutMs:7000,signal:waarschuwingController.signal});\n    if(mijnBeurt!==waarschuwingTeller||S.lat!==lat||S.lon!==lon) return;',
'    const landParam=S.land?"&land="+encodeURIComponent(S.land):"";\n    const d=await j("/api/waarschuwingen?lat="+lat+"&lon="+lon+landParam,{timeoutMs:7000,signal:waarschuwingController.signal});\n    if(mijnBeurt!==waarschuwingTeller||S.lat!==lat||S.lon!==lon) return;\n    if(!S.land&&d&&normLand(d.land)){onthoudLand(d.land);urlBij();}',
"warnings land param");
index=exact(index,
'document.getElementById("q").value=p.label;load(p.lat,p.lon,p.label);',
'document.getElementById("q").value=p.label;load(p.lat,p.lon,p.label,false,true,p.land||null);',
"saved place land");
index=exact(index,
'l.push({lat:coordOpslag(S.lat),lon:coordOpslag(S.lon),label:S.label});ls.set(KEY_L,l);chips();',
'l.push({lat:coordOpslag(S.lat),lon:coordOpslag(S.lon),label:S.label,land:S.land});ls.set(KEY_L,l);chips();',
"save place land");
index=exact(index,
'    u.searchParams.set("plaats",S.label);\n    history.replaceState(null,"",u);',
'    u.searchParams.set("plaats",S.label);\n    if(S.land) u.searchParams.set("land",S.land); else u.searchParams.delete("land");\n    history.replaceState(null,"",u);',
"share land");
index=exact(index,
'  q.value=el.dataset.nm;zoekIndex=-1;gpsGeneratie++;load(el.dataset.lat,el.dataset.lon,el.dataset.nm);',
'  q.value=el.dataset.nm;zoekIndex=-1;gpsGeneratie++;load(el.dataset.lat,el.dataset.lon,el.dataset.nm,false,true,el.dataset.land||null);',
"search select land");
index=exact(index,
'data-lat="${r.latitude}" data-lon="${r.longitude}" data-nm="${esc(r.name)}">',
'data-lat="${r.latitude}" data-lon="${r.longitude}" data-nm="${esc(r.name)}" data-land="${esc(normLand(r.country_code)||"")}">',
"search result land");
index=exact(index,
`      let nm=null;
      try{
        const g=await j("/api/plaatsnaam?lat="+la.toFixed(4)+"&lon="+lo.toFixed(4));
        nm=g&&g.naam||null;
      }catch(e){}
      if(!nm){
        try{
          const g=await j("https://api.bigdatacloud.net/data/reverse-geocode-client?latitude="+la+"&longitude="+lo+"&localityLanguage=nl");
          nm=g.city||g.locality||g.principalSubdivision||null;
        }catch(e){}
      }
      if(!nm) nm="Huidige locatie";`,
`      let nm=null,land=null;
      // De gratis BigDataCloud-endpoint is uitsluitend client-side toegestaan.
      // Dit is actuele GPS die de gebruiker zelf zojuist heeft gedeeld, dus precies
      // het toegestane gebruik. De server gebruikt deze endpoint nergens meer.
      try{
        const g=await j("https://api.bigdatacloud.net/data/reverse-geocode-client?latitude="+la+"&longitude="+lo+"&localityLanguage=nl");
        nm=g.city||g.locality||g.principalSubdivision||null;
        land=normLand(g.countryCode);
      }catch(e){}
      if(!nm||!land){
        try{
          const g=await j("/api/plaatsnaam?lat="+la.toFixed(4)+"&lon="+lo.toFixed(4));
          if(!nm) nm=g&&g.naam||null;
          if(!land) land=normLand(g&&g.land);
        }catch(e){}
      }
      if(!nm) nm="Huidige locatie";`,
"GPS provider volgorde");
index=exact(index,
'        S.lat=la;S.lon=lo;\n        ls.set(KEY_P,{lat:coordOpslag(S.lat),lon:coordOpslag(S.lon),label:S.label});',
'        S.lat=la;S.lon=lo;if(land)S.land=land;\n        ls.set(KEY_P,{lat:coordOpslag(S.lat),lon:coordOpslag(S.lon),label:S.label,land:S.land});',
"gps same place land");
index=exact(index,
'      await load(la,lo,nm);',
'      await load(la,lo,nm,false,true,land);',
"gps load land");
index=exact(index,
'    load(la,lo,nm,false,false);',
'    load(la,lo,nm,false,false,normLand(p.get("land")));',
"shared link land");
index=exact(index,
'    load(v.lat,v.lon,v.label);',
'    load(v.lat,v.lon,v.label,false,true,v.land||null);',
"last place land");
schrijf("index.html",index);

// Server-side reverse geocoding: alleen de Nominatim-fallback. BigDataCloud's
// gratis reverse-geocode-client endpoint mag volgens de provider niet server-side.
schrijf("lib/plaatsnaam.cjs",`// Fallback voor reverse-geocoding wanneer de directe client-side BigDataCloud-aanroep mislukt.\n// De publieke Nominatimdienst wordt alleen op expliciete locatiekeuze gebruikt, via deze gecachete serverroute.\n\nasync function viaNominatim(lat, lon) {\n  const url = "https://nominatim.openstreetmap.org/reverse?format=jsonv2"\n    + "&lat=" + lat + "&lon=" + lon + "&zoom=12&accept-language=nl";\n  const r = await fetch(url, {\n    headers: { "User-Agent": "WatIsHetWeer/1.0 (watishetweer.nl; github.com/Tommjoness/weathernow)", "Accept": "application/json" },\n    signal: AbortSignal.timeout(6000)\n  });\n  if (!r.ok) throw new Error("nominatim status " + r.status);\n  const d = await r.json();\n  const a = d.address || {};\n  return {\n    naam: a.city || a.town || a.village || a.municipality || a.suburb || a.county || null,\n    land: a.country_code ? String(a.country_code).toUpperCase() : null\n  };\n}\n\nmodule.exports = async function handler(req, res) {\n  res.setHeader("Cache-Control", "s-maxage=86400, stale-while-revalidate=604800");\n  const q = req.query || {};\n  const leesCoord = v => v == null || String(v).trim() === "" ? NaN : Number(v);\n  const lat = leesCoord(q.lat), lon = leesCoord(q.lon);\n  if (!isFinite(lat) || !isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {\n    return res.status(400).json({ naam: null, land: null, reden: "ongeldige coordinaten" });\n  }\n  try {\n    const uit = await viaNominatim(lat.toFixed(4), lon.toFixed(4));\n    return res.status(200).json({ naam: uit.naam, land: uit.land, bron: "viaNominatim" });\n  } catch (e) {\n    return res.status(200).json({ naam: null, land: null, reden: "viaNominatim: " + String((e && e.message) || e) });\n  }\n};\n`);

let waars=lees("lib/waarschuwingen.cjs");
waars=exact(waars,
`async function landCode(lat, lon) {
  try {
    const r = await haal(
      "https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=" +
      lat + "&longitude=" + lon + "&localityLanguage=en", "application/json");
    const g = await r.json();
    return (g && g.countryCode) ? String(g.countryCode).toUpperCase() : null;
  } catch (e) { return null; }
}`,
`async function landCode(lat, lon) {
  // Alleen fallback voor oude/gedeelde locaties waar de browser nog geen landcode
  // heeft meegegeven. Nominatim staat incidentele, gebruiker-gestuurde reverse
  // geocoding toe; de waarschuwingenroute wordt daarnaast door Vercel gecachet.
  try {
    const r = await haal(
      "https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=3&lat=" +
      lat + "&lon=" + lon + "&accept-language=en", "application/json");
    const g = await r.json(), a = g && g.address || {};
    return a.country_code ? String(a.country_code).toUpperCase() : null;
  } catch (e) { return null; }
}`,
"warning country fallback");
waars=exact(waars,
'  const code = await landCode(lat, lon);\n  const slug = code ? METEOALARM[code] : null;',
'  const meegegevenLand=/^[A-Za-z]{2}$/.test(String(q.land||""))?String(q.land).toUpperCase():null;\n  const code = meegegevenLand || await landCode(lat, lon);\n  const slug = code ? METEOALARM[code] : null;',
"warning country query");
waars=exact(waars,
'    if (uit) return res.status(200).json({ bron: "MeteoAlarm " + slug, dekking: true, lijst: uit.lijst });\n    return res.status(200).json({ bron: "MeteoAlarm " + slug, dekking: false, lijst: [], reden: "bron onbereikbaar" });',
'    if (uit) return res.status(200).json({ bron: "MeteoAlarm " + slug, dekking: true, lijst: uit.lijst, land: code });\n    return res.status(200).json({ bron: "MeteoAlarm " + slug, dekking: false, lijst: [], reden: "bron onbereikbaar", land: code });',
"warning response country");
waars=exact(waars,
'    reden: code ? ("geen waarschuwingsbron voor " + code) : "land onbekend"',
'    reden: code ? ("geen waarschuwingsbron voor " + code) : "land onbekend", land: code',
"warning no-source country");
schrijf("lib/waarschuwingen.cjs",waars);

let privacy=lees("privacy.html");
privacy=exact(privacy,
'Voor reverse-geocoding gebruikt de server primair BigDataCloud en alleen als fallback OpenStreetMap Nominatim.',
'Voor een actuele GPS-locatie vraagt je browser de plaatsnaam rechtstreeks op bij BigDataCloud; die gratis dienst wordt niet via onze server aangeroepen. Als dat niet lukt, gebruikt de server OpenStreetMap Nominatim als beperkte fallback.',
"privacy provider uitleg");
schrijf("privacy.html",privacy);

let test=lees("prelaunch-regressions.test.js");
test=exact(test,
'ok(plaats.indexOf("[viaBigDataCloud, viaNominatim]")>=0,"Nominatim is alleen fallback voor reverse-geocoding");',
'ok(!plaats.includes("api.bigdatacloud.net")&&!waars.includes("api.bigdatacloud.net")&&index.includes("api.bigdatacloud.net/data/reverse-geocode-client"),"gratis BigDataCloud reverse-geocoding draait uitsluitend client-side");\nok(index.includes("data-land=")&&index.includes("&land=")&&index.includes("land:S.land"),"landcode reist mee met zoeken, opslag, delen en waarschuwingen");',
"provider static tests");
test=exact(test,
`  const urls=[];const pl=await roep("./lib/plaatsnaam.cjs",{lat:"52.35",lon:"5.26"},async url=>{urls.push(String(url));return{ok:true,json:async()=>({city:"Almere"})};});
  ok(pl.body.naam==="Almere"&&urls.length===1&&urls[0].includes("bigdatacloud"),"BigDataCloud voorkomt normale Nominatim-aanroep");`,
`  const urls=[];const pl=await roep("./lib/plaatsnaam.cjs",{lat:"52.35",lon:"5.26"},async url=>{urls.push(String(url));return{ok:true,json:async()=>({address:{city:"Almere",country_code:"nl"}})};});
  ok(pl.body.naam==="Almere"&&pl.body.land==="NL"&&urls.length===1&&urls[0].includes("nominatim")&&!urls[0].includes("bigdatacloud"),"serverfallback gebruikt alleen Nominatim en bewaart landcode");
  const warnUrls=[];const eu=await roep("./lib/waarschuwingen.cjs",{lat:"52.35",lon:"5.26",land:"NL"},async url=>{warnUrls.push(String(url));return{ok:true,text:async()=>JSON.stringify({warnings:[]})};});
  ok(eu.body.dekking===true&&eu.body.land==="NL"&&warnUrls.length===1&&warnUrls[0].includes("feeds.meteoalarm.org")&&!warnUrls.some(u=>u.includes("nominatim")||u.includes("bigdatacloud")),"meegegeven landcode voorkomt reverse-geocoding voor MeteoAlarm");
  const oudUrls=[];const oud=await roep("./lib/waarschuwingen.cjs",{lat:"52.35",lon:"5.26"},async url=>{oudUrls.push(String(url));if(String(url).includes("nominatim"))return{ok:true,json:async()=>({address:{country_code:"nl"}})};return{ok:true,text:async()=>JSON.stringify({warnings:[]})};});
  ok(oud.body.land==="NL"&&oudUrls.some(u=>u.includes("nominatim"))&&oudUrls.some(u=>u.includes("feeds.meteoalarm.org"))&&!oudUrls.some(u=>u.includes("bigdatacloud")),"oude locatie zonder landcode migreert via eenmalige Nominatim-fallback");`,
"provider dynamic tests");
schrijf("prelaunch-regressions.test.js",test);
console.log("Provider-policy fix toegepast.");
