"use strict";

/* Diagnostiek voor scripts/openmeteo-daggrens-contract.js (CI-job measure-final-artifact).

   Aanleiding: op runners in het westen van de VS faalt de verbinding met Open-Meteo na circa
   10,5 s per poging met alleen "fetch failed". Dat is de verbindingslimiet van undici
   (UND_ERR_CONNECT_TIMEOUT), die een hangende DNS-opvraging, TCP-verbinding of TLS-handshake
   niet van elkaar onderscheidt. Dit bestand logt alleen; het verandert niets aan pogingen,
   wachttijden, time-outs, assertions of foutmeldingen van het contractscript.

   Twee soorten waarnemingen, altijd gelabeld:
   - waarneming=oorspronkelijke-aanvraag: de foutcodes en duur van de aanvraag zelf;
   - waarneming=afzonderlijke-meting-achteraf: een losse, begrensde meting van DNS, TCP en TLS
     na de laatste mislukte poging. Die meting gebeurt later en via een eigen verbinding en is
     dus geen bewijs voor de oorzaak van de oorspronkelijke fout.

   Nooit loggen: URL's, query's, IP-adressen, headers, response-inhoud of geheimen. */

const HOST="api.open-meteo.com";
const POORT=443;
const FASE_GRENS_MS=10000;

const DNS_CODES=["ENOTFOUND","EAI_AGAIN","EAI_FAIL","EAI_NODATA","EAI_NONAME","ESERVFAIL","ETIMEOUT","ECONNREFUSED_DNS"];

function veiligLabel(x){return String(x==null?"":x).replace(/[^\p{L}\p{N} _.-]/gu,"").replace(/\s+/g,"_").slice(0,48)||"-";}

/* Verzamelt foutcodes uit de fout en zijn oorzaken (cause, AggregateError.errors), begrensd. */
function foutCodes(fout){
  const wachtrij=[fout],bezocht=new Set(),codes=[],namen=[];
  for(let i=0;i<wachtrij.length&&i<12;i++){
    const e=wachtrij[i];
    if(!e||typeof e!=="object"||bezocht.has(e))continue;
    bezocht.add(e);
    if(typeof e.code==="string"&&/^[A-Z][A-Z0-9_]{1,63}$/.test(e.code)&&!codes.includes(e.code))codes.push(e.code);
    if(typeof e.name==="string"&&/^[A-Za-z]{1,40}$/.test(e.name)&&!namen.includes(e.name))namen.push(e.name);
    if(e.cause)wachtrij.push(e.cause);
    if(Array.isArray(e.errors))wachtrij.push(...e.errors.slice(0,4));
  }
  return {codes:codes.slice(0,6),namen:namen.slice(0,4)};
}

/* Eén categorie per fout. De volgorde is bewust: een expliciete code gaat voor de foutnaam. */
function foutSoort(fout){
  const {codes,namen}=foutCodes(fout);
  const http=/^HTTP (\d{3})$/.exec(String(fout&&fout.message||""));
  if(http)return {soort:"http",http:Number(http[1]),codes,namen};
  if(codes.some(c=>DNS_CODES.includes(c)))return {soort:"dns",http:null,codes,namen};
  if(codes.includes("UND_ERR_CONNECT_TIMEOUT"))return {soort:"verbindingslimiet",http:null,codes,namen};
  if(codes.some(c=>/^(ERR_TLS_|ERR_SSL_|CERT_|UNABLE_TO_|DEPTH_ZERO_SELF_SIGNED_CERT|SELF_SIGNED_CERT_IN_CHAIN)/.test(c)))return {soort:"tls",http:null,codes,namen};
  if(codes.some(c=>/^(ECONN|ENET|EHOST|EPIPE|ETIMEDOUT|UND_ERR_SOCKET)/.test(c)))return {soort:"tcp",http:null,codes,namen};
  if(codes.some(c=>/^UND_ERR_(HEADERS|BODY)_TIMEOUT$/.test(c)))return {soort:"antwoordlimiet",http:null,codes,namen};
  if(namen.includes("TimeoutError")||namen.includes("AbortError"))return {soort:"afgebroken",http:null,codes,namen};
  if(namen.includes("SyntaxError"))return {soort:"json",http:null,codes,namen};
  return {soort:"onbekend",http:null,codes,namen};
}

function pogingRegel({plaats,poging,duurMs,fout}){
  const f=foutSoort(fout);
  return ["OPENMETEO_POGING","waarneming=oorspronkelijke-aanvraag","plaats="+veiligLabel(plaats),"poging="+Number(poging),
    "duur_ms="+Math.max(0,Math.round(Number(duurMs)||0)),"soort="+f.soort,"http_status="+(f.http===null?"-":f.http),
    "oorzaakcodes="+(f.codes.join(",")||"-"),"foutnamen="+(f.namen.join(",")||"-")].join(" ");
}

function runtimeRegel(proc=process,net=require("net")){
  let autoFamily="-",pogingTimeout="-";
  try{if(typeof net.getDefaultAutoSelectFamily==="function")autoFamily=String(net.getDefaultAutoSelectFamily());}catch(e){}
  try{if(typeof net.getDefaultAutoSelectFamilyAttemptTimeout==="function")pogingTimeout=String(net.getDefaultAutoSelectFamilyAttemptTimeout());}catch(e){}
  const v=proc&&proc.versions||{};
  return ["OPENMETEO_RUNTIME","node="+veiligLabel(proc&&proc.version),"undici="+veiligLabel(v.undici),
    "autoSelectFamily="+veiligLabel(autoFamily),"autoSelectFamilyAttemptTimeout_ms="+veiligLabel(pogingTimeout)].join(" ");
}

/* Begrenst een fase: resolve met {ok,waarde}, {ok:false,fout} of {grens:true} na grensMs.
   De verbinding van de fase wordt direct na afloop opgeruimd, ook na de grens. */
function begrensd(start,grensMs){
  return new Promise(resolve=>{
    let klaar=false,annuleer=()=>{};
    const afronden=r=>{
      if(klaar)return;
      klaar=true;clearTimeout(timer);
      try{annuleer();}catch(e){}
      resolve(r);
    };
    const timer=setTimeout(()=>afronden({grens:true}),grensMs);
    try{annuleer=start(w=>afronden({ok:true,waarde:w}),f=>afronden({ok:false,fout:f}))||(()=>{});}
    catch(f){afronden({ok:false,fout:f});}
    if(klaar){try{annuleer();}catch(e){}}
  });
}

function faseResultaat(fase,uitkomst,duurMs,extra={}){
  return {fase,uitkomst,duurMs:Math.max(0,Math.round(duurMs)),...extra};
}

/* Afzonderlijke meting achteraf: DNS, dan TCP, dan TLS, elk begrensd op grensMs.
   Afhankelijkheden zijn injecteerbaar voor deterministische tests. */
async function fasemeting({host=HOST,poort=POORT,grensMs=FASE_GRENS_MS,
  lookup=(h,cb)=>require("dns").lookup(h,{all:true},cb),
  tcpConnect=(opts)=>require("net").connect(opts),
  tlsConnect=(opts)=>require("tls").connect(opts),
  nu=()=>Date.now()}={}){
  const uit=[];
  let t=nu();
  const dns=await begrensd((ok,fout)=>{lookup(host,(err,adressen)=>err?fout(err):ok(adressen||[]));return ()=>{};},grensMs);
  const dnsDuur=nu()-t;
  if(dns.grens){uit.push(faseResultaat("dns","grens",dnsDuur));}
  else if(!dns.ok){uit.push(faseResultaat("dns","fout",dnsDuur,{codes:foutCodes(dns.fout).codes}));}
  else{
    const lijst=Array.isArray(dns.waarde)?dns.waarde:[];
    const families=[...new Set(lijst.map(a=>Number(a&&a.family)).filter(f=>f===4||f===6))].sort();
    uit.push(faseResultaat("dns",lijst.length?"succes":"leeg",dnsDuur,{adressen:lijst.length,families}));
  }
  const eerste=dns.ok&&Array.isArray(dns.waarde)&&dns.waarde[0]&&dns.waarde[0].address?dns.waarde[0]:null;
  if(!eerste){
    uit.push(faseResultaat("tcp","overgeslagen",0),faseResultaat("tls","overgeslagen",0));
    return uit;
  }
  const familie=Number(eerste.family)===6?6:4;
  t=nu();
  const tcp=await begrensd((ok,fout)=>{
    const s=tcpConnect({host:eerste.address,port:poort,family:familie});
    s.on("error",()=>{});s.once("connect",()=>ok(true));s.once("error",fout);
    return ()=>{try{s.destroy();}catch(e){}};
  },grensMs);
  const tcpDuur=nu()-t;
  uit.push(tcp.grens?faseResultaat("tcp","grens",tcpDuur,{familie}):tcp.ok?faseResultaat("tcp","succes",tcpDuur,{familie}):faseResultaat("tcp","fout",tcpDuur,{familie,codes:foutCodes(tcp.fout).codes}));
  if(!tcp.ok){uit.push(faseResultaat("tls","overgeslagen",0));return uit;}
  t=nu();
  const tls=await begrensd((ok,fout)=>{
    const s=tlsConnect({host:eerste.address,port:poort,servername:host,family:familie});
    s.on("error",()=>{});
    s.once("secureConnect",()=>ok({protocol:typeof s.getProtocol==="function"?s.getProtocol():null,geautoriseerd:s.authorized===true}));
    s.once("error",fout);
    return ()=>{try{s.destroy();}catch(e){}};
  },grensMs);
  const tlsDuur=nu()-t;
  uit.push(tls.grens?faseResultaat("tls","grens",tlsDuur):tls.ok?faseResultaat("tls","succes",tlsDuur,{protocol:tls.waarde.protocol,geautoriseerd:tls.waarde.geautoriseerd}):faseResultaat("tls","fout",tlsDuur,{codes:foutCodes(tls.fout).codes}));
  return uit;
}

function fasemetingRegels(resultaten,{plaats}={}){
  const kop="OPENMETEO_FASEMETING waarneming=afzonderlijke-meting-achteraf plaats="+veiligLabel(plaats)
    +" host="+HOST+" grens_ms="+FASE_GRENS_MS+" let_op=losse_meting_na_de_mislukte_aanvraag_geen_bewijs_voor_de_oorzaak_daarvan";
  return [kop,...resultaten.map(r=>["OPENMETEO_FASEMETING","waarneming=afzonderlijke-meting-achteraf","fase="+r.fase,"uitkomst="+r.uitkomst,
    "duur_ms="+r.duurMs,
    ...(r.adressen!==undefined?["adressen="+Number(r.adressen)]:[]),
    ...(r.families?["families="+(r.families.join(",")||"-")]:[]),
    ...(r.familie?["familie="+r.familie]:[]),
    ...(r.protocol!==undefined?["protocol="+veiligLabel(r.protocol)]:[]),
    ...(r.geautoriseerd!==undefined?["certificaat_geldig="+(r.geautoriseerd?"ja":"nee")]:[]),
    ...(r.codes?["oorzaakcodes="+(r.codes.join(",")||"-")]:[])].join(" "))];
}

/* Draait de meting en logt het resultaat; gooit nooit, zodat de oorspronkelijke fout leidend blijft. */
async function logFasemeting({plaats,log=console.log,meting=fasemeting}={}){
  try{
    log(runtimeRegel());
    const resultaten=await meting();
    for(const regel of fasemetingRegels(resultaten,{plaats}))log(regel);
  }catch(e){
    log("OPENMETEO_FASEMETING waarneming=afzonderlijke-meting-achteraf uitkomst=meting_mislukt soort="+foutSoort(e).soort);
  }
}

module.exports={HOST,POORT,FASE_GRENS_MS,foutCodes,foutSoort,pogingRegel,runtimeRegel,fasemeting,fasemetingRegels,logFasemeting,veiligLabel};
