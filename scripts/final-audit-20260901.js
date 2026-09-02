/* Finale gecombineerde audithelpers 2026-09-01.
 * Pure functies: bronsemantiek, regenperioden en begrijpelijke waarschuwinguitleg.
 */
(function(root,factory){
  const api=factory();
  if(typeof module!=="undefined"&&module.exports)module.exports=api;
  if(root)root.WeatherNowFinalAudit20260901=api;
})(typeof globalThis!=="undefined"?globalThis:this,function(){
"use strict";

const num=v=>v!==null&&v!==undefined&&v!==""&&Number.isFinite(Number(v))?Number(v):null;
const DAGEN=["zo","ma","di","wo","do","vr","za"];
function tijd(iso){const m=/T(\d{2}:\d{2})/.exec(String(iso||""));return m?m[1]:"";}
function datum(iso){const m=/^(\d{4}-\d{2}-\d{2})T/.exec(String(iso||""));return m?m[1]:"";}
function dagKort(iso){const d=datum(iso);if(!d)return "";const x=new Date(d+"T12:00:00Z");return Number.isNaN(x.getTime())?"":DAGEN[x.getUTCDay()];}
function mmTekst(v){const n=num(v);if(n===null||n<0)return "";if(n<0.05)return "<0,05 mm";return n.toFixed(1).replace(".",",")+" mm";}

/* Open-Meteo hourly precipitation op tijdstip T beschrijft het voorafgaande uur.
   Daarom hoort waarde[i] bij [grafiekTijden[i-1], grafiekTijden[i]]. De exacte
   bronindex blijft leidend, zodat een dubbele lokale kloktijd rond DST nooit via
   indexOf aan het verkeerde uur wordt gekoppeld. */
function regenperiodenVoorGrafiek(input={}){
  const grafiekTijden=Array.isArray(input.grafiekTijden)?input.grafiekTijden:[];
  const bronTijden=Array.isArray(input.bronTijden)?input.bronTijden:[];
  const neerslag=Array.isArray(input.neerslag)?input.neerslag:[];
  const bronStart=Number.isInteger(input.bronStart)?input.bronStart:null;
  const actueelBronIndex=Number.isInteger(input.actueelBronIndex)?input.actueelBronIndex:null;
  const grens=num(input.meetbaarMm);const meetbaar=grens===null?0.1:Math.max(0,grens);
  const toonVerstreken=input.toonVerstreken===true;
  if(bronStart===null||grafiekTijden.length<2)return [];
  const uit=[];let lopend=null;
  for(let i=1;i<grafiekTijden.length;i++){
    const bronIndex=bronStart+i,eindIso=grafiekTijden[i],beginIso=grafiekTijden[i-1];
    const geldig=bronIndex>=0&&bronIndex<bronTijden.length&&bronTijden[bronIndex]===eindIso;
    const waarde=geldig?num(neerslag[bronIndex]):null;
    const toekomstig=toonVerstreken||actueelBronIndex===null||bronIndex>actueelBronIndex;
    const nat=geldig&&toekomstig&&waarde!==null&&waarde>=meetbaar;
    if(nat){
      if(!lopend)lopend={van:beginIso,tot:eindIso,som:0,eersteBronIndex:bronIndex,laatsteBronIndex:bronIndex};
      lopend.tot=eindIso;lopend.som+=waarde;lopend.laatsteBronIndex=bronIndex;
    }else if(lopend){uit.push(lopend);lopend=null;}
  }
  if(lopend)uit.push(lopend);
  return uit;
}
function regenPeriodeTijdvak(p){
  if(!p)return "";const a=String(p.van||""),b=String(p.tot||"");
  if(!tijd(a)||!tijd(b))return "";
  if(datum(a)===datum(b))return tijd(a)+"–"+tijd(b);
  return dagKort(a)+" "+tijd(a)+"–"+dagKort(b)+" "+tijd(b);
}
function regenSamenvatting(perioden,max=2){
  const p=Array.isArray(perioden)?perioden:[];if(!p.length)return "";
  const limiet=Math.max(1,Math.floor(num(max)||2));
  const delen=p.slice(0,limiet).map(x=>regenPeriodeTijdvak(x)+" · "+mmTekst(x.som));
  const rest=p.length-delen.length;
  return "Verwachte meetbare neerslag: "+delen.join("; ")+(rest>0?"; plus "+rest+" latere "+(rest===1?"periode":"perioden"):"")+".";
}

function fahrenheitNaarCelsius(f){const n=num(f);return n===null?null:(n-32)*5/9;}
function rondC(v){const n=num(v);return n===null?null:Math.round(n);}
function nwsTitelNl(titel){
  const t=String(titel||"").trim(),k=t.toLowerCase();
  const map=[
    [/^heat advisory\b/,"Hitteadvies"],
    [/^excessive heat warning\b/,"Waarschuwing voor extreme hitte"],
    [/^heat warning\b/,"Waarschuwing voor hitte"],
    [/^air quality alert\b/,"Luchtkwaliteitswaarschuwing"],
    [/^air quality advisory\b/,"Luchtkwaliteitsadvies"],
    [/^winter weather advisory\b/,"Winterweeradvies"],
    [/^severe thunderstorm warning\b/,"Waarschuwing voor zwaar onweer"],
    [/^tornado warning\b/,"Tornadowaarschuwing"],
    [/^flash flood warning\b/,"Waarschuwing voor plotselinge overstromingen"],
    [/^flood warning\b/,"Overstromingswaarschuwing"],
    [/^wind advisory\b/,"Windadvies"],
    [/^high wind warning\b/,"Waarschuwing voor zware wind"],
    [/^dense fog advisory\b/,"Mistadvies"]
  ];
  for(const [re,nl] of map)if(re.test(k))return nl;
  return t;
}
function isNwsHitteTitel(titel){return /^(?:heat advisory|excessive heat warning|heat warning)\b/i.test(String(titel||"").trim());}
function fahrenheitContext(titel,tekst){
  const s=String(tekst||"");
  let m=/(-?\d+(?:[.,]\d+)?)\s*(?:to|through|[-–])\s*(-?\d+(?:[.,]\d+)?)\s*(?:°\s*F|degrees?\s*F(?:ahrenheit)?)/i.exec(s);
  if(!m&&isNwsHitteTitel(titel))m=/(-?\d{2,3})\s*(?:to|through|[-–])\s*(-?\d{2,3})\s*degrees\b/i.exec(s);
  if(m){
    const a=Number(m[1].replace(",",".")),b=Number(m[2].replace(",","."));
    if(Number.isFinite(a)&&Number.isFinite(b))return `${Math.round(a)}–${Math.round(b)} °F is ongeveer ${rondC(fahrenheitNaarCelsius(a))}–${rondC(fahrenheitNaarCelsius(b))} °C.`;
  }
  const waarden=[];const re=/(-?\d+(?:[.,]\d+)?)\s*(?:°\s*F|degrees?\s*F(?:ahrenheit)?)/ig;let x;
  while((x=re.exec(s))&&waarden.length<2){const f=Number(x[1].replace(",","."));if(Number.isFinite(f))waarden.push(f);}
  if(waarden.length===1)return `${Math.round(waarden[0])} °F is ongeveer ${rondC(fahrenheitNaarCelsius(waarden[0]))} °C.`;
  if(waarden.length>=2)return `${Math.round(waarden[0])} en ${Math.round(waarden[1])} °F zijn ongeveer ${rondC(fahrenheitNaarCelsius(waarden[0]))} en ${rondC(fahrenheitNaarCelsius(waarden[1]))} °C.`;
  /* Alleen binnen een ondubbelzinnig NWS-hittewaarschuwingstype mag een kaal
     Amerikaans heat-indexgetal als Fahrenheit worden geïnterpreteerd. De
     officiële tekst zelf wordt nergens aangepast. */
  if(isNwsHitteTitel(titel)){
    const impliciet=/\bheat index values?\s+(?:up to|as high as|around|near)\s+(\d{2,3})(?!\s*(?:°\s*C|degrees?\s*C|celsius))\b/i.exec(s);
    if(impliciet){const f=Number(impliciet[1]);if(Number.isFinite(f)&&f>=80&&f<=140)return `De Amerikaanse hitte-index loopt op tot ${Math.round(f)} °F, ongeveer ${rondC(fahrenheitNaarCelsius(f))} °C.`;}
  }
  return "";
}
function nwsUitleg(titel,tekst){
  const nl=nwsTitelNl(titel),basis=nl&&nl!==String(titel||"").trim()
    ?"De Amerikaanse weerdienst heeft voor deze locatie een "+nl.toLocaleLowerCase("nl-NL")+" uitgegeven."
    :"De Amerikaanse weerdienst heeft voor deze locatie een officiële waarschuwing uitgegeven.";
  const metrisch=fahrenheitContext(titel,tekst);
  return {titel:nl,uitleg:basis+(metrisch?" "+metrisch:""),metrisch};
}

return {regenperiodenVoorGrafiek,regenPeriodeTijdvak,regenSamenvatting,mmTekst,fahrenheitNaarCelsius,nwsTitelNl,isNwsHitteTitel,fahrenheitContext,nwsUitleg};
});
