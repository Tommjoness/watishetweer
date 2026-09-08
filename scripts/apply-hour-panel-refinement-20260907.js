"use strict";

const fs=require("fs");
const path=require("path");
const {vernieuwServiceworkerCache}=require("./postbuild-cache.js");

const OUT=path.join(__dirname,"..","public");
const MARKER="/* ===== HOUR PANEL REFINEMENT 20260907 ===== */";
const STYLE_MARKER="/* ===== DESKTOP FINISHING 20260907 ===== */";
const UREN_OUD="const MAX_DESKTOP_UREN=10;";
const UREN_NIEUW="const MAX_DESKTOP_UREN=12;/* maximaal venster; de grafiekhoogte kiest 8–12 volledige rijen */";
const MM_OUD='mm.textContent=num(r.hoeveelheid)===0&&(num(r.kans)===null||num(r.kans)<=0)?"–":formatMm(r.hoeveelheid)||"–";';
const MM_NIEUW='mm.textContent=formatMm(r.hoeveelheid)||"–";';
const UURMODUS_OUD='  const desktop=window.innerWidth>=1100;\n  const rijen=desktop?desktopUurRijen():uurRijenUitGeo(S.geo,S.d&&S.d.current&&S.d.current.time,S.dag!=null,S.d&&S.d.hourly);tbody.replaceChildren();';
const UURMODUS_NIEUW=`  const desktop=window.innerWidth>=1100;
  /* De compacte uurweergave hoort uitsluitend bij het rollende 24-uursbereik.
     Een gekozen kalenderdag of expliciete 48-uurs-/zevendagenkeuze behoudt de
     bestaande lange grafiek zonder semantisch afwijkende komende-urentabel. */
  const langBereik=desktop&&(S.dag!=null||S.bereik!==24);
  const layout=document.getElementById("wiw-chart-layout");
  if(layout)layout.dataset.hourPaired=langBereik?"0":"1";
  /* Elke echte tabelrender begint met een nieuwe kandidaatset. syncHoogte mag
     daarna tijdelijk rijen verwijderen, maar bewaart zelf de volledige set
     zodat een latere, stabielere grafiekhoogte die kandidaten kan herstellen. */
  delete paneel.__wiwHourCandidateRows;
  if(langBereik){paneel.style.height="";tbody.replaceChildren();return;}
  const rijen=desktop?desktopUurRijen():uurRijenUitGeo(S.geo,S.d&&S.d.current&&S.d.current.time,S.dag!=null,S.d&&S.d.hourly);
  if(desktop)paneel.dataset.candidateHours=String(rijen.length);
  /* Lijn de 24-uursgrafiek uit vóór de hoogtefiltering. Anders kan syncHoogte
     kandidaten verwijderen op basis van de oude grafiekgeometrie en kunnen
     die rijen na de grafiekhertekening niet meer terugkomen. */
  if(desktop&&rijen.length&&basisGrafiek&&S.geo&&typeof S.geo.x==="function"){
    const start=Number(rijen[0].bronIndex);
    if(Number.isInteger(start)&&S.chartStart!==start){basisGrafiek(start,24);desktopGrafiek=true;}
  }
  tbody.replaceChildren();`;
const HOOGTE_OUD='  if(window.innerWidth<1100){aside.style.height="";return;}';
const HOOGTE_NIEUW=`  if(window.innerWidth<1100){aside.style.height="";aside.style.removeProperty("--wiw-hour-row-pad-extra");return;}
  /* Meet elke sync vanuit de vaste leesbare minimumrijhoogte. Resthoogte uit
     een vorige render mag dus nooit bepalen hoeveel nieuwe volledige rijen
     passen. */
  aside.style.removeProperty("--wiw-hour-row-pad-extra");
  /* Een eerder geplande hoogte-sync mag een zojuist gekozen lange grafiek of
     kalenderdag niet alsnog terugbrengen naar de compacte komende-urenmodus. */
  if(S.dag!=null||S.bereik!==24){aside.style.height="";return;}`;
const PANEL_HOOGTE_OUD=`  while(tbody&&tbody.lastElementChild&&tbody.lastElementChild.getBoundingClientRect().bottom>grens+0.01)tbody.lastElementChild.remove();
  aside.dataset.visibleHours=String(tbody?tbody.children.length:0);`;
const PANEL_HOOGTE_NIEUW=`  /* Hoogtefiltering is reversibel: de eerste meting bewaart alle kandidaatrijen;
     elke volgende meting zet diezelfde nodes terug vóór opnieuw wordt bepaald
     hoeveel volledige regels binnen de actuele natuurlijke grafiekhoogte passen. */
  if(tbody){
    if(!Array.isArray(aside.__wiwHourCandidateRows))aside.__wiwHourCandidateRows=[...tbody.children];
    else tbody.replaceChildren(...aside.__wiwHourCandidateRows);
  }
  while(tbody&&tbody.lastElementChild&&tbody.lastElementChild.getBoundingClientRect().bottom>grens+0.01)tbody.lastElementChild.remove();
  /* Het paneel volgt exact de onafhankelijk gemeten grafiekhoogte. Eerst wordt met de vaste,
     leesbare minimumrijhoogte het maximale aantal volledige uren gekozen.
     Alleen de kleine resthoogte die te klein is voor nóg een volledige rij
     wordt daarna gelijkmatig over de zichtbare regels verdeeld. Daardoor geen
     halve rij, geen gepropte tabel en geen circulaire grafiekmeting. */
  aside.style.height=h+"px";
  const zichtbareRijen=tbody?[...tbody.children]:[];
  if(zichtbareRijen.length){
    const laatste=zichtbareRijen[zichtbareRijen.length-1].getBoundingClientRect();
    const rest=Math.max(0,grens-laatste.bottom-0.5);
    const extraPerZijde=Math.min(4.5,rest/(zichtbareRijen.length*2));
    if(extraPerZijde>0.01)aside.style.setProperty("--wiw-hour-row-pad-extra",extraPerZijde+"px");
  }
  aside.dataset.visibleHours=String(zichtbareRijen.length);`;
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
const KOP_OUD='if(kop&&S.dag==null&&rows.length)kop.textContent="De komende "+rows.length+" uur";';
const KOP_NIEUW='if(kop&&S.dag==null&&S.bereik===24)kop.textContent="Komende uren";';
const EERSTVOLGEND_OUD='if(r.marker){const m=document.createElement("span");m.className="wiw-hour-marker";m.textContent=r.marker;tijd.appendChild(m);}';
const EERSTVOLGEND_NIEUW='if(r.marker&&r.marker!=="Eerstvolgend"){const m=document.createElement("span");m.className="wiw-hour-marker";m.textContent=r.marker;tijd.appendChild(m);}';
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

  /* Grafiek en rijke uurweergave vormen samen één rustige module. De grafiek
     behoudt zijn natuurlijke hoogte; alleen het paneel volgt die hoogte. */
  .wiw-chart-layout{
    grid-template-columns:minmax(0,2.125fr) minmax(360px,1fr)!important;
    gap:clamp(22px,2.35vw,32px)!important;
    align-items:start!important;
    position:relative!important
  }
  .wiw-chart-main{width:100%!important;min-width:0!important;align-self:start!important}
  .wiw-hour-panel{
    position:static!important;
    width:auto!important;
    visibility:visible!important;
    pointer-events:auto!important;
    border-left:1px solid var(--rule)!important;
    padding-left:clamp(18px,1.7vw,24px)!important;
    align-self:start!important
  }

  /* Een expliciete 48-uurs-/zevendagenkeuze is een grafiekmodus. De verborgen
     technische uurkolom is daar niet nodig en wordt volledig uitgeschakeld. */
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

  /* Vijf visuele kolommen houden zeven betrouwbare waarden leesbaar: gevoel
     staat compact naast temperatuur; kans blijft onder de hoeveelheid. */
  .wiw-visually-hidden{position:absolute!important;width:1px!important;height:1px!important;padding:0!important;margin:-1px!important;overflow:hidden!important;clip:rect(0,0,0,0)!important;white-space:nowrap!important;border:0!important}
  #wiw-hour-panel h3{
    margin-top:0!important;
    margin-bottom:9px!important;
    font-size:20px!important;
    line-height:1.15!important
  }
  .wiw-hour-table{table-layout:fixed!important;font-size:12px!important}
  .wiw-hour-table th:nth-child(1),.wiw-hour-table td:nth-child(1){width:15%!important}
  .wiw-hour-table th:nth-child(2),.wiw-hour-table td:nth-child(2){width:9%!important;text-align:center!important}
  .wiw-hour-table th:nth-child(3),.wiw-hour-table td:nth-child(3){width:29%!important}
  .wiw-hour-table th:nth-child(4),.wiw-hour-table td:nth-child(4){width:25%!important}
  .wiw-hour-table th:nth-child(5),.wiw-hour-table td:nth-child(5){width:22%!important}
  .wiw-hour-table td{
    padding:calc(4px + var(--wiw-hour-row-pad-extra,0px)) 4px!important;
    line-height:1.12!important
  }
  .wiw-hour-table th{
    padding:5px 4px!important;
    line-height:1.1!important
  }
  .wiw-hour-table tbody tr:last-child td{border-bottom:0!important}
  .wiw-hour-time time,.wiw-hour-primary{display:block;color:var(--ink);font-family:var(--mono);font-variant-numeric:tabular-nums;white-space:nowrap}
  .wiw-hour-secondary{display:block;margin-top:2px;color:var(--ink-45);font-size:9.5px;line-height:1.1;white-space:nowrap}
  .wiw-hour-temp{white-space:nowrap!important}
  .wiw-hour-temp .wiw-hour-primary,.wiw-hour-temp .wiw-hour-secondary{display:inline!important}
  .wiw-hour-temp .wiw-hour-secondary{margin-top:0!important}
  .wiw-hour-temp .wiw-hour-secondary::before{content:" · "}
  .wiw-hour-date{display:block!important;margin:2px 0 0!important;font-size:9px!important;white-space:nowrap}
  .wiw-hour-weather-icon{display:inline-flex;width:22px;height:22px;align-items:center;justify-content:center}
  .wiw-hour-weather-icon svg{display:block;width:22px!important;height:22px!important}
  .wiw-hour-rain .wiw-hour-primary{color:var(--teal)}

  /* Nachtzicht blijft breed als sectie, maar de echte gegevens vormen één
     compacte leeslijn. Geen flexkolom mag de tussenruimte opslokken. */
  #nights .row.night{
    grid-template-columns:96px 58px minmax(190px,260px) 92px minmax(320px,480px)!important;
    column-gap:clamp(14px,1.45vw,20px)!important;
    justify-content:start!important
  }
}

@media(min-width:1366px){
  /* Acht rijke regels moeten op de kleinste contractdesktop binnen de
     natuurlijke grafiekhoogte passen. De 1px basispadding houdt de bestaande
     typografie intact; eventuele resthoogte wordt daarna verdeeld. */
  .wiw-hour-table td{
    padding:calc(1px + var(--wiw-hour-row-pad-extra,0px)) 4px!important
  }
}

@media(min-width:1366px) and (max-width:1499px){
  /* Op de kleinste desktopbreedtes winnen we de resterende vaste hoogte terug
     uit kop en tabelkop, niet uit de inhoudsregels. */
  #wiw-hour-panel h3{margin-bottom:5px!important}
  .wiw-hour-table th{padding:3px 4px!important}
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
  bron=vervangEen(bron,KOP_OUD,KOP_NIEUW,`${label} komende-uren-kop`);
  bron=vervangEen(bron,EERSTVOLGEND_OUD,EERSTVOLGEND_NIEUW,`${label} mobiel-eerstvolgend-label`);
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
  console.log(`Komende-urenrefinement toegepast op ${geraakt} weerartifacts (${geschreven} gewijzigd): natuurlijke desktopgrafiek links, rijke hoogtebegrensde uurtabel rechts, compacte Nachtzicht-kolommen, ongewijzigde lange grafiekmodi en mobiele uurweergave; cache ${cache}.`);
}

if(require.main===module)main();
module.exports={OUT,MARKER,STYLE_MARKER,STYLE,UREN_OUD,UREN_NIEUW,MM_OUD,MM_NIEUW,PANEL_HOOGTE_OUD,PANEL_HOOGTE_NIEUW,NU_OUD,NU_NIEUW,KOP_OUD,KOP_NIEUW,EERSTVOLGEND_OUD,EERSTVOLGEND_NIEUW,tel,htmlBestanden,vervangEen,voegStijlInHeadToe,pasTekstAan,main};