"use strict";

const fs=require("fs");
const path=require("path");
const {vernieuwServiceworkerCache}=require("./postbuild-cache.js");

const OUT=path.join(__dirname,"..","public");
const BASIS_MARKER="/* ===== DESKTOP VISUAL POLISH 20260909 ===== */";
const MARKER="/* ===== MOBILE FINAL POLISH 20260910 ===== */";
const STYLE_ID="mobile-final-polish-style-20260910";

/* De mobiele uurweergave gebruikte S.d.current.time en liet alle grafiekuren
   staan. Daardoor bleef bijvoorbeeld om 20:31 de volledig verstreken rij 20:00
   zichtbaar, terwijl etmaal() de neerslagvelden van die rij terecht al op null
   had gezet. Het resultaat was de misleidende combinatie temperatuur + “– / –”.
   De tabel is een komende-uurtabel: sla uitsluitend uurstempels over die op de
   provider-tijdas niet meer in de toekomst liggen. Een expliciet gekozen
   kalenderdag blijft volledig en ongewijzigd. */
const RIJ_FILTER_BRON='    if(!tijd||temp===null||gevoel===null)continue;';
const RIJ_FILTER_PRODUCTIE=`    if(!tijd||temp===null||gevoel===null)continue;
    if(!dagGeselecteerd&&currentTime&&String(tijd)<=String(currentTime))continue;`;

const UURKLOK_BRON='  const rijen=desktop?desktopUurRijen():uurRijenUitGeo(S.geo,S.d&&S.d.current&&S.d.current.time,S.dag!=null,S.d&&S.d.hourly);';
const UURKLOK_PRODUCTIE=`  /* Vergelijk niet met een civiele IANA-klokstring: Open-Meteo levert de
     hourly-as met één vaste response-offset. Rond een DST-wissel moet de grens
     daarom op diezelfde provider-as liggen. Het instant is universeel; de
     response-offset maakt daar exact de vergelijkbare providerklok van. */
  const nuMs=S.klokInstantOverride&&typeof S.klokInstantOverride.getTime==="function"?S.klokInstantOverride.getTime():Date.now();
  const providerOffset=num(S.d&&S.d.utc_offset_seconds);
  const actueleProviderTijd=Number.isFinite(nuMs)&&providerOffset!==null?new Date(nuMs+providerOffset*1000).toISOString().slice(0,16):S.d&&S.d.current&&S.d.current.time;
  const rijen=desktop?desktopUurRijen():uurRijenUitGeo(S.geo,actueleProviderTijd,S.dag!=null,S.d&&S.d.hourly);`;

/* De vaste mobiele locatiebalk blijft fixed: de eerdere sticky-variant kon door
   layoutfeedback gaan schakelen tijdens scrollen. We veranderen die bewezen
   keuze niet. Alleen de harde onderrand krijgt een korte thema-eigen fade zodat
   content er visueel onder verdwijnt in plaats van halverwege een letter hard te
   worden afgesneden. De uurtabelkop wordt binnen de bestaande mobiele breakpoint
   één stap rustiger; desktop behoudt exact de bestaande 20px-hiërarchie.
   De merkregel in de footer is één SEO-link; mobiel krijgt alleen iets meer
   visuele ruimte rond de bestaande middelpunt-separator, zonder tekst, linkdoel
   of footerstructuur te wijzigen. */
const STYLE=`
${MARKER}
@media(max-width:900px){
  #minibar.aan{overflow:visible!important}
  #minibar.aan::after{
    content:"";
    position:absolute;
    left:0;right:0;bottom:-12px;height:12px;
    pointer-events:none;
    background:linear-gradient(to bottom,var(--sheet),transparent)
  }
  #wiw-hour-title{font-size:18px!important;line-height:1.18!important;scroll-margin-top:64px}
  footer a[href="/over/"]{white-space:nowrap}
  footer a[href="/over/"] b{display:inline-block;margin-right:3px}
}
`;

function tel(bron,zoek){return String(bron).split(zoek).length-1;}

function pasTekstAan(html,label="artifact"){
  let bron=String(html||"");
  if(!bron.includes(BASIS_MARKER))return {html:bron,geraakt:false};

  const reeds=bron.includes(MARKER);
  if(reeds){
    if(!bron.includes(RIJ_FILTER_PRODUCTIE)||bron.includes(UURKLOK_BRON)||!bron.includes(UURKLOK_PRODUCTIE))
      throw new Error(`${label}: mobiele final-polishmarker bestaat, maar runtimecontract is incompleet.`);
    return {html:bron,geraakt:true};
  }

  const rijN=tel(bron,RIJ_FILTER_BRON),klokN=tel(bron,UURKLOK_BRON);
  if(rijN!==1)throw new Error(`${label}: mobiel uurfilter-anker ontbreekt of is dubbel: ${rijN}`);
  if(klokN!==1)throw new Error(`${label}: mobiele provider-klokanker ontbreekt of is dubbel: ${klokN}`);
  if(bron.includes(RIJ_FILTER_PRODUCTIE)||bron.includes(UURKLOK_PRODUCTIE))
    throw new Error(`${label}: mobiele runtime is deels aangepast zonder final-polishmarker.`);

  bron=bron.replace(RIJ_FILTER_BRON,RIJ_FILTER_PRODUCTIE);
  bron=bron.replace(UURKLOK_BRON,UURKLOK_PRODUCTIE);

  const headEinde=bron.lastIndexOf("</head>");
  if(headEinde<0)throw new Error(`${label}: </head> ontbreekt voor mobiele final-polish.`);
  bron=bron.slice(0,headEinde)+`<style id="${STYLE_ID}">\n${STYLE.trim()}\n</style>\n`+bron.slice(headEinde);
  return {html:bron,geraakt:true};
}

function htmlBestanden(dir){
  const uit=[];
  for(const ent of fs.readdirSync(dir,{withFileTypes:true})){
    const p=path.join(dir,ent.name);
    if(ent.isDirectory())uit.push(...htmlBestanden(p));
    else if(ent.isFile()&&ent.name.endsWith(".html"))uit.push(p);
  }
  return uit;
}

function main(){
  let geraakt=0,geschreven=0;
  for(const p of htmlBestanden(OUT)){
    const voor=fs.readFileSync(p,"utf8"),r=pasTekstAan(voor,path.relative(OUT,p));
    if(!r.geraakt)continue;
    geraakt++;
    if(r.html!==voor){fs.writeFileSync(p,r.html,"utf8");geschreven++;}
  }
  if(!geraakt)throw new Error("Geen finale weerartifacts gevonden voor mobiele final-polish.");
  const cache=vernieuwServiceworkerCache(OUT,"mobile-final-polish-20260910");
  console.log(`Mobiele final-polish toegepast op ${geraakt} weerartifacts (${geschreven} gewijzigd): verstreken uurstempels uit komende-uurtabel, DST-veilige providerklokgrens, zachtere fixed-headerovergang, compactere uurtabelkop en ruimere footermerkseparator; cache ${cache}.`);
}

if(require.main===module)main();
module.exports={OUT,BASIS_MARKER,MARKER,STYLE_ID,STYLE,RIJ_FILTER_BRON,RIJ_FILTER_PRODUCTIE,UURKLOK_BRON,UURKLOK_PRODUCTIE,tel,pasTekstAan,htmlBestanden,main};
