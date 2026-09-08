"use strict";

const fs=require("fs");
const path=require("path");
const {vernieuwServiceworkerCache}=require("./postbuild-cache.js");

const OUT=path.join(__dirname,"..","public");
const MARKER="/* ===== HOUR PANEL REFINEMENT 20260907 ===== */";
const STYLE_MARKER="/* ===== DESKTOP FINISHING 20260907 ===== */";
const UREN_OUD="const MAX_DESKTOP_UREN=10;";
const UREN_NIEUW="const MAX_DESKTOP_UREN=24;/* kandidaatvenster, niet het zichtbare desktopaantal */";
const MM_OUD='mm.textContent=num(r.hoeveelheid)===0&&(num(r.kans)===null||num(r.kans)<=0)?"–":formatMm(r.hoeveelheid)||"–";';
const MM_NIEUW='mm.textContent=formatMm(r.hoeveelheid)||"–";';
const UURMODUS_OUD='  const desktop=window.innerWidth>=1100;\n  const rijen=desktop?desktopUurRijen():uurRijenUitGeo(S.geo,S.d&&S.d.current&&S.d.current.time,S.dag!=null,S.d&&S.d.hourly);tbody.replaceChildren();';
const UURMODUS_NIEUW=`  const desktop=window.innerWidth>=1100;
  /* De compacte, exact gedeelde uurweergave hoort bij het standaardbereik en
     een bewust gekozen dag. Een expliciete 48-uurs-/zevendagenkeuze behoudt
     de bestaande lange grafiek; op desktop verdwijnt de compacte uurkolom dan
     zodat twee verschillende tijdranges nooit naast elkaar worden gepresenteerd. */
  const langBereik=desktop&&S.dag==null&&S.bereik!==24;
  const layout=document.getElementById("wiw-chart-layout");
  if(layout)layout.dataset.hourPaired=langBereik?"0":"1";
  if(langBereik){paneel.style.height="";tbody.replaceChildren();return;}
  const rijen=desktop?desktopUurRijen():uurRijenUitGeo(S.geo,S.d&&S.d.current&&S.d.current.time,S.dag!=null,S.d&&S.d.hourly);tbody.replaceChildren();`;
const HOOGTE_OUD='  if(window.innerWidth<1100){aside.style.height="";return;}';
const HOOGTE_NIEUW=`  if(window.innerWidth<1100){aside.style.height="";return;}
  /* Een eerder geplande hoogte-sync mag een zojuist gekozen lange grafiek niet
     alsnog terugbrengen naar het aantal passende uurregels. */
  if(S.dag==null&&S.bereik!==24){aside.style.height="";return;}`;
const PANEL_HOOGTE_OUD=`  while(tbody&&tbody.lastElementChild&&tbody.lastElementChild.getBoundingClientRect().bottom>grens+0.01)tbody.lastElementChild.remove();
  aside.dataset.visibleHours=String(tbody?tbody.children.length:0);`;
const PANEL_HOOGTE_NIEUW=`  while(tbody&&tbody.lastElementChild&&tbody.lastElementChild.getBoundingClientRect().bottom>grens+0.01)tbody.lastElementChild.remove();
  /* Het paneel volgt exact de gemeten grafiekhoogte. Het zichtbare aantal uren
     komt uitsluitend uit de volledige DOM-rijen die fysiek binnen die hoogte
     passen; het 24-uursvenster hierboven is alleen de bronhorizon. */
  aside.style.height=h+"px";
  aside.dataset.visibleHours=String(tbody?tbody.children.length:0);`;
const NU_OUD="    const nuIdx = plaatsNuIndex(TI);";
const NU_NIEUW=`    let nuIdx = plaatsNuIndex(TI);
    /* De gedeelde desktoprange begint bij het eerstvolgende volledige forecastuur.
       Als 'nu' daardoor hooguit één uur vóór de eerste bronwaarde valt, blijft de
       actuele meting als context exact op de linker grafiekgrens zichtbaar. De
       forecastpunten zelf blijven ongewijzigd en dus gelijk aan de uurtabel. */
    if(nuIdx==null&&S.dag==null&&!M&&window.innerWidth>=1100&&TI.length){
      const nuMs=S.klokInstantOverride&&typeof S.klokInstantOverride.getTime==="function"?S.klokInstantOverride.getTime():Date.now();
      const eersteMs=naarUTC(TI[0]),afstand=eersteMs-nuMs;
      if(Number.isFinite(eersteMs)&&Number.isFinite(nuMs)&&afstand>=0&&afstand<3600000)nuIdx=0;
    }`;
const STYLE=`
${STYLE_MARKER}
/* Gerichte desktopafronding op basis van productiebeelden. Mobiele layout,
   data-interpretatie en providerlogica blijven onaangeraakt. */
@media(min-width:1100px){
  /* Plaats en tijd vormen samen één compacte, gecentreerde kopgroep. */
  #place{
    display:flex!important;
    justify-content:center!important;
    align-items:baseline!important;
    gap:18px!important;
    padding-left:clamp(28px,3.5vw,56px)!important;
    padding-right:clamp(28px,3.5vw,56px)!important
  }
  #place #plaatstijd{margin-left:0!important;flex:0 0 auto!important}

  /* Een expliciete 48-uurs-/zevendagenkeuze is een grafiekmodus, niet de
     compacte gedeelde uurweergave. Geef de grafiek dan zijn volledige breedte
     en toon geen uurkolom met een afwijkende kortere range. */
  .wiw-chart-layout[data-hour-paired="0"]{
    grid-template-columns:minmax(0,1fr)!important
  }
  .wiw-chart-layout[data-hour-paired="0"] .wiw-hour-panel{
    display:none!important
  }

  /* De buitenste SEO-navigatie blijft bewust viewportbreed zodat de bestaande
     scheidingslijn en achtergrond full-bleed blijven. Alleen de echte inhoud
     krijgt de veilige desktop-inset; latere shorthand-padding op de wrapper kan
     deze inhoudsruimte daardoor niet meer ongedaan maken. */
  .seo-plaatsnav-inner{
    padding-left:clamp(24px,3.5vw,56px)!important;
    padding-right:clamp(24px,3.5vw,56px)!important;
    box-sizing:border-box!important
  }

  /* Compact maar niet gepropt: de rijhoogte blijft leesbaar en bepaalt samen
     met de echte grafiekhoogte hoeveel volledige uren zichtbaar zijn. CSS
     forceert bewust geen vast aantal uurregels. */
  #wiw-hour-panel h3{
    margin-top:0!important;
    margin-bottom:4px!important;
    line-height:1.15!important
  }
  .wiw-hour-table td{
    padding-top:2px!important;
    padding-bottom:2px!important;
    line-height:14px!important
  }
  .wiw-hour-table th{
    padding-top:2px!important;
    padding-bottom:2px!important;
    line-height:12px!important
  }
}

@media(min-width:1500px){
  /* Op brede desktops is de laatste Nachtzicht-kolom al volledig breed, maar
     de maantijd stond direct onder het advies waardoor rechts visueel leeg
     bleef. Gebruik die bestaande kolom in twee delen: advies links, maaninfo
     rechts. Er wordt geen nieuwe informatie toegevoegd. */
  #nights .row.night:not(.kop) .nmeta.wide{
    display:grid!important;
    grid-template-columns:minmax(0,1fr) minmax(180px,230px)!important;
    column-gap:24px!important;
    align-items:center!important
  }
  #nights .row.night:not(.kop) .nachtadvies{
    grid-column:1!important;
    width:100%!important;
    max-width:none!important;
    margin:0!important;
    text-align:left!important
  }
  #nights .row.night:not(.kop) .nachtmaan{
    grid-column:2!important;
    width:100%!important;
    max-width:none!important;
    margin:0!important;
    justify-self:end!important;
    text-align:right!important;
    white-space:normal!important
  }
}
`;

function tel(bron,zoek){return String(bron).split(zoek).length-1;}
function htmlBestanden(dir){
  const uit=[];
  for(const ent of fs.readdirSync(dir,{withFileTypes:true})){
    const p=path.join(dir,ent.name);
    if(ent.isDirectory())uit.push(...htmlBestanden(p));
    else if(ent.isFile()&&ent.name.endsWith(".html"))uit.push(p);
  }
  return uit;
}
function vervangEen(bron,oud,nieuw,label){
  const oudN=tel(bron,oud),nieuwN=tel(bron,nieuw);
  if(oudN===1&&nieuwN===0)return bron.replace(oud,nieuw);
  if(oudN===0&&nieuwN===1)return bron;
  throw new Error(`${label}: verwacht precies één oude of nieuwe variant; oud=${oudN}, nieuw=${nieuwN}.`);
}
function voegStijlInHeadToe(bron,label){
  const headEinde=bron.indexOf("</head>");
  if(headEinde<0)throw new Error(`${label}: </head> ontbreekt voor desktopafronding.`);
  const bestaand=bron.indexOf(STYLE_MARKER);
  if(bestaand>=0){
    if(bestaand>headEinde)throw new Error(`${label}: desktop-finishing-stijl staat buiten de actieve <head>.`);
    return bron;
  }
  /* release-recovery-finalize voegt later in de body een <noscript><style>
     toe. Een globale lastIndexOf('</style>') koos daardoor dat niet-actieve
     stijlblok en liet de desktopregels bij normale JavaScript-runs ongemerkt
     buiten werking. Zoek daarom uitsluitend vóór </head> naar het laatste
     echte head-stijlblok. */
  const stylePos=bron.lastIndexOf("</style>",headEinde);
  if(stylePos<0)throw new Error(`${label}: geen actief stijlblok in <head> gevonden voor desktopafronding.`);
  return bron.slice(0,stylePos)+STYLE+"\n"+bron.slice(stylePos);
}
function pasTekstAan(html,label="artifact"){
  let bron=String(html||"");
  if(!bron.includes("WeatherNowFinalDesktopUI20260902"))return {html:bron,geraakt:false};
  bron=vervangEen(bron,UREN_OUD,UREN_NIEUW,`${label} desktopuren`);
  const stapOud='const stap = n<=24 ? 3 : n<=48 ? 6 : (M?18:12);';
  const stapNieuw='const stap = !M&&window.innerWidth>=1100&&n<=globalThis.WeatherNowFinalDesktopUI20260902.MAX_DESKTOP_UREN ? 1 : n<=24 ? 3 : n<=48 ? 6 : (M?18:12);';
  bron=vervangEen(bron,stapOud,stapNieuw,`${label} desktop-uurmarkeringen`);
  bron=vervangEen(bron,MM_OUD,MM_NIEUW,`${label} neerslagnul`);
  bron=vervangEen(bron,UURMODUS_OUD,UURMODUS_NIEUW,`${label} desktop-bereikmodus`);
  bron=vervangEen(bron,HOOGTE_OUD,HOOGTE_NIEUW,`${label} lange-bereikhoogte`);
  bron=vervangEen(bron,PANEL_HOOGTE_OUD,PANEL_HOOGTE_NIEUW,`${label} hoogtegestuurd uurpaneel`);
  bron=vervangEen(bron,NU_OUD,NU_NIEUW,`${label} desktop-nucontext`);
  if(!bron.includes(MARKER)){
    const anker='const MARKER="final-desktop-ui-20260902";';
    if(tel(bron,anker)!==1)throw new Error(`${label}: runtime-marker ontbreekt of is dubbel.`);
    bron=bron.replace(anker,`${MARKER}\n${anker}`);
  }
  bron=voegStijlInHeadToe(bron,label);
  return {html:bron,geraakt:true};
}
function main(){
  let geraakt=0,geschreven=0;
  for(const p of htmlBestanden(OUT)){
    const voor=fs.readFileSync(p,"utf8"),r=pasTekstAan(voor,path.relative(OUT,p));
    if(!r.geraakt)continue;
    geraakt++;
    if(r.html!==voor){fs.writeFileSync(p,r.html,"utf8");geschreven++;}
  }
  if(!geraakt)throw new Error("Geen WeatherNow-artifacts gevonden voor uurpaneelrefinement.");
  const cache=vernieuwServiceworkerCache(OUT,"hour-panel-refinement-20260907");
  console.log(`Uurpaneelrefinement toegepast op ${geraakt} weerartifacts (${geschreven} gewijzigd): zichtbare desktopuren worden uit de gemeten grafiekhoogte bepaald binnen de 24-uurs bronhorizon, expliciete lange grafiekbereiken blijven behouden, actuele Nu-context blijft behouden, 0 mm blijft numeriek en desktopspacing blijft compact leesbaar; cache ${cache}.`);
}

if(require.main===module)main();
module.exports={OUT,MARKER,STYLE_MARKER,STYLE,UREN_OUD,UREN_NIEUW,MM_OUD,MM_NIEUW,PANEL_HOOGTE_OUD,PANEL_HOOGTE_NIEUW,NU_OUD,NU_NIEUW,tel,htmlBestanden,vervangEen,voegStijlInHeadToe,pasTekstAan,main};