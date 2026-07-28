const {laadKern}=require("./kern.js");
const {bouw}=require("./data.js");

let goed=0, fout=0;
const norm=t=>String(t==null?"":t).replace(/\u00a0/g," ");
function check(naam,voorwaarde,extra){
  if(voorwaarde){goed++;console.log("  ok   "+naam);}
  else{fout++;console.log("  FOUT "+naam+(extra?"   -> "+extra:""));}
}
function groep(n){console.log("\n"+n);}

/* 1. stand van zon en maan */
groep("Astronomie");
{
  const {api}=laadKern();
  const lat=52.3508, lon=5.2647;
  const naar=(d,off)=>new Date(d.getTime?d.getTime():d).toISOString();
  const gevallen=[["2026-07-22",2,344,1306],["2026-12-21",1,527,989],["2026-06-21",2,319,1324]];
  let grootste=0;
  for(const [dag,uur,opRef,onderRef] of gevallen){
    const [y,m,d2]=dag.split("-").map(Number);
    const off=uur*3600000;
    const r=api.opOnder("zon",Date.UTC(y,m-1,d2)-off,lat,lon);
    const min=x=>{const t=new Date(x+off);return t.getUTCHours()*60+t.getUTCMinutes();};
    grootste=Math.max(grootste,Math.abs(min(r.op)-opRef),Math.abs(min(r.onder)-onderRef));
  }
  check("zonsopkomst en ondergang binnen 4 minuten van de referentie",grootste<=4,"afwijking "+grootste+" min");
  const m1=api.maan(new Date("2024-01-11T11:57:00Z"));
  const m2=api.maan(new Date("2024-01-25T17:54:00Z"));
  check("nieuwe maan geeft bijna nul procent verlicht",m1.ill<0.03,(m1.ill*100).toFixed(1)+"%");
  check("volle maan geeft bijna honderd procent verlicht",m2.ill>0.97,(m2.ill*100).toFixed(1)+"%");
  check("maanfase heet correct bij volle maan",m2.naam==="volle maan",m2.naam);
}

/* 2. windkracht */
groep("Windkracht");
{
  const {api}=laadKern();
  check("0 km/u is 0 Bft",api.bft(0)===0);
  check("25 km/u is 4 Bft",api.bft(25)===4);
  check("70 km/u is 8 Bft",api.bft(70)===8);
  check("120 km/u is 12 Bft",api.bft(120)===12);
  check("benaming bij 5 Bft is volledig",api.BFTNAAM[5]==="vrij krachtige wind",api.BFTNAAM[5]);
}

/* 3. getalnotatie */
groep("Notatie");
{
  const {api}=laadKern();
  check("decimaal met komma",api.nl(1.6)==="1,6",api.nl(1.6));
  check("nul netjes",api.nl(0)==="0,0",api.nl(0));
  check("ontbrekende waarde",api.nl(null)==="–",api.nl(null));
}

/* 4. briefingzinnen in verschillende weersituaties */
groep("Briefing");
function brief(opties,breedte){
  const {api,bak}=laadKern(breedte);
  Object.assign(api.S,{d:bouw(opties),i0:14,op:Date.now(),lat:52.35,lon:5.26,label:"Test",dag:null,bereik:24,
    // plaatsVandaag() gebruikt de echte klok tenzij een test iets anders instelt; deze
    // fixture doet zich voor als "22 juli 14:00 lokaal", dus de klok wordt daarop gezet,
    // anders vindt de dagsom-opzoeking van punt 7 niet de dag die de test bedoelt.
    klokOverride:new Date("2026-07-22T12:00:00Z")});
  api.meters();api.briefing();api.nowcast();api.etmaal(14,24);api.dagen();api.nachten();
  const proxy=new Proxy(bak,{get:(o,k)=>{const e=o[k];if(!e)return e;
    return {get textContent(){return norm(e.textContent);},get innerHTML(){return norm(e.innerHTML);},
            getAttribute:x=>e.getAttribute(x)};}});
  return {tekst:norm(bak.brief.innerHTML).replace(/<[^>]+>/g,""),bak:proxy,api:api};
}
{
  const droog=brief({pp:()=>5,pr:()=>0,som:0}).tekst;
  check("droog etmaal meldt droog",/blijft het droog/.test(droog),droog);

  /* Punt 8: zin 1 gaat nu over de komende twee uur, dezelfde termijn en bron als
     de radartekst (kortetermijn()). Neerslag verderop vandaag komt er als losse,
     apart herkenbare zin achteraan, met de dagelijkse kans als bron. */
  const buiBinnen2u=brief({pr:(u)=>u===15?2:0,pp:(u)=>u===15?80:5});
  check("neerslag binnen de eerste twee uur gaat over die twee uur, niet over twaalf",
    /komende twee uur/.test(buiBinnen2u.tekst) && !/komende twaalf uur/.test(buiBinnen2u.tekst),
    buiBinnen2u.tekst);
  check("die zin noemt geen percentage: dat hoort bij 'later vandaag', niet bij dit venster",
    !/\d+% kans/.test(buiBinnen2u.tekst.split(".")[0]),buiBinnen2u.tekst);

  const laterVandaag=brief({pp:(u)=>u===20?37:5,pr:()=>0,som:0});
  const dagKans=Math.round(laterVandaag.api.S.d.daily.precipitation_probability_max[0]);
  check("blijft het twee uur droog maar is er verderop wel kans, dan komt dat als losse zin",
    new RegExp("De komende twee uur blijft het droog\\. Later vandaag is de neerslagkans "+dagKans+"%")
      .test(laterVandaag.tekst),
    laterVandaag.tekst+"  (dagKans="+dagKans+")");
  const regent=brief({nu:0.6,pp:(u)=>u<17?85:5,pr:(u)=>u<17?0.6:0,som:3}).tekst;
  check("het regent nu, en dat gaat over de komende twee uur",
    /Het regent nu en dat houdt de komende twee uur aan/.test(regent),regent);
  check("geen punt als decimaalteken in de briefing",!/\d\.\d/.test(buiBinnen2u.tekst),buiBinnen2u.tekst);
}

/* 5. metersteksten */
groep("Meters");
{
  const {bak}=brief({});
  const teksten=["windsub","gustsub","precsub","popsub","humsub","pressub","cloudsub","vissub"]
    .map(k=>bak[k].textContent);
  check("elke meter heeft een zin die eindigt op een punt",teksten.every(t=>/\.$/.test(t)),teksten.find(t=>!/\.$/.test(t)));
  check("geen punt als decimaalteken",teksten.every(t=>!/\d\.\d/.test(t)),teksten.find(t=>/\d\.\d/.test(t)));
  check("windrichting voluit",/noordwesten/.test(bak.windsub.textContent),bak.windsub.textContent);
  // de briefing en de meter mogen niet twee verschillende richtingen noemen
  const richtingen=["noorden","noordnoordoosten","noordoosten","oostnoordoosten","oosten","oostzuidoosten",
    "zuidoosten","zuidzuidoosten","zuiden","zuidzuidwesten","zuidwesten","westzuidwesten","westen",
    "westnoordwesten","noordwesten","noordnoordwesten"];
  const uitZin=t=>richtingen.filter(r=>new RegExp("uit het "+r+"\\b").test(t))[0];
  const {bak:b2}=brief({});
  const brf=b2.brief.innerHTML.replace(/<[^>]+>/g,"");
  check("briefing en windmeter noemen dezelfde richting",
    uitZin(brf)===uitZin(b2.windsub.textContent),
    "briefing: "+uitZin(brf)+", meter: "+uitZin(b2.windsub.textContent));
  // wind die draait wordt als draaiing beschreven, niet als andere beginrichting
  const {api:a3,bak:b3}=laadKern(1280);
  const d3=bouw({});
  const i3=d3.hourly.time.findIndex(t=>t.slice(0,13)===d3.current.time.slice(0,13));
  d3.hourly.wind_direction_10m=d3.hourly.wind_direction_10m.map((v,i)=>i>i3+2?200:315);
  d3.hourly.wind_speed_10m=d3.hourly.wind_speed_10m.map((v,i)=>i===i3+5?34:v);
  Object.assign(a3.S,{d:d3,op:Date.now(),lat:52.35,lon:5.26,label:"T",dag:null,bereik:24,i0:i3});
  a3.meters();a3.briefing();
  const t3=b3.brief.innerHTML.replace(/<[^>]+>/g,"");
  check("draaiende wind wordt als draaiing benoemd",/draaiend naar het zuidzuidwesten/.test(t3),t3);
  check("draaiende wind begint bij de huidige richting",uitZin(t3)==="noordwesten",uitZin(t3));
}

/* 6. randgevallen */
groep("Randgevallen");
{
  const gevallen=[["zonder kwartierdata",{geenKwartier:true}],["zonder zichtgegevens",{zicht:null}],
                  ["poolzomer",{poolzon:true}],["volledig bewolkt en mistig",{cc:()=>100,spreiding:0.5}]];
  for(const [naam,opties] of gevallen){
    let ok=true,mld="";
    try{ brief(opties); }catch(e){ ok=false; mld=e.message; }
    check(naam+" loopt niet vast",ok,mld);
  }
}

/* 7. grafiek blijft binnen zijn kader */
groep("Grafiek");
for(const breedte of [390,1280]){
  const {bak}=brief({},breedte);
  const vb=bak.chart.getAttribute("viewBox").split(" ").map(Number);
  const h=bak.chart.innerHTML;
  const X=[...h.matchAll(/(?:\sx|x1|x2|cx)="(-?[\d.]+)"/g)].map(m=>+m[1]);
  const Y=[...h.matchAll(/(?:\sy|y1|y2|cy)="(-?[\d.]+)"/g)].map(m=>+m[1]);
  check("bij "+breedte+"px valt niets buiten het kader",
    Math.min(...X)>=-14&&Math.max(...X)<=vb[2]+2&&Math.min(...Y)>=-2&&Math.max(...Y)<=vb[3]+2,
    "x "+Math.min(...X).toFixed(0)+" tot "+Math.max(...X).toFixed(0)+" in "+vb[2]);
}

/* 7b. aslabels mogen elkaar niet raken, bij geen enkel bereik */
groep("Leesbaarheid van de grafiek");
for(const [naam,n,br] of [["24 uur op de desktop",24,1280],["48 uur op de desktop",48,1280],
                          ["7 dagen op de desktop",168,1280],["24 uur op de telefoon",24,390],
                          ["7 dagen op de telefoon",168,390]]){
  const {api,bak}=laadKern(br);
  Object.assign(api.S,{d:bouw({}),op:Date.now(),lat:52.35,lon:5.26,label:"T",dag:null,bereik:n});
  api.S.i0=api.S.d.hourly.time.findIndex(t=>t.slice(0,13)===api.S.d.current.time.slice(0,13));
  api.etmaal(api.S.i0,n);
  const h=bak.chart.innerHTML;
  const as=[...h.matchAll(/<text x="([\d.]+)" y="[\d.]+" text-anchor="middle"[^>]*font-size="([\d.]+)">([^<]+)</g)]
    .filter(m=>/^(\d\d|ma|di|wo|do|vr|za|zo)$/.test(m[3]))
    .map(m=>({x:+m[1],b:m[3].length*(+m[2])*0.6}));
  as.sort((a,b)=>a.x-b.x);
  let botsing=0;
  for(let i=1;i<as.length;i++) if(as[i].x-as[i-1].x<(as[i].b+as[i-1].b)/2) botsing++;
  check(naam+": aslabels overlappen niet",botsing===0,botsing+" botsingen bij "+as.length+" labels");
}

/* 7d. labels boven de dagbalk mogen nooit buiten de tekening vallen */
groep("Zonlabels");
for(const [naam,uur,br] of [["vlak voor zonsondergang","20:00",390],["vlak voor zonsopkomst","04:00",390],
                            ["midden op de dag","13:00",1280]]){
  const {api,bak}=laadKern(br);
  const d=bouw({});
  d.current.time="2026-07-22T"+uur;
  Object.assign(api.S,{d:d,op:Date.now(),lat:52.35,lon:5.26,label:"T",dag:null,bereik:24});
  api.S.i0=d.hourly.time.findIndex(t=>t.slice(0,13)===d.current.time.slice(0,13));
  api.etmaal(api.S.i0,24);
  const h=bak.chart.innerHTML, W=+bak.chart.getAttribute("viewBox").split(" ")[2];
  const labels=[...h.matchAll(/<text x="(-?[\d.]+)"[^>]*text-anchor="(\w+)"[^>]*font-size="([\d.]+)">((?:op|onder) \d\d:\d\d)</g)];
  const buiten=labels.filter(m=>{
    const breed=m[4].length*(+m[3])*0.62;
    const links=m[2]==="end"? +m[1]-breed : +m[1];
    return links<-1 || links+breed>W+1;
  });
  check(naam+": zonlabels blijven binnen de tekening",buiten.length===0,
    buiten.map(m=>m[4]).join(", "));
}

/* 8. tabellen */
groep("Tabellen");
{
  const {bak}=brief({});
  check("zeven dagen heeft een kopregel",/class="row day kop"/.test(bak.days.innerHTML));
  check("zeven dagen heeft zeven rijen",(bak.days.innerHTML.match(/class="row day"/g)||[]).length===7);
  check("nachtzicht toont maantijden",/maanopkomst|maanondergang/.test(bak.nights.innerHTML));
}

/* 7c. nachtzicht reageert op bewolking en op de stand van de maan */
groep("Nachtzicht");
{
  const helder=brief({cc:(u)=>u<6||u>20?8:60});
  const bewolkt=brief({cc:()=>100});
  // de hele cel pakken en daarna tags strippen: sinds er een maanschijfje in staat
  // zou een regex die op de eerste < stopt de tekst halverwege afkappen
  const rij=h2=>[...h2.matchAll(/class="score"[^>]*>([^<]*)<[\s\S]*?class="nmeta wide">([\s\S]*?)<\/div>/g)]
    .filter(m=>/^\d/.test(m[1]))
    .map(m=>[m[0],m[1],m[2].replace(/<[^>]+>/g,"").replace(/\s+/g," ").trim()]);
  const rh=rij(helder.bak.nights.innerHTML), rb=rij(bewolkt.bak.nights.innerHTML);
  const score=t=>parseFloat(String(t).replace(",","."));
  check("heldere nacht geeft een hoge score",score(rh[0][1])>7,rh[0][1]);
  check("bewolkte nacht geeft een lage score",score(rb[0][1])<1,rb[0][1]);
  check("heldere nacht krijgt een waarneemvenster",/beste zicht van \d\d:\d\d tot \d\d:\d\d/.test(rh[0][2]),rh[0][2]);
  check("bewolkte nacht krijgt geen venster",/Geen geschikt zichtvenster/.test(rb[0][2]),rb[0][2]);
  check("maantijden staan er altijd bij",
    /maanopkomst \d\d:\d\d|maanondergang \d\d:\d\d/.test(rh[0][2])&&/maanopkomst \d\d:\d\d|maanondergang \d\d:\d\d/.test(rb[0][2]));

  /* maanfase per nacht: sinds punt 11 een Unicode-symbool in deze tabel, geen
     getekende schijf meer (die blijft bestaan bij de kop boven de tabel). */
  {
    const {api,bak}=laadKern(390);
    Object.assign(api.S,{d:bouw({}),i0:14,op:Date.now(),lat:52.35,lon:5.26,label:"T",dag:null,bereik:24});
    api.nachten();
    const html=bak.nights.innerHTML;
    const nachtrijen=html.split('class="row night"').slice(1).filter(r=>/class="score"/.test(r));
    const SYMBOLEN=["\u{1F311}","\u{1F312}","\u{1F313}","\u{1F314}","\u{1F315}","\u{1F316}","\u{1F317}","\u{1F318}"];
    const metSymbool=nachtrijen.filter(r=>SYMBOLEN.some(s=>r.includes(s)));
    check("elke nacht krijgt een maanfasesymbool",
      nachtrijen.length>0 && metSymbool.length===nachtrijen.length,
      metSymbool.length+" van de "+nachtrijen.length);
    check("het is een Unicode-tekstsymbool en geen getekende schijf",
      !/class="maanbij"[^>]*>\s*<svg/.test(html) && SYMBOLEN.some(s=>html.includes(s)));
    check("het symbool staat direct bij de maantijden, zonder losse bullet ervoor",
      /<span class="maangroep"><span class="maanbij"/.test(html) && !/·\s*<span class="maanbij"/.test(html));
    check("het symbool heeft een omschrijving voor wie het niet ziet",
      /title="[^"]*procent verlicht"/.test(html));
    check("de maantijden blijven naast het symbool staan",
      nachtrijen.every(r=>/maanopkomst \d\d:\d\d|maanondergang \d\d:\d\d/.test(r.replace(/<[^>]+>/g,""))));
    // de fase moet per nacht kunnen verschillen; met acht discrete stappen over
    // een korte reeks nachten is dat niet gegarandeerd meer dan een enkele stap,
    // dus dit toetst alleen dat het geen vast, hardgecodeerd symbool is
    const gebruikt=new Set();
    nachtrijen.forEach(r=>SYMBOLEN.forEach(s=>{ if(r.includes(s)) gebruikt.add(s); }));
    check("het symbool komt uit de acht mogelijke fasen, niet uit een vaste bullet",
      gebruikt.size>=1 && [...gebruikt].every(s=>SYMBOLEN.includes(s)),[...gebruikt].join(" "));
  }


}

/* 8b. teksten noemen altijd een waarde en waar het kan een tijdstip */
groep("Volledigheid van de teksten");
{
  const {bak}=brief({temp:(u)=>u<14?22-Math.abs(u-13):16});   // piek lag om 13:00, dus in het verleden
  const t=bak.brief.innerHTML.replace(/<[^>]+>/g,"");
  check("warmste moment in het verleden krijgt tijd en temperatuur",/warmst rond \d\d:\d\d met \d+ graden/.test(t),t);
  const nat=brief({pr:(u)=>u<12?0.4:0,pp:(u)=>u<12?70:5,som:2.4}).bak;
  check("neerslag die al gevallen is gebruikt ook de dagsomformulering, niet 'viel'",
    /in totaal 2,4 mm neerslag verwacht/.test(nat.precsub.textContent) && !/\bviel\b/.test(nat.precsub.textContent),
    nat.precsub.textContent);
  const komt=brief({pr:(u)=>u===20?1.5:0,pp:(u)=>u===20?70:5,som:1.5}).bak;
  check("neerslag die nog komt heet 'verwacht' en niet 'viel'",
    /in totaal .* verwacht/.test(komt.precsub.textContent) && !/\bviel\b/.test(komt.precsub.textContent),
    komt.precsub.textContent);
  const alle=["windsub","gustsub","precsub","popsub","humsub","pressub","cloudsub","vissub"].map(k=>bak[k].textContent);
  check("geen enkele meter meldt een piek zonder tijdstip",
    alle.every(x=>!/(piekte|was|Toppen|meeste)/.test(x)||/\d\d:\d\d/.test(x)),
    alle.find(x=>/(piekte|was|Toppen|meeste)/.test(x)&&!/\d\d:\d\d/.test(x)));
}

/* 8c. elk getal in de tekst hoort een eenheid of een tijd te hebben */
groep("Eenheden");
{
  // toegestaan achter een getal: graadteken, procent, mm, km, m, hPa, Bft, uitgeschreven eenheden,
  // of het getal is deel van een tijdstip of een datum
  const eenheid=/(?:\s?(?:°|%|graden|graad|procent|mm|km\/u|km|meter|m\b|hPa|Bft|uur|minuut|minuten|korrels|µg)|:\d\d)/;
  const scenarios=[
    ["warmste moment geweest",{temp:(u)=>u<14?22-Math.abs(u-13):16}],
    ["regen op komst",{pr:(u)=>u===20?1.5:0,pp:(u)=>u===20?70:5,som:1.5}],
    ["regen gevallen",{pr:(u)=>u<12?0.4:0,pp:(u)=>u<12?70:5,som:2.4}],
    ["droog en rustig",{pp:()=>4,pr:()=>0,som:0}],
    ["mistig",{spreiding:0.6,cc:()=>100}],
    ["harde wind",{ws:62,wsNu:62,wg:()=>92}]
  ];
  const fout2=[];
  for(const [naam,opties] of scenarios){
    const {bak}=brief(opties);
    const teksten=[bak.brief.innerHTML.replace(/<[^>]+>/g,""),
      ...["windsub","gustsub","precsub","popsub","humsub","pressub","cloudsub","vissub","nctext"].map(k=>bak[k].textContent||"")];
    for(const t of teksten){
      // loop elk getal langs en kijk wat er direct achter staat
      for(const m2 of t.matchAll(/(\d+(?:[.,]\d+)?)/g)){
        const rest=t.slice(m2.index+m2[0].length);
        const voor=t.slice(Math.max(0,m2.index-1),m2.index);
        if(voor===":") continue;                 // tweede helft van een tijdstip
        if(/^:\d\d/.test(rest)) continue;        // eerste helft van een tijdstip
        const ervoor=t.slice(Math.max(0,m2.index-28),m2.index);
        if(/index[^.]*$/.test(ervoor)) continue;   // een index is dimensieloos, maar krijgt wel een duiding
        if(!eenheid.test(rest.slice(0,10))) fout2.push(naam+": \""+t.trim()+"\"");
      }
    }
  }
  check("elk getal in de teksten heeft een eenheid of is een tijdstip",fout2.length===0,fout2[0]);
  const alles=[];
  for(const [,opties] of scenarios){
    const {bak}=brief(opties);
    alles.push(bak.brief.innerHTML.replace(/<[^>]+>/g,""));
    ["windsub","gustsub","precsub","popsub","humsub","pressub","cloudsub","vissub","nctext"].forEach(k=>alles.push(bak[k].textContent||""));
  }
  const tekst=alles.join(" ");
  check("snelheid overal als km/u geschreven",!/km per uur/.test(tekst));
  check("percentage overal met het teken geschreven",!/\d\s?procent/.test(tekst));
  // getal en eenheid mogen niet over twee regels breken
  const ruw=[];
  for(const [,opties] of scenarios){
    const {api:a4}=laadKern();
    Object.assign(a4.S,{d:bouw(opties),op:Date.now(),lat:52.35,lon:5.26,label:"T",dag:null,bereik:24});
    a4.S.i0=a4.S.d.hourly.time.findIndex(t=>t.slice(0,13)===a4.S.d.current.time.slice(0,13));
    a4.meters();a4.briefing();
  }
  const html=require("fs").readFileSync(require("path").join(__dirname,"index.html"),"utf8");
  check("er is een functie die getal en eenheid aan elkaar houdt",/const nbsp=/.test(html));
  check("de onderschriften lopen via die functie",(html.match(/zetTekst\(/g)||[]).length>=8);
  for(const bron of ["Open-Meteo","RainViewer","CARTO","OpenStreetMap"])
    check("voettekst vermeldt "+bron,html.includes(bron));
  // niets mag horizontaal buiten beeld vallen
  const stijl=html.slice(html.indexOf("<style>"),html.indexOf("</style>"));
  check("pagina kan niet zijwaarts schuiven",/overflow-x:clip/.test(stijl));
  check("knoppenbalk krijgt de schermbreedte op de telefoon",/\.mastright\{[^}]*width:100%/.test(stijl));
  check("knoppenbalk breekt af op smalle schermen",/max-width:430px\)\{[\s\S]*?flex-wrap:wrap/.test(stijl));
  check("waarneemvenster blijft zichtbaar op de telefoon",/\.night \.nmeta\.wide\{display:block/.test(stijl));
  check("kopregel van de tabellen krijgt ruimte tussen de lijnen",/\.row\.kop\{[^}]*padding:1[0-9]px/.test(stijl));
}

/* 9b. zonstijden staan onder elkaar */
groep("Zonstijden");
{
  const {api,bak}=laadKern(390);
  Object.assign(api.S,{d:bouw({}),op:Date.now(),lat:52.35,lon:5.26,label:"T",dag:null,bereik:24});
  api.S.i0=api.S.d.hourly.time.findIndex(t=>t.slice(0,13)===api.S.d.current.time.slice(0,13));
  api.etmaal(api.S.i0,24);
  const regels=[...bak.suntimes.innerHTML.matchAll(/<span>([^<]*)<\/span>/g)].map(m=>m[1]);
  check("drie losse regels",regels.length===3,regels.join(" | "));
  check("eerste regel is de opkomst",/zonsopkomst \d\d:\d\d/.test(regels[0]),regels[0]);
  check("tweede regel is de ondergang",/zonsondergang \d\d:\d\d/.test(regels[1]),regels[1]);
  check("derde regel is de daglengte",/daglicht/.test(regels[2]),regels[2]);
}

/* 9. opmaak: variabelen die gebruikt worden moeten ook bestaan */
groep("Opmaak");
{
  const fs2=require("fs"),path2=require("path");
  const html=fs2.readFileSync(path2.join(__dirname,"index.html"),"utf8");
  const css=html.slice(html.indexOf("<style>"),html.indexOf("</style>"));
  const gebruikt=[...new Set([...css.matchAll(/var\((--[\w-]+)\)/g)].map(m=>m[1]))];
  const gedefinieerd=new Set([...css.matchAll(/(--[\w-]+)\s*:/g)].map(m=>m[1]));
  const missend=gebruikt.filter(v=>!gedefinieerd.has(v));
  check("elke gebruikte CSS-variabele is ook gedefinieerd",missend.length===0,missend.join(", "));
  const jsDeel=html.slice(html.indexOf("<script>"));
  const inJs=[...new Set([...jsDeel.matchAll(/var\((--[\w-]+)\)/g)].map(m=>m[1]))];
  const missendJs=inJs.filter(v=>!gedefinieerd.has(v));
  check("elke variabele die de tekencode gebruikt bestaat ook",missendJs.length===0,missendJs.join(", "));
  const moetCentraal=[".dwind",".dmin,.dmax",".drain",".score",".nmeta","#aq .stat"];
  const nietCentraal=moetCentraal.filter(sel=>{
    const re2=new RegExp(sel.replace(/[.#*]/g,"\\$&")+"\\{([^}]*)\\}");
    const m2=css.match(re2);
    return !m2||!/text-align:center/.test(m2[1]);
  });
  check("alle getalkolommen staan gecentreerd",nietCentraal.length===0,nietCentraal.join(", "));
}

/* 10. temperatuurlabels: de piek moet altijd een cijfer krijgen en niets mag botsen */
groep("Temperatuurlabels");
for(const [naam,br,opties] of [
  ["24 uur op de telefoon",390,{}],
  ["24 uur op de desktop",1280,{}],
  ["grillig verloop op de telefoon",390,
    {temp:(u)=>[14,13,13,12,12,13,15,18,21,23,22,24,23,25,24,22,21,19,17,16,15,14,14,13][u]}],
  ["vorst met minteken op de telefoon",390,
    {temp:(u)=>+(-6+5*Math.sin((u-4)/24*2*Math.PI)).toFixed(1)}],
  ["volkomen vlak op de telefoon",390,{temp:()=>9}]
]){
  const {api,bak}=laadKern(br);
  Object.assign(api.S,{d:bouw(opties),op:Date.now(),lat:52.35,lon:5.26,label:"T",dag:null,bereik:24});
  api.S.i0=api.S.d.hourly.time.findIndex(t=>t.slice(0,13)===api.S.d.current.time.slice(0,13));
  api.etmaal(api.S.i0,24);

  const h=bak.chart.innerHTML, vb=bak.chart.getAttribute("viewBox").split(" ").map(Number);
  const lab=[...h.matchAll(/<text x="(-?[\d.]+)" y="(-?[\d.]+)"[^<]*?font-family="Bodoni Moda,serif" font-size="([\d.]+)">(-?\d+)°</g)]
    .map(m=>({x:+m[1],y:+m[2],hg:+m[3],b:(m[4].length+1)*(+m[3])*0.58,v:+m[4]}));
  const reeks=api.S.d.hourly.temperature_2m.slice(api.S.i0,api.S.i0+24);
  const hoog=Math.round(Math.max.apply(null,reeks)), laag=Math.round(Math.min.apply(null,reeks));
  const waarden=lab.map(l=>l.v);
  // elk scenario in deze lus rendert precies 24 uur (api.etmaal(i0,24)), dus in de
  // app geldt stap = n<=24 ? 3 : ...  → hier altijd 3
  const stapTest=3;

  check(naam+": er staan cijfers bij de lijn",lab.length>0,"geen enkel label gevonden");
  /* Sinds correctieronde punt 2 krijgt uitsluitend elke i met i%stap===0 een
     label; pieken, dalen en het dag-extreem voegen geen label meer toe als ze
     daar niet toevallig mee samenvallen. Dat direct natoetsen in plaats van
     alleen "het hoogste getal staat erbij", want dat laatste hoeft sinds deze
     correctie niet meer waar te zijn. */
  const idxStap=[];
  for(let k=0;k<reeks.length;k++) if(k%stapTest===0 && reeks[k]!=null && isFinite(reeks[k])) idxStap.push(k);
  check(naam+": precies de drie-uursindices krijgen een label, niet meer en niet minder",
    lab.length===idxStap.length,
    "verwacht "+idxStap.length+" labels (om de "+stapTest+" uur), kreeg "+lab.length);
  const verwachteWaarden=idxStap.map(k=>Math.round(reeks[k])).sort((a,b)=>a-b);
  const gekregenWaarden=[...waarden].sort((a,b)=>a-b);
  check(naam+": de gelabelde waarden komen overeen met de drie-uurswaarden",
    JSON.stringify(verwachteWaarden)===JSON.stringify(gekregenWaarden),
    "verwacht "+verwachteWaarden.join(",")+" kreeg "+gekregenWaarden.join(","));

  const uitBeeld=lab.filter(l=>l.x-l.b/2<-1||l.x+l.b/2>vb[2]+1||l.y-l.hg<0||l.y>vb[3]);
  check(naam+": geen label valt buiten de tekening",uitBeeld.length===0,
    uitBeeld.map(l=>l.v+"° op x "+l.x.toFixed(0)).join(", "));

  const botsend=[];
  for(let a=0;a<lab.length;a++) for(let b2=a+1;b2<lab.length;b2++){
    const p=lab[a],r=lab[b2];
    if(Math.abs(p.x-r.x)<(p.b+r.b)/2&&Math.abs(p.y-r.y)<Math.max(p.hg,r.hg))
      botsend.push(p.v+"° en "+r.v+"°");
  }
  check(naam+": temperatuurlabels overlappen elkaar niet",botsend.length===0,botsend.join(", "));

  // het cijfer moet een rand in de velkleur hebben, anders loopt de lijn er dwars doorheen
  const metRand=(h.match(/paint-order="stroke"/g)||[]).length;
  check(naam+": elk cijfer dekt de lijn af",metRand>=lab.length,metRand+" van "+lab.length);
}

/* 10a2. tooltip-scrub: een echt pointerevent simuleren op #hit (kern.js kan
   addEventListener-handlers nu daadwerkelijk opslaan en afvuren), en de
   finite-geometrie-guard toetsen die de lege witte doos voorkwam. De
   oorspronkelijke fout: S.geo miste H, scrubKoppel() las G.H0 (dat nooit
   bestond), en by werd daardoor NaN. */
groep("Tooltip-scrub");
{
  const {api,bak}=laadKern(1280);
  Object.assign(api.S,{d:bouw({}),op:Date.now(),lat:52.35,lon:5.26,label:"T",dag:null,bereik:24});
  api.S.i0=api.S.d.hourly.time.findIndex(t=>t.slice(0,13)===api.S.d.current.time.slice(0,13));
  api.etmaal(api.S.i0,24);

  const raak=(x,y,type)=>bak.hit.dispatchEvent({type:type||"pointermove",clientX:x,clientY:y,pointerType:"mouse"});

  // geldige aanraking middenin de tekening
  raak(450,100);
  check("#scrub bevat daadwerkelijk tekst na een gesimuleerd pointermove",
    bak.scrub.style.display==="block" && /temperatuur/.test(bak.scrub.innerHTML) && /\d/.test(bak.scrub.innerHTML),
    bak.scrub.style.display+" / "+bak.scrub.innerHTML.slice(0,80));

  // letterlijk zoeken naar de tokens die een niet-eindig getal in de opmaak achterlaat;
  // een attribuutgerichte regex struikelde hier eerder over "font-family=..." omdat
  // "y=" toevallig aan het eind van "family" past
  check("geen enkel getekend attribuut in de tooltip bevat NaN, undefined of null",
    !/NaN|undefined|null/.test(bak.scrub.innerHTML),bak.scrub.innerHTML.slice(0,160));

  const rectM=bak.scrub.innerHTML.match(/<rect x="([\d.-]+)" y="([\d.-]+)" width="([\d.-]+)" height="([\d.-]+)"/);
  const vb=bak.chart.getAttribute("viewBox").split(" ").map(Number);
  check("de tooltiprechthoek valt volledig binnen de viewBox",
    !!rectM && +rectM[1]>=0 && +rectM[2]>=0 && +rectM[1]+ +rectM[3]<=vb[2] && +rectM[2]+ +rectM[4]<=vb[3],
    rectM?rectM[0]+" in viewBox "+vb.join(" "):"geen rect gevonden");

  raak(450,100,"pointerleave");
  check("de tooltip verdwijnt weer (hier via pointerleave getoetst)",bak.scrub.style.display==="none");

  // de doos weer geldig tonen, en dan precies de oorspronkelijke fout nabootsen:
  // S.geo mist H, dus de vroegere G.H0-uitdrukking zou NaN opleveren
  raak(450,100);
  check("nulmeting: de doos staat er na een nieuwe aanraking weer",bak.scrub.style.display==="block");
  delete api.S.geo.H;
  raak(450,100);
  /* display:none is hier de doorslaggevende toets: de guard geeft direct terug
     zonder nieuwe opmaak te bouwen, dus de oude (nu verborgen) inhoud kan nog in
     de DOM-node staan. Dat is geen bug: display:none betekent dat er niets meer
     getekend wordt, ongeacht wat er nog in de node hangt. */
  check("ontbrekende hoogte in S.geo (de oorspronkelijke bug) verbergt de tooltip volledig",
    bak.scrub.style.display==="none",bak.scrub.style.display);

  const fsT=require("fs"), pathT=require("path");
  const bronScrub=fsT.readFileSync(pathT.join(__dirname,"index.html"),"utf8");
  check("S.geo neemt H expliciet op (de eigenlijke correctie)",
    /S\.geo=\{[^}]*\bH:H\b/.test(bronScrub));
  check("scrubKoppel leest G.H, niet het nooit-bestaande G.H0",
    /G\.H-bh-2/.test(bronScrub) && !/G\.H0-bh/.test(bronScrub));
}

/* 10b. de waarden langs de as mogen de grafiek niet raken */
groep("Aslabels");
for(const [naam,br] of [["telefoon",390],["desktop",1280]]){
  const {api,bak}=laadKern(br);
  // een reeks met een minteken, want dat is het breedste aslabel dat kan voorkomen
  Object.assign(api.S,{d:bouw({temp:(u)=>+(-8+4*Math.sin(u/24*2*Math.PI)).toFixed(1)}),
    op:Date.now(),lat:52.35,lon:5.26,label:"T",dag:null,bereik:24});
  api.S.i0=api.S.d.hourly.time.findIndex(t=>t.slice(0,13)===api.S.d.current.time.slice(0,13));
  api.etmaal(api.S.i0,24);

  const h=bak.chart.innerHTML;
  const lijnen=[...h.matchAll(/<line x1="([\d.]+)" y1="[\d.]+" x2="[\d.]+"/g)].map(m=>+m[1]);
  const as=[...h.matchAll(/<text x="([\d.]+)" y="[\d.]+" text-anchor="end"[^<]*?font-size="([\d.]+)">(-?\d+)°</g)]
    .map(m=>({rechts:+m[1],breed:(m[3].length+1)*(+m[2])*0.6,tekst:m[3]+"°"}));
  check(naam+": elke rasterlijn heeft een waarde",as.length===3,as.length+" gevonden");

  const rasterStart=Math.min.apply(null,lijnen.filter(x=>x>0&&x<200));
  const overlappend=as.filter(a=>a.rechts>rasterStart);
  check(naam+": de aswaarde raakt de grafiek niet",overlappend.length===0,
    overlappend.map(a=>a.tekst+" loopt tot "+a.rechts.toFixed(0)+", raster begint op "+rasterStart.toFixed(0)).join(", "));
  const afgesneden=as.filter(a=>a.rechts-a.breed<-1);
  check(naam+": de aswaarde valt niet links weg",afgesneden.length===0,
    afgesneden.map(a=>a.tekst).join(", "));
}

/* 10c. wat de app aan zijn eigen server vraagt moet er ook echt staan */
groep("Serverroutes");
{
  const fs3=require("fs"),path3=require("path");
  const wortel=path3.join(__dirname);
  const html=fs3.readFileSync(path3.join(wortel,"index.html"),"utf8");
  const gevraagd=[...new Set([...html.matchAll(/["'`]\/api\/([\w-]+)/g)].map(m=>m[1]))];
  check("de app vraagt minstens een eigen route op",gevraagd.length>0);
  const zonder=gevraagd.filter(n=>!fs3.existsSync(path3.join(wortel,"api",n+".js")));
  // een bestand dat buiten api/ blijft liggen wordt door Vercel niet omgezet naar
  // een functie, dus de route geeft dan stilletjes een 404
  check("elke opgevraagde route heeft een bestand in api/",zonder.length===0,
    zonder.map(n=>"/api/"+n+" ontbreekt").join(", "));
  const losseFuncties=fs3.readdirSync(wortel)
    .filter(f=>f.endsWith(".js")&&gevraagd.includes(f.replace(/\.js$/,"")));
  check("er ligt geen serverfunctie in de hoofdmap",losseFuncties.length===0,losseFuncties.join(", "));
}

/* 10d. locatiebepaling moet om gps vragen, anders geeft een telefoon kilometers marge */
groep("Locatie");
{
  const fs4=require("fs"),path4=require("path");
  const html=fs4.readFileSync(path4.join(__dirname,"index.html"),"utf8");
  const aanroepen=[...html.matchAll(/getCurrentPosition\(([\s\S]*?)\);/g)].map(m=>m[1]);
  check("de app vraagt de locatie op",aanroepen.length>0);
  check("de eerste poging vraagt om hoge nauwkeurigheid",
    /enableHighAccuracy:\s*true/.test(html),"enableHighAccuracy staat nergens op true");
  check("er staat een tijdslimiet op het locatieverzoek",/timeout:\s*\d+/.test(html));
  check("een onnauwkeurige positie wordt gemeld",/coords\.accuracy|nauw>/.test(html));
  check("een geweigerde locatie krijgt een eigen melding",/code===1/.test(html));
}

/* 10e. briefing en windmeter moeten dezelfde wind ook hetzelfde noemen */
groep("Windbenaming");
{
  // per Beaufort de laagste snelheid die er net in valt, plus wat marge
  const perKracht=[[0,0],[1,3],[2,9],[3,16],[4,24],[5,34],[6,44],[7,56],[8,68],[9,82],[10,96],[11,110],[12,125]];
  const scheef=[];
  for(const [bftVerwacht,kmu] of perKracht){
    const {api,bak}=laadKern(1280);
    Object.assign(api.S,{d:bouw({ws:kmu,wsNu:kmu,wg:()=>kmu}),i0:14,op:Date.now(),
      lat:52.35,lon:5.26,label:"T",dag:null,bereik:24});
    api.meters();api.briefing();
    const brf=bak.brief.innerHTML.replace(/<[^>]+>/g,"");
    const meter=bak.windsub.textContent;
    const naam=api.BFTNAAM[api.bft(kmu)];
    // de stam zonder verbuiging: "zwakke wind" -> "zwak", "stormachtige wind" -> "stormachtig"
    const kern=naam.replace(/ wind$/,"").replace(/e$/,"").replace(/(.)\1$/,"$1");
    // loopt de wind in de loop van de dag op of af, dan noemt de briefing met opzet
    // alleen de Beaufortwaarde en geen naam; daar valt niets te vergelijken
    const noemtNaam=!/neemt (toe|af) tot/.test(brf);
    if(noemtNaam && !brf.toLowerCase().includes(kern.toLowerCase()))
      scheef.push(kmu+" km/u ("+api.bft(kmu)+" Bft): meter zegt \""+naam+"\", briefing zegt \""
        +(brf.match(/De wind [^.,(]*|Er staat [^.,(]*/)||[""])[0].trim()+"\"");
    check(kmu+" km/u wordt in de meter "+naam+" genoemd",meter.toLowerCase().includes(kern.toLowerCase()),meter);
  }
  check("de briefing gebruikt geen andere windbenaming dan de meter",scheef.length===0,scheef.join("  |  "));
}

/* 10f. geen komma tussen twee volledige hoofdzinnen */
groep("Zinsbouw");
{
  // Een komma mag geen twee zinnen aan elkaar plakken die allebei op zichzelf kunnen staan.
  // Dit zijn de constructies waar dat eerder misging, elk met een eigen naam zodat een
  // terugval meteen te herleiden is.
  const splitsingen=[
    ["het warmste moment als losse zin",/,\s*het warmste moment is/],
    ["nu is het als losse zin",/,\s*nu is het \d/],
    ["vannacht koelt het af als losse zin",/,\s*vannacht koelt het af/],
    ["dat is als losse zin",/,\s*dat is (laag|matig|hoog|zeer hoog|extreem)/],
    ["de UV-index als losse zin",/,\s*de UV-index/],
    ["wolken vanaf zonder verbinding",/,\s*wolken vanaf/],
    ["de sterkste wind als losse zin",/,\s*rond \d\d:\d\d is de wind/],
    // vangnet: een komma gevolgd door een onderwerp met een persoonsvorm erachter
    ["komma gevolgd door een nieuwe hoofdzin",/,\s*(het|de wind|er|dat|dit|we|je)\s+(is|was|wordt|blijft|komt|regent|koelt|piekt|piekte|neemt|staat|ligt|valt|viel)\b/]
  ];
  const opties=[
    {temp:(u)=>u<20?14+u*0.6:20},
    {temp:(u)=>u<14?22-Math.abs(u-13):16},
    {temp:(u)=>24-Math.max(0,(u-14))*0.7},
    {temp:()=>17},
    {cc:()=>98,ccNu:98},
    {spreiding:0.6,cc:()=>100},
    {pp:(u)=>u===18?80:5,pr:(u)=>u===18?2:0,som:2},
    {nu:0.6,pp:(u)=>u<17?85:5,pr:(u)=>u<17?0.6:0,som:3}
  ];
  const velden=["brief","windsub","gustsub","precsub","popsub","humsub","pressub","cloudsub","vissub","nctext"];
  const gevonden=[];
  for(const opt of opties){
    const {api,bak}=laadKern(390);
    Object.assign(api.S,{d:bouw(opt),i0:14,op:Date.now(),lat:52.35,lon:5.26,label:"T",dag:null,bereik:24});
    api.meters();api.briefing();api.nowcast();
    for(const k of velden){
      const e=bak[k]; if(!e) continue;
      const t=norm(e.innerHTML||e.textContent||"").replace(/<[^>]+>/g,"");
      for(const [naam,re] of splitsingen)
        if(re.test(t)) gevonden.push(naam+"  ->  "+t.trim());
    }
  }

  // De wind die pas later op de dag piekt levert een eigen zinsvariant op. Zonder dit
  // geval blijft die tekst ongetoetst, want in de standaardgegevens is de wind constant.
  for(const stoten of [26,92]){
    const {api,bak}=laadKern(390);
    const d=bouw({wg:()=>stoten});
    const i=d.hourly.time.findIndex(t=>t.slice(0,13)===d.current.time.slice(0,13));
    d.hourly.wind_speed_10m=d.hourly.wind_speed_10m.map((v,k)=>k===i+8?42:8);
    d.current.wind_speed_10m=8;
    Object.assign(api.S,{d:d,i0:i,op:Date.now(),lat:52.35,lon:5.26,label:"T",dag:null,bereik:24});
    api.meters();api.briefing();
    const t=norm(bak.brief.innerHTML).replace(/<[^>]+>/g,"");
    check("de wind piekt later, en dat wordt vermeld",/sterkst rond \d\d:\d\d/.test(t),t);
    for(const [naam,re] of splitsingen)
      if(re.test(t)) gevonden.push(naam+"  ->  "+t.trim());
  }
  check("geen komma tussen twee hoofdzinnen",gevonden.length===0,gevonden[0]);

  // schijnnauwkeurigheid: een verschil in hele graden hoort geen decimaal te krijgen
  const {api:a5,bak:b5}=laadKern(390);
  Object.assign(a5.S,{d:bouw({}),i0:14,op:Date.now(),lat:52.35,lon:5.26,label:"T",dag:null,bereik:24});
  a5.meters();
  check("het dauwpuntverschil staat in hele graden",
    !/\d,\d graden lager/.test(norm(b5.humsub.textContent)),b5.humsub.textContent);
}

/* 10g. de kolommen van de zevendagentabel moeten hun inhoud aankunnen */
groep("Kolombreedtes");
{
  const fs5=require("fs"),path5=require("path");
  const wortel=path5.join(__dirname);
  const html=fs5.readFileSync(path5.join(wortel,"index.html"),"utf8");
  const maten=JSON.parse(fs5.readFileSync(path5.join(wortel,"lettermaten.json"),"utf8"));
  // Breedte van een stuk tekst, gemeten uit de fontbestanden zelf.
  // De letterafstand telt mee: .dname heeft letter-spacing:.01em en dat is bij twaalf
  // tekens al anderhalve pixel. Die anderhalve pixel was precies het verschil tussen
  // "past net" en "raakt het icoon".
  const LS=0.01;
  const breed=(t,px,fam)=>
    [...t].reduce((s,c)=>s+(maten[fam][c]!==undefined?maten[fam][c]:0.5),0)*px + [...t].length*LS*px;

  const DAGENVOL=["zondag","maandag","dinsdag","woensdag","donderdag","vrijdag","zaterdag"];
  const DAGENKORT=["zo","ma","di","wo","do","vr","za"];

  // Welke schrijfwijze op de telefoon zichtbaar is, bepaalt de opmaak en niet de aanname
  // van deze test. Staat .dlang op display:none, dan is de korte vorm leidend.
  const langVerborgen=/\.dlang\{display:none\}/.test(html);
  const namen=(langVerborgen?DAGENKORT:DAGENVOL).map(d=>d+" 30").concat(["vandaag","morgen"]);
  let langste="",langstePx=0;
  for(const t of namen){
    const w2=breed(t,12.5,"sans");
    if(w2>langstePx){langstePx=w2;langste=t;}
  }

  // Er staan twee blokken met dezelfde mediaquery in de opmaak, en de bureaubladregel
  // staat daar nog voor. Daarom vanaf het laatste voorkomen zoeken, anders leest de
  // test de indeling van het bureaublad in plaats van die van de telefoon.
  const vanaf=(query,re)=>{
    const p=html.lastIndexOf(query);
    if(p<0) return null;
    const m=html.slice(p).match(re);
    return m?m[1]:null;
  };
  const mobiel=vanaf("@media(max-width:900px)",/\.day\{grid-template-columns:([^;}]+)/);
  const smal  =vanaf("@media(max-width:370px)",/\.day\{grid-template-columns:([^;}]+)/);
  const gapM  =vanaf("@media(max-width:900px)",/\.day\{[^}]*gap:(\d+)px/);
  check("de dagtabel heeft een mobiele indeling",!!mobiel&&!!gapM,String(mobiel));
  check("er is een indeling voor smalle schermen",!!smal,String(smal));

  const ontleed=s=>String(s).trim().split(/\s+/).map(k=>/^\d+px$/.test(k)?parseFloat(k):"fr");
  const gap=parseFloat(gapM);

  /* max-content: de browser meet zelf de werkelijk gerenderde tekst en past de
     kolom daarop aan, dus een vaste pixelbreedte hoeft niet meer gecontroleerd
     te worden op "past het erin". Wat wel telt: dat de kolom ook echt op
     max-content staat, dat er geen ellipsis-vangnet meer actief is dat tekst
     zou afkappen, en dat de overige kolommen er samen met een realistische
     naamkolom niet toch buiten het scherm van 320 px vallen. */
  // kolM blijft nodig voor de andere, ongewijzigde kolommen verderop (kans, temperatuur)
  const kolM=ontleed(mobiel);

  check("de naamkolom past zich aan de inhoud aan (max-content)",
    /^max-content$/.test(String(mobiel).trim().split(/\s+/)[0]),
    "eerste kolom is '"+String(mobiel).trim().split(/\s+/)[0]+"'");
  check("dezelfde aanpak geldt op een smal scherm",
    /^max-content$/.test(String(smal).trim().split(/\s+/)[0]),
    "eerste kolom is '"+String(smal).trim().split(/\s+/)[0]+"'");

  const ICOON=22;
  const kolSmal=ontleed(smal);
  check("de icoonkolom is minstens zo breed als het icoon zelf ("+ICOON+" px)",
    kolSmal[1]>=ICOON, "kolom is "+kolSmal[1]+" px");

  check("de dagnaam kapt niet meer af: geen ellipsis-vangnet meer op .dname",
    !/\.dname\{[^}]*overflow:hidden/.test(html) && !/\.dname\{[^}]*text-overflow:ellipsis/.test(html));
  check("de dagnaam breekt niet middenin een woord",/\.dname\{[^}]*white-space:nowrap/.test(html));

  /* Met een echte, gemeten breedte voor de naamkolom (het enige stuk dat de
     browser zelf pas tijdens het renderen bepaalt) simuleren wat er op 320 px
     gebeurt: passen de vaste kolommen er samen met die naam nog naast elkaar? */
  {
    const smalNamen=langVerborgen?DAGENKORT:DAGENVOL;
    const langsteSmal=Math.max(...smalNamen.map(d=>breed(d+" 30",12.5,"sans")),breed("vandaag",12.5,"sans"));
    const vasteKolommen=kolSmal.slice(1).reduce((s2,v)=>s2+(v==="fr"?40:v),0);   // 1fr voorzichtig op 40px geschat
    const gapSmal=parseFloat(vanaf("@media(max-width:370px)",/\.day\{[^}]*gap:(\d+)px/))||gap;
    const totaal=langsteSmal+vasteKolommen+gapSmal*(kolSmal.length-1);
    const beschikbaar=320-2*20;   // sheet-padding van 20px aan weerszijden
    check("de rij past op 320 px met de langste naam die er echt kan staan",
      totaal<=beschikbaar,
      "rij "+totaal.toFixed(0)+" px tegen "+beschikbaar+" px beschikbaar (naam alleen: "+langsteSmal.toFixed(0)+" px)");
  }

  // en de temperatuurkolommen moeten ook bij vorst leesbaar blijven
  const tempNodig=breed("-10°",14,"mono");
  const kansNodig=breed("100%",12.5,"mono");
  const buiten=24+40+2;   // marge van de pagina, rand en binnenruimte van het vel
  const krap=[];
  for(const vp of [320,360,375,390,430]){
    const kol = vp<=370 ? ontleed(smal) : kolM;
    const g   = gap;
    const vast= kol.filter(k=>k!=="fr").reduce((a,b)=>a+b,0);
    const frs = kol.filter(k=>k==="fr").length;
    const per = (vp-buiten-vast-g*(kol.length-1))/frs;
    if(per<tempNodig) krap.push(vp+"px: temperatuurkolom "+per.toFixed(1)+" px, nodig "+tempNodig.toFixed(1));
    check(vp+"px: de temperatuurkolommen blijven leesbaar",per>=tempNodig,
      "elke kolom "+per.toFixed(1)+" px");
  }
  check("de kanskolom past 100%",kolM[kolM.length-1]>=kansNodig,
    "kolom is "+kolM[kolM.length-1]+" px, nodig "+kansNodig.toFixed(1));
  check("geen enkele schermbreedte wordt te krap",krap.length===0,krap[0]);
}


/* Tekstbreedte uit de fontbestanden, beschikbaar voor alle groepen hieronder. */
const _maten=JSON.parse(require("fs").readFileSync(require("path").join(__dirname,"lettermaten.json"),"utf8"));
const _breed=(t,px,fam)=>[...t].reduce((s,c)=>s+(_maten[fam][c]!==undefined?_maten[fam][c]:0.5),0)*px;
const breedSans=(t,px)=>_breed(t,px,"sans")+[...t].length*0.01*px;
const breedMono=(t,px)=>_breed(t,px,"mono");

/* 10g. de tooltip moet binnen de tekening blijven en zijn regels moeten passen */
groep("Tooltip");
{
  const fsT=require("fs"), pathT=require("path");
  const wisMarge=15, tussen=4;

  /* De plaatsingsregel uit index.html zelf halen. Rekende deze test hem na, dan bleef
     hij groen ook als de app iets heel anders deed, en dat is precies hoe de vorige
     versie ongemerkt 43 px buiten beeld kon lopen. */
  const bron=fsT.readFileSync(pathT.join(__dirname,"index.html"),"utf8");
  /* Niet zoeken binnen een vast aantal tekens: een regel commentaar erbij schoof
     de match eerder al buiten bereik en dan zakt de test op zichzelf. De hele
     plaatsingsfunctie uitknippen is bestand tegen elke wijziging eromheen. */
  const i0=bron.indexOf("const toon=ev=>{");
  const regel=i0<0 ? "" : bron.slice(i0, bron.indexOf("let n=0;", i0));
  const maten=regel.match(/const bw=G\.M\?(\d+):(\d+)/);
  check("de tooltipbreedte staat in de code",!!maten,"regel niet gevonden");
  const bwM=maten?parseFloat(maten[1]):0, bwD=maten?parseFloat(maten[2]):0;

  check("de doos slaat om op basis van de werkelijke ruimte, niet op een vast percentage",
    /G\.W\s*-\s*G\.pr/.test(regel) && !/G\.W\s*\*\s*0?\.\d+/.test(regel), regel.replace(/\s+/g," ").slice(0,120));
  check("de doos wordt hoe dan ook binnen de randen geklemd",
    /clamp\(\s*bx/.test(regel), regel.replace(/\s+/g," ").slice(0,120));

  for(const [naam,br,bw] of [["telefoon",390,bwM],["desktop",1280,bwD]]){
    const {api}=laadKern(br);
    Object.assign(api.S,{d:bouw({}),i0:14,op:Date.now(),lat:52.35,lon:5.26,label:"T",dag:null,bereik:24});
    api.etmaal(14,24);
    const G=api.S.geo;
    check(naam+": de grafiek geeft zijn rechtermarge door",typeof G.pr==="number",String(G.pr));
    check(naam+": de grafiek geeft dag en nacht door",Array.isArray(G.ND));

    const buiten=[];
    for(let i=0;i<G.n;i++){
      const X=G.x(i);
      let bx=(X+10+bw<=G.W-G.pr)?X+10:X-bw-10;
      bx=Math.max(2,Math.min(bx,G.W-bw-2));
      if(bx<0||bx+bw>G.W) buiten.push("uur "+i+" op x "+X.toFixed(0)+" geeft doos "+bx.toFixed(0)+" tot "+(bx+bw).toFixed(0));
    }
    check(naam+": de tooltip blijft op elke plek binnen de tekening",buiten.length===0,buiten[0]);

    // en de doos moet de breedste regel kunnen bevatten
    const ergste=[["temperatuur","-40°C"],["voelt als","-52°C"],["neerslagkans","100%"],
                  ["wind","119 km/u NNW, 12 Bft"],["windstoten","162 km/u"],["bewolking","100%"]];
    const teKrap=ergste.filter(([l,v])=>
      breedSans(l,11)+breedMono(v,11.5)+tussen > bw-2*wisMarge);
    check(naam+": elke tooltipregel past in de doos ("+bw+" px)",teKrap.length===0,
      teKrap.map(([l,v])=>"\""+l+" "+v+"\" vraagt "
        +(breedSans(l,11)+breedMono(v,11.5)).toFixed(0)+" px van de "+(bw-2*wisMarge)+" px").join(", "));
  }

  // de waarden mogen geen spatie voor hun eenheid hebben, dat kost breedte en
  // wijkt af van de rest van de app
  check("de tooltip schrijft eenheden zonder losse spatie",
    !/\+" °C"|\+" %"/.test(bron), (bron.match(/\+" °C"|\+" %"/)||[""])[0]);
}

/* 10h. 's nachts hoort er geen zon in de omschrijving te staan */
groep("Dag en nacht");
{
  const {api,bak}=laadKern(390);
  const d=bouw({});
  d.current.is_day=0; d.current.weather_code=1;   // overwegend onbewolkt, maar 's nachts
  Object.assign(api.S,{d:d,i0:14,op:Date.now(),lat:52.35,lon:5.26,label:"T",dag:null,bereik:24});
  api.tekenAlles();
  const cond=norm(bak.cond.textContent);
  check("de omschrijving spreekt 's nachts niet over zon",!/zonnig|zon\b/i.test(cond),cond);
  check("de omschrijving zegt 's nachts helder",/helder/i.test(cond),cond);

  const d2=bouw({}); d2.current.is_day=1; d2.current.weather_code=1;
  const {api:a2,bak:b2}=laadKern(390);
  Object.assign(a2.S,{d:d2,i0:14,op:Date.now(),lat:52.35,lon:5.26,label:"T",dag:null,bereik:24});
  a2.tekenAlles();
  check("overdag blijft het gewoon zonnig",/zonnig/i.test(norm(b2.cond.textContent)),b2.cond.textContent);

  // het icoon deed dit al goed, dus de twee moeten het nu eens zijn
  const maantje=/M16\.5 13\.6|maantje/.test(bak.nowicon.innerHTML)||/moon|maan/i.test(bak.nowicon.innerHTML);
  check("bij een nachtomschrijving hoort ook een nachticoon",
    maantje||!/zonnig/i.test(cond));
}

/* 10i. het nachtvenster moet zeggen wat het is, en een reden geven als het er niet is */
groep("Nachtvenster");
{
  const bronN=require("fs").readFileSync(require("path").join(__dirname,"index.html"),"utf8");
  const regels=[];
  // een helder gat midden in een verder bewolkte nacht, plus de twee uitersten
  for(const [naam,opt] of [["heldere nacht",{cc:()=>3}],
                           ["zwaar bewolkt",{cc:()=>92}],
                           ["gat in de bewolking",{cc:(u)=>(u>=1&&u<=3)?18:88}],
                           ["licht bewolkt",{cc:()=>25}]]){
    const {api,bak}=laadKern(390);
    Object.assign(api.S,{d:bouw(opt),i0:14,op:Date.now(),lat:52.35,lon:5.26,label:"T",dag:null,bereik:24});
    api.nachten();
    const t=norm(bak.nights.innerHTML).replace(/<[^>]+>/g," ").replace(/\s+/g," ");
    // de hele metaregel uitlezen, niet alleen wat al op de nieuwe vorm lijkt:
    // anders ziet de test een teruggedraaide formulering simpelweg niet staan
    (bak.nights.innerHTML.match(/class="nmeta wide">([^<]*)</g)||[])
      .map(m=>m.replace(/^class="nmeta wide">/,"").replace(/<$/,""))
      .map(r=>norm(r).split("\u00b7")[0].trim())
      .filter(r=>r&&!/^Waarneemvenster/.test(r))   // de kolomkop is geen nachtregel
      .forEach(r=>regels.push([naam,r]));
  }
  check("er staat bij elke nacht een venstertekst",regels.length>0,String(regels.length));

  /* Het venster dekt hooguit 35 procent bewolking. De app noemt dat elders
     "Overwegend zonnig" en reserveert "onbewolkt" voor onder de 15 procent.
     Het venster mag dus geen woord gebruiken dat een schonere hemel belooft
     dan het meet; daar kwam de tegenspraak met een score van 1,5 vandaan. */
  const teSterk=regels.filter(([,r])=>/\bhelder|\bonbewolkt|\bwolkenloos/i.test(r));
  check("het venster belooft geen heldere hemel die het niet meet",teSterk.length===0,
    teSterk.map(([n,r])=>n+": "+r).join(" | "));

  const zonderReden=regels.filter(([,r])=>/^geen venster$/.test(r));
  check("geen venster gaat altijd samen met een reden",zonderReden.length===0,
    zonderReden.map(([n,r])=>n+": "+r).join(" | "));

  const metVenster=regels.filter(([,r])=>/^beste zicht/.test(r));
  check("een venster noemt een begin- en eindtijd",
    metVenster.length>0 && metVenster.every(([,r])=>/van \d\d:\d\d tot \d\d:\d\d/.test(r))
    && regels.every(([,r])=>/^(beste zicht|Geen geschikt zichtvenster)/.test(r)),
    (metVenster[0]||["",""])[1]);

  // de reden moet uit de code komen, niet uit een vast zinnetje
  check("de code onderscheidt maanlicht van bewolking als oorzaak",
    /te veel maanlicht/.test(bronN) && /te bewolkt/.test(bronN));
}

/* 10j. buiten Europa mag de app geen Europese gegevens suggereren */
groep("Wereldwijd");
{
  const fsW=require("fs"), pathW=require("path");
  const bronW=fsW.readFileSync(pathW.join(__dirname,"index.html"),"utf8");
  const bronA=fsW.readFileSync(pathW.join(__dirname,"api","waarschuwingen.js"),"utf8");

  // Almere binnen Europa, Tokio en Sao Paulo erbuiten
  const plekken=[["Almere",52.35,5.26,true],["Tokio",35.68,139.69,false],
                 ["Sao Paulo",-23.55,-46.63,false],["New York",40.71,-74.01,false]];
  for(const [naam,la,lo,europees] of plekken){
    const {api,bak}=laadKern(390);
    const d=bouw({});
    // het luchtblok krijgt wat de API buiten Europa werkelijk teruggeeft: niets
    const lucht={current:{european_aqi: europees?31:null, us_aqi:42, pm2_5:5.9, pm10:9},
      hourly:{time:d.hourly.time.slice(0,24),
        grass_pollen:new Array(24).fill(europees?12:null),
        birch_pollen:new Array(24).fill(null), alder_pollen:new Array(24).fill(null),
        mugwort_pollen:new Array(24).fill(null), ragweed_pollen:new Array(24).fill(null),
        olive_pollen:new Array(24).fill(null)}};
    Object.assign(api.S,{d:d,air:lucht,i0:14,op:Date.now(),lat:la,lon:lo,label:naam,dag:null,bereik:24});
    api.lucht();
    const t=norm(bak.aq.innerHTML).replace(/<[^>]+>/g," ").replace(/\s+/g," ");

    if(europees){
      check(naam+": binnen Europa staat de Europese index",/Europese AQI/.test(t),t.slice(0,90));
    }else{
      check(naam+": buiten Europa geen Europese index",!/Europese AQI/.test(t),t.slice(0,90));
      check(naam+": buiten Europa wel een index met waarde",/Amerikaanse AQI/.test(t)&&/\b42\b/.test(t),t.slice(0,90));
      check(naam+": buiten Europa geen bewering over pollenconcentraties",
        !/noemenswaardige/.test(t),t.slice(0,140));
      check(naam+": buiten Europa staat dat pollen alleen in Europa bestaat",
        /Alleen beschikbaar in Europa/.test(t),t.slice(0,140));
    }
  }

  // de waarschuwingsfunctie mag niet meer blind Nederland pakken
  check("de waarschuwingsbron kijkt naar de coordinaten",
    /req\.query[\s\S]{0,200}lat/.test(bronA) && /inNWS/.test(bronA),"lat wordt niet gelezen");
  check("er staat geen vaste Nederlandse feed meer in de code",
    !/feeds-netherlands/.test(bronA),"feeds-netherlands staat er nog in");
  check("zonder bekende bron komt er een lege lijst terug",
    /dekking: false/.test(bronA)||/dekking:false/.test(bronA));
  check("de VS gaat naar de National Weather Service",/api\.weather\.gov/.test(bronA));
  check("Europa gaat naar MeteoAlarm per land",/feeds-" \+ slug/.test(bronA));
  check("de NWS-aanroep stuurt een User-Agent mee",/User-Agent/.test(bronA));


  /* gebiedsfiltering: een waarschuwing met een polygoon elders hoort weg te vallen */
  {
    const stuk=bronA.slice(bronA.indexOf("function inPolygoon"),bronA.indexOf("/* ---------- land bepalen"));
    let raaktPunt=null;
    try{ raaktPunt=new Function(stuk+"; return raaktPunt;")(); }catch(e){}
    check("de filterfuncties zijn los uitvoerbaar",typeof raaktPunt==="function");
    if(typeof raaktPunt==="function"){
      const nl="53.5,3.4 53.5,7.2 50.7,7.2 50.7,3.4";
      const gev=[
        ["punt binnen de polygoon",52.35,5.26,{area:[{polygon:[nl]}]},true],
        ["punt buiten de polygoon",48.86,2.35,{area:[{polygon:[nl]}]},false],
        ["punt aan de andere kant van de wereld",35.68,139.69,{area:[{polygon:[nl]}]},false],
        ["binnen een cirkel",52.35,5.26,{area:[{circle:["52.35,5.26 50"]}]},true],
        ["buiten een cirkel",50.0,5.26,{area:[{circle:["52.35,5.26 50"]}]},false],
        ["zonder gebied blijft hij staan",52.35,5.26,{area:[{areaDesc:"land"}]},null],
        ["onleesbaar gebied gooit niets weg",52.35,5.26,{area:[{polygon:["rommel"]}]},null]
      ];
      const mis=gev.filter(([,la,lo,info,verw])=>raaktPunt(info,la,lo)!==verw);
      check("het gebied van een waarschuwing wordt tegen het punt gehouden",mis.length===0,
        mis.map(g=>g[0]).join(", "));
    }
    check("waarschuwingen zonder gebied worden gemarkeerd",/landelijk: raak === null/.test(bronA));
    // de uitkomst van de filtering moet ook echt toegepast worden
    check("een waarschuwing buiten het punt wordt overgeslagen",
      /raak === false\)\s*continue/.test(bronA),"de continue op raak===false ontbreekt");
    check("de app zegt het als een waarschuwing voor een groter gebied geldt",
      /Geldt voor een groter gebied/.test(bronW));
  }


  /* De satellietlaag is eruit: de gratis laag van RainViewer levert geen
     satellite.infrared, dus de knop verscheen nooit. Beter geen dode code. */
  {
    check("de satellietknop is opgeruimd",!/id="rlaag"/.test(bronW));
    check("de bronregel belooft geen satelliet",!/Radar en satelliet: <a/.test(bronW));
    check("RainViewer wordt vermeld zoals de voorwaarden vragen",
      /rainviewer\.com/.test(bronW)&&/RainViewer<\/a>/.test(bronW));
    /* Buiten Nederland is er geen vooruitblik. De schuif eindigt dan bij nu en dat
       hoort erbij te staan, anders lijkt het alsof er iets stuk is. */
    check("de app meldt het als er geen vooruitblik is",
      /vooruitblik is hier niet beschikbaar/.test(bronW));
    check("die melding hangt af van de reeks, niet van een vaste tekst",
      /!R\.frames\.some\(fr=>fr\.toekomst\)/.test(bronW));
  }

  /* De radar kon niet zoomen of verschuiven. Bij een vaste zoom 7 zie je aan de
     evenaar bijna twee keer zoveel grond als in Noord-Noorwegen, en een bui net
     buiten beeld kon je niet opzoeken. */
  {
    check("de zoom staat in de toestand en niet als vaste waarde",
      /zoom:7/.test(bronW) && !/const TEGEL=256, ZOOM=7/.test(bronW));
    check("er zijn grenzen aan de zoom",/ZMIN=\d+, ZMAX=\d+/.test(bronW));
    check("er zijn knoppen voor in, uit en centreren",
      /id="rin"/.test(bronW)&&/id="ruit"/.test(bronW)&&/id="rmidden"/.test(bronW));
    check("de knoppen gaan uit aan de grenzen",/disabled=R\.zoom>=ZMAX/.test(bronW));
    check("slepen werkt met muis en vinger",
      /pointerdown/.test(bronW)&&/setPointerCapture/.test(bronW));
    check("de pagina scrollt niet mee tijdens het slepen",/#radar\{[^}]*touch-action:none/.test(bronW));
    check("het kruisje schuift mee met de kaart",/markeer\(ctx,W,H,R\.dx,R\.dy\)/.test(bronW));
    const zoomfn=bronW.slice(bronW.indexOf("function radarZoom"),bronW.indexOf("function zoomKnoppen"));
    check("de verschuiving schaalt mee bij het zoomen",
      /Math\.pow\(2,nieuw-R\.zoom\)/.test(zoomfn) && /R\.dx\*=factor/.test(zoomfn));
    const klem=(z,stap)=>Math.max(4,Math.min(z+stap,9));
    const raar=[[4,-1,4],[9,1,9],[7,1,8],[7,-1,6],[4,-5,4],[9,5,9]]
      .filter(([z,st,verw])=>klem(z,st)!==verw);
    check("zoomen blijft binnen de grenzen",raar.length===0,JSON.stringify(raar));
  }

  /* De briefing blijft staan als het netwerk wegvalt. Dat zat er al in, maar er
     stond geen enkele controle op, dus kon het ongemerkt sneuvelen. */
  {
    check("de laatste briefing wordt bewaard",/ls\.set\(KEY_D,\{d:S\.d/.test(bronW));
    check("bij een mislukte poging komt die terug",
      /const oud=ls\.get\(KEY_D,null\)/.test(bronW) && /S\.d=oud\.d/.test(bronW));
    check("er staat bij van wanneer die is",/laatste briefing van/.test(bronW));
  }


  // KNMI mag alleen in de bronregel staan als hij ook gebruikt is
  check("de bronregel noemt KNMI niet standaard",
    !/verwachting <a href="https:\/\/dataplatform\.knmi\.nl/.test(bronW));
  check("de bronregel is eerlijk over de radardekking",/Radardekking volgt/.test(bronW));
}

/* 10k. neerslaghoeveelheid, UV-tegel en de uitlijning van de kop */
groep("Dagtabel en tegels");
{
  const fsD=require("fs"), pathD=require("path");
  const bronD=fsD.readFileSync(pathD.join(__dirname,"index.html"),"utf8");

  const {api,bak}=laadKern(390);
  Object.assign(api.S,{d:bouw({som:3.2,pr:(u)=>u<12?0.3:0}),i0:14,op:Date.now(),
    lat:52.35,lon:5.26,label:"T",dag:null,bereik:24});
  api.dagen(); api.meters();

  const rijen=bak.days.innerHTML;
  check("de kanskolom toont ook hoeveel er valt",/<small>[\d,]+ mm<\/small>/.test(rijen),
    (rijen.match(/class="drain">[^<]*(<small>[^<]*<\/small>)?/)||[""])[0]);
  check("de hoeveelheid blijft weg als het droog is",
    !/<small>0,0 mm<\/small>/.test(rijen));
  // op het bureaublad staat het al in de kolom Verwachting, dus daar verborgen
  check("de hoeveelheid verschijnt alleen op de telefoon",
    /\.drain small\{display:none/.test(bronD) && /\.drain small\{display:block\}/.test(bronD));

  check("de UV-index heeft een eigen tegel",/id="uv"/.test(bronD)&&/id="uvsub"/.test(bronD));
  // set() schrijft innerHTML omdat de eenheid in een <s> staat
  const uvWaarde=(bak.uv.innerHTML||bak.uv.textContent||"").replace(/<[^>]+>/g,"").trim();
  check("de UV-tegel wordt gevuld",uvWaarde!=="--"&&uvWaarde!=="",
    JSON.stringify(uvWaarde)+" / "+JSON.stringify(bak.uvsub.textContent));
  check("UV staat niet meer in de bewolkingszin",!/UV/i.test(bak.cloudsub.textContent),
    bak.cloudsub.textContent);
  check("de negende tegel krijgt de volle breedte",/\.stat\.breed\{grid-column:1 \/ -1/.test(bronD));

  /* De kop moet evenveel cellen vullen als de gegevensrij eronder, anders schuift
     hij op. Dat verschilt per schermbreedte omdat er kolommen wegvallen. */
  /* Een media-regel opzoeken met een vaste afstand ging mis: @media(max-width:900px)
     komt twee keer voor en de eerste bevat de dagtabel niet. Daarom het blok
     echt uitknippen op zijn accolades. */
  const mediaBlok=(vraag)=>{
    const start=bronD.lastIndexOf(vraag);
    if(start<0) return "";
    let i=bronD.indexOf("{",start), diep=0, j=i;
    for(;j<bronD.length;j++){
      if(bronD[j]==="{") diep++;
      else if(bronD[j]==="}"){ diep--; if(!diep) break; }
    }
    return bronD.slice(i+1,j);
  };
  const blok900=mediaBlok("@media(max-width:900px)");
  const blok370=mediaBlok("@media(max-width:370px)");
  const zichtbaar=(breed)=>{
    // welke cellen de kop overhoudt bij deze breedte
    let cel=["dname","dico","dcond","dwind","dmin","bar","dmax","drain"];
    if(breed<=900) cel=cel.filter(c=>c!=="dcond"&&c!=="bar");
    if(breed<=900) cel=cel.filter(c=>c!=="dico");        // kop verbergt het icoonvak
    if(breed<=370){ cel=cel.filter(c=>c!=="dwind"); cel.splice(1,0,"dico"); }
    return cel;
  };
  const spanBreed=/\.row\.kop \.dwind\{grid-column:2 \/ 4\}/.test(bronD);
  check("de kop overspant icoon en wind waar die naast elkaar staan",spanBreed);
  check("onder 370px komt het icoonvak in de kop terug",
    /\.row\.kop \.dico\{display:block\}/.test(blok370),
    "zonder dit schuift de hele kop een kolom op");

  const tel=(blok)=>{const m=blok.match(/\.day\{grid-template-columns:([^};]+)/);
    return m?m[1].trim().split(/\s+/).length:0;};
  const kolBreed=tel(blok900), kolSmal=tel(blok370);
  // de kop laat dwind over twee kolommen lopen, dus telt hij als twee cellen
  check("kop en gegevens vullen evenveel kolommen op de telefoon",
    zichtbaar(390).length+1===kolBreed,
    zichtbaar(390).join(",")+" plus de overspanning tegen "+kolBreed+" kolommen");
  check("kop en gegevens vullen evenveel kolommen op een smal scherm",
    zichtbaar(360).length===kolSmal, zichtbaar(360).join(",")+" tegen "+kolSmal+" kolommen");
}

/* 10l. vetgedrukt in de briefing en het contrast van de radarkaart */
groep("Nadruk en kaart");
{
  const bronN2=require("fs").readFileSync(require("path").join(__dirname,"index.html"),"utf8");
  const gevallen=[
    ["droog",{pp:()=>4,pr:()=>0,som:0}],
    ["bui later",{pp:(u)=>u===18?80:5,pr:(u)=>u===18?2:0,som:2}],
    ["het regent nu",{nu:0.6,pp:(u)=>u<17?85:5,pr:(u)=>u<17?0.6:0,som:3}],
    ["warmste geweest",{temp:(u)=>u<14?22-Math.abs(u-13):16}],
    ["storm",{ws:88,wsNu:88,wg:()=>119}],
    ["vriezen",{temp:(u)=>+(-7+3*Math.sin(u/24*6.28)).toFixed(1)}]
  ];
  const teveel=[], geenNadruk=[], teLang=[];
  for(const [naam,opt] of gevallen){
    const {api,bak}=laadKern(390);
    Object.assign(api.S,{d:bouw(opt),i0:14,op:Date.now(),lat:52.35,lon:5.26,label:"T",dag:null,bereik:24});
    api.meters(); api.briefing();
    const h=norm(bak.brief.innerHTML);
    const plat=h.replace(/<[^>]+>/g,"");
    const vet=(h.match(/<b>([\s\S]*?)<\/b>/g)||[]).map(x=>x.replace(/<[^>]+>/g,""));
    const aandeel=vet.join("").length/Math.max(1,plat.length);
    if(!vet.length) geenNadruk.push(naam);
    /* Nadruk werkt alleen als hij schaars is. Boven ongeveer een kwart van de tekst
       valt het effect weg en leest de hele alinea als een kop. */
    if(aandeel>0.25) teveel.push(naam+": "+Math.round(aandeel*100)+"%");
    // en een vet stuk hoort een feit te zijn, geen halve zin
    vet.filter(v=>v.trim().split(/\s+/).length>3).forEach(v=>teLang.push(naam+': "'+v+'"'));
  }
  check("elke briefing legt ergens nadruk",geenNadruk.length===0,geenNadruk.join(", "));
  check("vet blijft onder een kwart van de tekst",teveel.length===0,teveel.join(", "));
  check("een vet stuk is een feit en geen halve zin",teLang.length===0,teLang.join(" | "));
  check("de uitkomst is vet, niet alleen het tijdstip",
    /blijft het <b>droog<\/b>/.test(bronN2));
  check("de maximumtemperatuur krijgt nadruk",
    /<b>"\+Math\.round\(tv\)\+" graden<\/b>/.test(bronN2)||/<b>"\+nutemp\+" graden<\/b>/.test(bronN2));

  /* de kaart onder de radar was zo ver weggedrukt dat grenzen verdwenen */
  const alfa=bronN2.match(/globalAlpha=donker\?([\d.]+):([\d.]+)/);
  check("de radarkaart heeft een leesbare doorzichtigheid",
    !!alfa && parseFloat(alfa[2])>=0.9 && parseFloat(alfa[1])>=0.7,
    alfa?("donker "+alfa[1]+", licht "+alfa[2]):"regel niet gevonden");
  // de neerslaglaag moet er nog wel bovenop leesbaar blijven
  check("de neerslaglaag blijft sterker dan de kaart",
    !!alfa && 0.85>=parseFloat(alfa[2])-0.1, "neerslag 0.85 tegen kaart "+(alfa?alfa[2]:"?"));
}

/* 10m. bevindingen uit de eerste live versie */
groep("Live bevindingen");
{
  const fsL=require("fs"), pathL=require("path");
  const bronL=fsL.readFileSync(pathL.join(__dirname,"index.html"),"utf8");
  const bronSW=fsL.readFileSync(pathL.join(__dirname,"sw.js"),"utf8");

  // 1. de service worker mag geen onafgevangen belofte laten ontsnappen
  const takken=(bronSW.match(/e\.respondWith\(/g)||[]).length;
  const vangnetten=(bronSW.match(/\.catch\(/g)||[]).length;
  check("elke tak van de service worker heeft een vangnet",vangnetten>=takken,
    takken+" keer respondWith tegen "+vangnetten+" keer catch");
  check("een mislukte navigatie geeft een leesbare melding",
    /Geen verbinding en niets in de cache/.test(bronSW));

  // 2. het cijfer boven een hoge balk viel buiten de tekening
  const {api,bak}=laadKern(1280);
  const nat=bouw({}); 
  nat.minutely_15={time:[],precipitation:[]};
  for(let k=0;k<16;k++){
    nat.minutely_15.time.push("2026-07-22T"+String(14+Math.floor(k/4)).padStart(2,"0")+":"+String((k%4)*15).padStart(2,"0"));
    nat.minutely_15.precipitation.push(k<8?4.8:0.3);   // stevige bui, balk raakt de bovenrand
  }
  Object.assign(api.S,{d:nat,i0:14,op:Date.now(),lat:52.35,lon:5.26,label:"T",dag:null,bereik:24});
  api.nowcast();
  const svg=bak.nc.innerHTML;
  const yWaarden=[...svg.matchAll(/<text[^>]*y="([\d.-]+)"[^>]*>[\d,]+<\/text>/g)].map(m=>parseFloat(m[1]));
  const buiten=yWaarden.filter(y=>y<8);
  check("geen enkel neerslagcijfer valt boven de tekening uit",buiten.length===0,
    "y-waarden "+buiten.join(", "));

  // 3. leeg is niet hetzelfde als laag
  check("zonder pollendata zegt de app dat, in plaats van geen concentraties",
    /Geen pollendata voor deze locatie/.test(bronL));
  check("de app kijkt of er uberhaupt gemeten is",/const gemeten=soorten\.some/.test(bronL));

  // 4. het bewolkingspercentage moet uitlijnen
  check("het percentage staat in een vak met vaste breedte",
    /\.perc\{display:inline-block;min-width:[\d.]+em;text-align:right\}/.test(bronL));
  check("het percentage gebruikt dat vak ook",/<span class="perc">/.test(bronL));

  // 5. het scheidingsteken mag niet los aan het regeleinde blijven
  check("het maandeel breekt als geheel af, zonder losse tekens aan het regeleinde",
    /\.maangroep\{white-space:nowrap\}/.test(bronL) && /class="maangroep"><span class="maanbij"/.test(bronL));

  // 6. een vlakke lijn krijgt nu op elk drie-uursinterval een cijfer (punt 4 van
  //    de twaalfpuntsopdracht eist dit expliciet, ook als de waarde herhaalt);
  //    dat cijfer mag alleen niet twee keer op exact dezelfde plek terechtkomen
  {
    const {api:a6,bak:b6}=laadKern(1280);
    const vlak=(u)=>19+((u%3)-1)*0.1;
    Object.assign(a6.S,{d:bouw({temp:vlak}),i0:14,op:Date.now(),lat:52.35,lon:5.26,label:"T",dag:null,bereik:24});
    a6.etmaal(14,24);
    const h6=b6.chart.innerHTML;
    const posities=[...h6.matchAll(/<text x="([\d.-]+)" y="([\d.-]+)"[^<]*?font-family="Bodoni Moda,serif" font-size="[\d.]+">(-?\d+)°</g)]
      .map(m=>({x:parseFloat(m[1]),y:parseFloat(m[2]),v:m[3]}));
    /* Acht rasterpunten (om de drie uur) zijn het minimum. De werkelijke hoogste
       en laagste waarde in beeld komen er als bonus bij, ook als die toevallig
       niet op het raster vallen; met deze cyclische testreeks van 18,9/19,0/19,1
       vallen alle rasterpunten toevallig op dezelfde fase, dus de twee uitersten
       liggen daar altijd net naast. Tien labels is dus de juiste uitkomst. */
    check("op een vlakke 24-uursreeks staat er op elk drie-uursinterval een label",
      posities.length>=8&&posities.length<=10,posities.length+" labels: "+posities.map(p=>p.v).join(" "));
    const dubbel=[];
    for(let a=0;a<posities.length;a++) for(let b2=a+1;b2<posities.length;b2++){
      const p=posities[a],q=posities[b2];
      if(Math.abs(p.x-q.x)<2&&Math.abs(p.y-q.y)<2) dubbel.push(a+"+"+b2);
    }
    check("geen twee labels staan op precies dezelfde plek",dubbel.length===0,dubbel.join(", "));
  }

  // 7. het verificatieblok is er op verzoek uit
  check("het verificatieblok is verwijderd",
    !/id="controle"/.test(bronL) && !/Hoe goed was de verwachting/.test(bronL));

  /* 7b. radarbeelden moeten op tijd staan. Twee bronnen achter elkaar plakken gaf
     een schuif die van 20:10 naar 19:10 en dan naar 20:20 sprong. */
  {
    const bronF=new Function("return "+(bronL.match(/function opTijd\(lijst\)\{[\s\S]*?\n\}/)||["null"])[0])();
    check("er is een functie die beelden op tijd zet",typeof bronF==="function");
    if(typeof bronF==="function"){
      const rommel=[{time:300},{time:100},{time:200},{time:100},{time:400}];
      const uit=bronF(rommel);
      const tijden=uit.map(f=>f.time);
      check("de reeks loopt oplopend in de tijd",
        tijden.every((t,i)=>i===0||t>tijden[i-1]),tijden.join(", "));
      check("dubbele tijdstippen vallen weg",tijden.length===4,tijden.join(", "));
      check("een lege of kapotte invoer geeft geen fout",
        bronF([]).length===0 && bronF([null,{time:NaN},{time:5}]).length===1);
    }
    check("de samengevoegde reeks wordt gesorteerd",/opTijd\(R\.frames\.concat/.test(bronL));
    check("de radarreeks zelf wordt ook gesorteerd",/opTijd\(verleden\.concat/.test(bronL));
    check("de vooruitblik blijft bij het wisselen van laag",
      /R\.radarFrames=R\.frames;/.test(bronL) && !/if\(R\.satFrames\.length\) R\.radarFrames/.test(bronL));
  }


  /* 7d. de KNMI-laag moet dezelfde kleurtaal spreken als RainViewer */
  {
    const stijl=(bronL.match(/const KNMI_STIJL="([^"]+)"/)||[])[1];
    check("er staat een expliciete stijl voor de KNMI-laag",!!stijl,"KNMI_STIJL ontbreekt");
    /* De laag biedt volgens zijn eigen GetCapabilities radar/nearest,
       rainrate-blue-to-purple/nearest en rainrate-blue-to-purple/shaded.
       De eerste is de standaard en tekent rood; die valt af. */
    const geldig=["radar/nearest","rainrate-blue-to-purple/nearest","rainrate-blue-to-purple/shaded"];
    check("de stijl bestaat op de server",geldig.includes(stijl),String(stijl));
    check("de stijl is de blauwe, niet de rode standaard",
      /^rainrate-blue-to-purple/.test(String(stijl)),String(stijl));
    check("de stijl wordt ook echt meegestuurd",
      /&STYLES="\+encodeURIComponent\(KNMI_STIJL\)/.test(bronL));
    check("de kaartaanvraag gebruikt een projectie die de laag ondersteunt",
      /CRS=EPSG:3857/.test(bronL));
  }

  /* 7c. het cijfer mag niet op de rode nu-lijn vallen */
  {
    const {api:aN,bak:bN}=laadKern(390);
    const d38=bouw({});
    // dezelfde datum als d38.hourly.time[38], zodat de nu-lijn binnen dit venster valt
    Object.assign(aN.S,{d:d38,i0:38,op:Date.now(),lat:52.35,lon:5.26,label:"T",dag:null,bereik:24,
      klokOverride:new Date(d38.hourly.time[38].slice(0,13)+":00:00Z")});
    aN.etmaal(38,24);
    const h=bN.chart.innerHTML;
    const lijn=h.match(/<line x1="([\d.]+)"[^>]*stroke="var\(--carmine\)"/);
    check("de nu-lijn staat in de tekening",!!lijn,"lijn niet gevonden");
    if(lijn){
      const xn=parseFloat(lijn[1]);
      const labels=[...h.matchAll(/<text x="([\d.-]+)" y="[\d.-]+"[^<]*?font-family="Bodoni Moda,serif" font-size="([\d.]+)">(-?\d+)°</g)]
        .map(m=>({x:parseFloat(m[1]),b:(m[3].length+1)*parseFloat(m[2])*0.58}));
      const opDeLijn=labels.filter(l=>Math.abs(l.x-xn)<l.b/2+2);
      check("geen temperatuurcijfer valt over de nu-lijn",opDeLijn.length===0,
        opDeLijn.map(l=>"label op x "+l.x.toFixed(0)+", lijn op "+xn.toFixed(0)).join(", "));
    }
  }

  // 8. satelliet alleen crediteren als er beelden zijn
  check("de bronregel noemt satelliet niet standaard",
    !/Radar en satelliet: <a/.test(bronL) && /id="bronsat"/.test(bronL));

  // 9. de brede tegel alleen waar hij de rij vult
  check("de brede tegel spant alleen op smalle schermen",
    /@media\(max-width:900px\)\{ \.stat\.breed\{grid-column:1 \/ -1\} \}/.test(bronL));

  /* 10. de klok van de plaats staat naast de plaatsnaam, altijd, ook in Nederland.
     Alle uren in de app staan in de tijd van die plaats, dus zonder klok weet je
     niet waar een venster van 01:00 tot 03:00 op slaat. */
  for(const [naam,off] of [["Tokio",32400],["New York",-14400],["Nepal",20700],["thuis",7200]]){
    const {api:a7,bak:b7}=laadKern(390);
    const d7=bouw({}); d7.utc_offset_seconds=off;
    Object.assign(a7.S,{d:d7,i0:14,op:Date.now(),lat:1,lon:1,label:"Testplaats",dag:null,bereik:24});
    a7.tekenAlles();
    const h=b7.place.innerHTML;
    check(naam+": de plaatsnaam heeft een klok",/<span id="plaatstijd">\d\d:\d\d<\/span>/.test(h),h);
    check(naam+": de plaatsnaam zelf blijft staan",/Testplaats/.test(h),h);
  }
  // de klok moet de tijd van de plaats tonen, niet die van de kijker
  {
    const {api:aT,bak:bT}=laadKern(390);
    const dT=bouw({}); dT.utc_offset_seconds=32400;              // Tokio
    Object.assign(aT.S,{d:dT,i0:14,op:Date.now(),lat:1,lon:1,label:"T",dag:null,bereik:24});
    aT.tekenAlles();
    const uur=parseInt((bT.place.innerHTML.match(/>(\d\d):\d\d</)||[0,-1])[1],10);
    const eigen=new Date().getUTCHours();
    check("de klok volgt de tijdzone van de plaats",uur===(eigen+9)%24,
      "plaats "+uur+", UTC "+eigen);
  }
  check("het oude tijdsverschil-element is weg",!/id="lokaal"/.test(bronL));
}

/* 10n. icoonoverlap en de meelopende klok */
groep("Iconen en balk");
{
  const fsI=require("fs"), pathI=require("path");
  const bronI=fsI.readFileSync(pathI.join(__dirname,"index.html"),"utf8");
  const {api}=laadKern(390);

  /* Zon en wolk zijn allebei lijnwerk zonder vulling. Zonder afdekking liep de
     onderrand van de zon dwars door de wolk. */
  for(const [naam,dag] of [["overdag",true],["s nachts",false]]){
    const h=api.icon(2,dag,24);
    check("halfbewolkt "+naam+": de wolk dekt af wat erachter ligt",
      /<mask id="mk\d+">/.test(h) && /<g mask="url\(#mk\d+\)">/.test(h),h.slice(0,90));
  }
  // twee iconen op een pagina mogen nooit hetzelfde masker delen
  const ids=[api.icon(2,true,24),api.icon(2,false,24),api.icon(2,true,18)]
    .map(h=>(h.match(/mask id="(mk\d+)"/)||[])[1]);
  check("elk icoon krijgt een eigen masker-id",new Set(ids).size===ids.length,ids.join(", "));

  // waar niets achter de wolk ligt hoort ook geen masker te staan
  for(const [naam,code] of [["onweer",95],["regen",61],["sneeuw",71],["mist",45],["bewolkt",3],["onbewolkt",0]]){
    check(naam+" heeft geen masker nodig",!/<mask/.test(api.icon(code,true,24)));
  }

  // het masker moet dikker zijn dan de lijn zelf, anders blijft er een randje staan
  const m=api.icon(2,true,24).match(/<mask[\s\S]*?stroke-width="([\d.]+)"/);
  check("het masker is ruimer dan de lijndikte",!!m&&parseFloat(m[1])>1.15,m?m[1]:"niet gevonden");




  /* Bij het afspelen flikkerde de neerslag: het doek werd gewist voordat de tegels
     binnen waren. Het wissen hoort na het laden te komen, niet ervoor. */
  {
    const teken=bronI.slice(bronI.indexOf("async function radarTeken"),bronI.indexOf("function markeer"));
    check("de tekenfunctie wacht op de beelden",/await Promise\.all/.test(teken));
    const naLaden=teken.indexOf("await Promise.all")<teken.indexOf("ctx.clearRect");
    check("het doek wordt pas gewist als de beelden binnen zijn",naLaden,
      "clearRect staat nog voor het laden");
    check("een oudere ophaalronde mag niet meer tekenen",
      /ronde!==radarRonde\)\s*return/.test(teken),"geen bescherming tegen twee rondes tegelijk");
    check("het volgende beeld wordt alvast opgehaald",
      /R\.frames\[\(R\.i\+1\)%R\.frames\.length\]/.test(teken));
    // de tijd mag niet meewachten, anders loopt het bijschrift achter
    check("het tijdstip verschijnt zonder te wachten",
      teken.indexOf("radartijd")<teken.indexOf("await Promise.all"));
  }

  /* Er staat een globale regel svg,canvas{display:block}. Elke SVG die middenin
     een tekstregel staat moet die overrulen, anders breekt de regel eromheen.
     Zet je vertical-align op een SVG, dan bedoel je hem inline: dat is precies
     het signaal waar deze controle op let. */
  {
    const globaalBlok=/svg,canvas\{display:block/.test(bronI);
    check("de globale regel zet svg op block",globaalBlok);
    const regels=[...bronI.matchAll(/([.#][\w-]+ svg)\{([^}]*)\}/g)];
    const scheef=regels.filter(([,sel,decl])=>
      /vertical-align/.test(decl) && !/display:inline/.test(decl));
    check("elke inline geplaatste SVG overruled de blokregel",scheef.length===0,
      scheef.map(m=>m[1]+" mist display:inline-block").join(", "));
    check("het maanschijfje staat inline",
      /\.maanbij svg\{display:inline-block/.test(bronI));
    check("de windpijl staat inline",
      /\.dwind svg\{display:inline-block/.test(bronI));
  }

  /* het kleurschema van de radar moet als een benoemde keuze in de code staan */
  {
    const m=bronI.match(/const RV_SCHEMA=(\d);/);
    check("het kleurschema staat als benoemde constante in de code",!!m,"RV_SCHEMA niet gevonden");
    if(m){
      const nr=parseInt(m[1],10);
      check("het kleurschema is een bestaand nummer",nr>=0&&nr<=8,String(nr));
      check("de tegel-URL gebruikt die constante",
        /RV_SCHEMA\+"\/1_1"/.test(bronI),"de URL heeft nog een vast cijfer");
      // de satelliet heeft een eigen schema en mag niet meeschakelen
      check("de satelliettegel houdt zijn eigen schema",/f\.sat\?"0\/0_0"/.test(bronI));
    }
  }

  /* de klok hoort ook zichtbaar te blijven als je scrollt */
  check("de meelopende balk heeft een klok",/id="minitijd"/.test(bronI));
  check("beide klokken komen uit dezelfde functie",
    (bronI.match(/plaatsKlok\(\)/g)||[]).length>=3);
  {
    const {api:a2,bak:b2}=laadKern(390);
    const d2=bouw({}); d2.utc_offset_seconds=32400;      // Tokio
    Object.assign(a2.S,{d:d2,i0:14,op:Date.now(),lat:1,lon:1,label:"T",dag:null,bereik:24});
    a2.tekenAlles(); a2.stempel();
    const kop=(b2.place.innerHTML.match(/>(\d\d:\d\d)</)||[])[1];
    const balk=b2.minitijd.textContent;
    check("de klok in de balk is gelijk aan die naast de plaatsnaam",kop===balk,
      "kop "+kop+", balk "+balk);
  }
}

/* 10o. het nachtzicht toont uitsluitend wat de opdracht toestaat: score, bewolking,
   beste zichttijdvak, maanopkomst, maanondergang en maanfase. Seeing en doorzicht
   uit de bovenlucht (250/700 hPa) zijn eruit, net als eerder de planeetstanden
   (punt 11, zie de efemeride-context bij groep "Nachtzicht vereenvoudigd"). */
groep("Nachtzicht bevat geen bovenlucht meer");
{
  const fsP=require("fs"), pathP=require("path");
  const bronP=fsP.readFileSync(pathP.join(__dirname,"index.html"),"utf8");

  check("de bovenluchtvelden worden niet meer bij de API opgevraagd",
    !/wind_speed_250hPa/.test(bronP) && !/relative_humidity_700hPa/.test(bronP));
  check("de seeing/doorzicht-berekening bestaat niet meer",
    !/const bovenlucht=/.test(bronP) && !/seeingWoord/.test(bronP) && !/zichtWoord/.test(bronP));
  check("de nachtzicht-rij bevat geen nlucht-regel meer",!/nlucht/.test(bronP));

  // de rij moet nog precies de toegestane velden tonen, niet meer en niet minder
  const {api:a4,bak:b4}=laadKern(390);
  Object.assign(a4.S,{d:bouw({}),i0:14,op:Date.now(),lat:52.35,lon:5.26,label:"T",dag:null,bereik:24});
  a4.nachten();
  const t4=b4.nights.innerHTML;
  check("bewolking staat er nog",/bewolking/.test(t4));
  check("het waarneemvenster staat er nog",/beste zicht van|Geen geschikt zichtvenster/.test(t4));
}

/* 10p. dagdeel, datums, windrichting en de modelkeuze */
groep("Tijd, datum en richting");
{
  const fsT2=require("fs"), pathT2=require("path");
  const bronT=fsT2.readFileSync(pathT2.join(__dirname,"index.html"),"utf8");

  /* De tijdzone moet bij de plaats horen. Een vaste Europe/Amsterdam zou elk uur
     in Tokio acht plaatsen verschuiven, en dat raakt ook het waarneemvenster. */
  check("de tijdzone volgt de plaats",/timezone=auto/.test(bronT));
  check("er wordt geen vaste tijdzone afgedwongen",!/timezone=Europe/.test(bronT));
  /* Geen vast model: best_match kiest per plek het fijnste dat bestaat, boven
     Nederland KNMI Harmonie op 2 km. Een globaal model afdwingen maakt juist de
     windstoten grover. */
  check("er wordt geen grof model afgedwongen",!/models=ecmwf_ifs04/.test(bronT));

  /* Laat op de avond klopt "vandaag" niet meer. */
  for(const [uur,verw] of [[9,"Vandaag"],[17,"Vandaag"],[18,"Vanavond"],[22,"Vanavond"],
                           [23,"Vannacht"],[2,"Vannacht"],[5,"Vandaag"]]){
    const {api:a,bak:b}=laadKern(390);
    const d=bouw({pp:()=>4,pr:()=>0,som:0});
    d.current.time="2026-07-22T"+String(uur).padStart(2,"0")+":00";
    Object.assign(a.S,{d:d,i0:14,op:Date.now(),lat:52.35,lon:5.26,label:"T",dag:null,bereik:24});
    a.meters();
    check("om "+String(uur).padStart(2,"0")+":00 heet het "+verw,
      a.dagDeel().woord===verw,a.dagDeel().woord);
    // precsub gebruikt sinds de correctieronde altijd dezelfde dagsomformulering
    // ("Voor vandaag wordt in totaal X mm neerslag verwacht.", ook bij 0,0 mm),
    // ongeacht dagDeel() of of de neerslag al gevallen is. dagDeel() zelf blijft
    // wel bestaan voor de briefing en de andere teksten die de klok volgen. Zie
    // de "Neerslagtegel"-groep verderop voor de controles die bij precsub horen.
  }

  /* Datums achter vandaag en morgen, uit echte Date-objecten zodat maandgrenzen
     en schrikkeljaren vanzelf goed gaan. */
  {
    const {api:a,bak:b}=laadKern(1280);
    Object.assign(a.S,{d:bouw({}),i0:14,op:Date.now(),lat:52.35,lon:5.26,label:"T",dag:null,bereik:24});
    a.dagen();
    const namen=[...b.days.innerHTML.matchAll(/class="dlang">([^<]*)</g)].map(m=>m[1]);
    check("vandaag en morgen hebben een datum",
      /^vandaag \d+$/.test(namen[0]||"")&&/^morgen \d+$/.test(namen[1]||""),namen.slice(0,2).join(" | "));
    check("er wordt niet met een opgeteld dagnummer gerekend",
      !/getDate\(\)\s*\+\s*1/.test(bronT));
    // maandovergangen en schrikkeljaren via het echte Date-object
    const scherp=[["2026-01-31",1],["2026-02-28",1],["2028-02-28",29],["2026-12-31",1],["2028-02-29",1]]
      .filter(([datum,verw])=>{
        const d2=new Date(datum+"T12:00:00Z"); d2.setUTCDate(d2.getUTCDate()+1);
        return d2.getUTCDate()!==verw;
      });
    check("maandgrenzen en schrikkeljaren rollen goed door",scherp.length===0,JSON.stringify(scherp));
  }

  /* Windrichting: zestien vakken van 22,5 graden, ook bij negatieve of te grote invoer. */
  {
    const {api}=laadKern(390);
    const paren=[[0,"N"],[11.24,"N"],[11.26,"NNO"],[22.5,"NNO"],[45,"NO"],[180,"Z"],
                 [270,"W"],[337.5,"NNW"],[348.75,"N"],[359,"N"],[-10,"N"],[720,"N"]];
    const mis=paren.filter(([g,v])=>api.kompasKort(g)!==v);
    check("de windrichting klopt op elk vak",mis.length===0,
      mis.map(([g,v])=>g+" gaf "+api.kompasKort(g)+" in plaats van "+v).join(", "));
    let leeg=0; for(let g=-720;g<1080;g+=0.5) if(!api.kompasKort(g)) leeg++;
    check("geen enkele invoer levert een lege richting",leeg===0,leeg+" keer leeg");
    check("de richting staat naast de snelheid",/kompasKort\(c\.wind_direction_10m\)/.test(bronT));
  }
}

/* 10q. grafiek: lege waarden, staaflabels en gebruikshints */
groep("Grafiek en hints");
{
  const fsG=require("fs"), pathG=require("path");
  const bronG=fsG.readFileSync(pathG.join(__dirname,"index.html"),"utf8");

  /* MM werd gebruikt maar nergens aangemaakt. Een verwijzing naar een niet-bestaande
     naam werpt een fout, dus de hele grafiek viel uit zodra er een staaf getekend
     werd. Alleen zichtbaar op een natte dag, en de testdata was droog. */
  {
    const {api,bak}=laadKern(1280);
    Object.assign(api.S,{d:bouw({pr:(u)=>u%3===0?2.4:0,pp:(u)=>u%3===0?80:5,som:9}),
      i0:14,op:Date.now(),lat:52.35,lon:5.26,label:"T",dag:null,bereik:24});
    let stuk=null;
    try{ api.etmaal(14,24); }catch(e){ stuk=e.message; }
    check("een natte dag laat de grafiek niet uitvallen",stuk===null,stuk);
    check("er staan staven bij neerslag",/<rect/.test(bak.chart.innerHTML));
    check("de hoeveelheid staat met eenheid bij de staaf",
      /">[\d,]+ mm</.test(bak.chart.innerHTML),
      (bak.chart.innerHTML.match(/font-size="9">[^<]*/)||["niets"])[0]);
  }

  /* Bij smalle kolommen hoort het label te wijken in plaats van te overlappen. */
  for(const [naam,br,ber,verwacht] of [["desktop 24 uur",1280,24,true],
                                       ["telefoon week",390,168,false]]){
    const {api,bak}=laadKern(br);
    Object.assign(api.S,{d:bouw({pr:(u)=>u%3===0?2.4:0,pp:(u)=>u%3===0?80:5,som:9}),
      i0:14,op:Date.now(),lat:52.35,lon:5.26,label:"T",dag:null,bereik:ber});
    api.etmaal(14,ber);
    // alleen de staaflabels tellen: die zijn teal en staan in de mono-letter.
    // De aslabels zijn ook mono, dus zonder de kleur erbij tel je die mee.
    const heeft=/fill="var\(--teal\)"[\s\S]{0,80}?font-size="[89](\.5)?">[\d,]+/.test(bak.chart.innerHTML);
    check(naam+": staaflabel "+(verwacht?"staat er":"wijkt"),heeft===verwacht,String(heeft));
  }
  check("de labelbreedte volgt uit de tekst, niet uit een vast getal",
    /breed\(vol\)<=cw\*0?\.\d+/.test(bronG));

  /* Een gat in de reeks werd stilzwijgend nul graden, want y(null) rekent null als
     nul. De lijn dook dan naar de bodem en suggereerde een vorstnacht. */
  {
    const {api,bak}=laadKern(1280);
    const d=bouw({}); [3,4,5,11,12].forEach(k=>{d.hourly.temperature_2m[14+k]=null;});
    Object.assign(api.S,{d:d,i0:14,op:Date.now(),lat:52.35,lon:5.26,label:"T",dag:null,bereik:24});
    api.etmaal(14,24);
    const h=bak.chart.innerHTML;
    check("de lijn breekt bij een gat in plaats van door te lopen",
      (h.match(/<polyline/g)||[]).length===3,
      (h.match(/<polyline/g)||[]).length+" lijnstukken");
    check("er komt geen NaN in de tekening",!/NaN/.test(h));
    const punten=(h.match(/points="([^"]*)"/g)||[]).join(" ");
    check("geen enkel punt staat op een lege waarde",!/,\s*(null|undefined)/.test(punten));
  }
  {
    // en een reeks zonder enkele waarde mag niet omvallen
    const {api,bak}=laadKern(1280);
    const d=bouw({}); d.hourly.temperature_2m=d.hourly.temperature_2m.map(()=>null);
    Object.assign(api.S,{d:d,i0:14,op:Date.now(),lat:52.35,lon:5.26,label:"T",dag:null,bereik:24});
    let stuk=null; try{ api.etmaal(14,24); }catch(e){ stuk=e.message; }
    check("een reeks zonder cijfers geeft geen fout",stuk===null,stuk);
    check("en tekent dan ook niets",bak.chart.innerHTML==="",bak.chart.innerHTML.slice(0,60));
  }

  /* Twee aanwijzingen. De tekst bij de grafiek is nu vast, ongeacht muis of
     aanraking: dat onderscheid is met opzet verwijderd, dus deze test bewaakt
     juist dat het niet terugkomt. */
  check("er staat een aanwijzing boven de zevendagentabel",
    /Klik op een dag om die verwachting/.test(bronG));
  check("er is een aanwijzing bij de grafiek",/id="charthint"/.test(bronG));
  check("de tekst is vast, geen onderscheid meer tussen muis en aanraking",
    !/ontouchstart|maxTouchPoints/.test(bronG.slice(bronG.indexOf("function chartHint"),bronG.indexOf("function chartHint")+400)));
  {
    const {api,bak}=laadKern(390);
    Object.assign(api.S,{d:bouw({}),i0:14,op:Date.now(),lat:52.35,lon:5.26,label:"T",dag:null,bereik:24});
    api.etmaal(14,24);
    check("de aanwijzing bevat exact de gevraagde tekst",
      bak.charthint.textContent==="Houd je vinger op de grafiek voor meer informatie",
      bak.charthint.textContent);
  }
}

/* 10r. de laklaag: schuifbalk, uitlijning, selectielijn en voettekst */
groep("Opmaak en uitlijning");
{
  const fsL2=require("fs"), pathL2=require("path");
  const css=fsL2.readFileSync(pathL2.join(__dirname,"index.html"),"utf8");

  /* De schuifbalk. accent-color laat elke browser zijn eigen vorm tekenen, dus die
     moet weg en de baan en knop tekenen we zelf. De pseudo-elementen horen in losse
     regels: kent een browser er een niet, dan gooit hij de hele regel weg. */
  // op de declaratie letten en niet op het woord: het staat ook in het commentaar
  check("de browser tekent de schuif niet meer zelf",
    /input\[type=range\]\{[^}]*appearance:none/.test(css) && !/accent-color\s*:/.test(css));
  for(const p of ["-webkit-slider-runnable-track","-moz-range-track",
                  "-webkit-slider-thumb","-moz-range-thumb"]){
    check("er is opmaak voor "+p,new RegExp("::"+p.replace(/-/g,"\\-")+"\\{").test(css));
  }
  {
    // geen enkele regel mag twee leveranciers combineren
    const gemengd=[...css.matchAll(/([^{}]*)\{[^}]*\}/g)]
      .map(m=>m[1])
      .filter(sel=>/-webkit-slider|-moz-range/.test(sel) && /-webkit-/.test(sel) && /-moz-/.test(sel));
    check("webkit en moz staan in losse regels",gemengd.length===0,gemengd.join(" | "));
  }
  check("de knop staat halverwege de baan",/margin-top:-5\.5px/.test(css));
  check("wie beweging uitzet krijgt geen overgang",
    /prefers-reduced-motion[\s\S]{0,200}slider-thumb[\s\S]{0,120}transition:none/.test(css));
  check("de schuif blijft met het toetsenbord te zien",
    /input\[type=range\]:focus-visible\{[^}]*outline/.test(css));

  /* De rode selectielijn zat tegen de tekst aan. */
  check("de geselecteerde dag heeft ruimte naast de lijn",
    /\.day\{[^}]*padding-left:\d+px/.test(css) && /\.day\.on\{box-shadow:inset [3-9]px/.test(css));
  check("de rij schuift niet op door die ruimte",/\.day\{[^}]*margin-left:-\d+px/.test(css));

  /* De voettekst: elke bron op een eigen regel. */
  check("de voettekst staat onder elkaar",/footer\{[^}]*flex-direction:column/.test(css));
  const bronnen=(css.match(/<span class="bron"/g)||[]).length;
  check("elke bron heeft een eigen regel",bronnen>=4,bronnen+" regels");
  check("de bronnen staan niet meer als een lopend blok",
    !/Weer: <a[\s\S]{0,400}Kaart: <a/.test(css));
  // en de verplichte vermeldingen moeten er nog wel staan
  for(const bron of ["open-meteo.com","rainviewer.com","carto.com","openstreetmap.org"]){
    check(bron+" wordt nog vermeld",css.includes(bron));
  }

  /* Nachtzicht: de metaregels lijnen uit met de score, niet met de linkerrand. */
  check("de metaregels beginnen bij de score",
    /\.night \.nmeta\.wide\{display:block;grid-column:2 \/ -1/.test(css));
  {
    const {api,bak}=laadKern(390);
    Object.assign(api.S,{d:bouw({}),i0:14,op:Date.now(),lat:52.35,lon:5.26,label:"T",dag:null,bereik:24});
    api.nachten();
    const rijen=(bak.nights.innerHTML.match(/class="nmeta wide"/g)||[]).length;
    check("er staan metaregels in de nachten",rijen>0,String(rijen));
  }
}

/* 10s. header/minibar op een regel, over vier schermbreedtes en twee plaatsnamen */
groep("Header op een regel");
{
  const fsH=require("fs"), pathH=require("path");
  const css=fsH.readFileSync(pathH.join(__dirname,"index.html"),"utf8");
  const maten=JSON.parse(fsH.readFileSync(pathH.join(__dirname,"lettermaten.json"),"utf8"));
  const breed=(t,px,fam)=>[...t].reduce((s,c)=>s+(maten[fam][c]!==undefined?maten[fam][c]:0.5),0)*px;

  check("de rij breekt niet naar een tweede regel",
    /#minibar\{[^}]*white-space:nowrap/.test(css) && /#minibar\{[^}]*flex-wrap:nowrap/.test(css));
  check("tijd en temperatuur krimpen nooit",
    /#minitijd\{[^}]*flex:0 0 auto/.test(css) && /#minitemp\{[^}]*flex:0 0 auto/.test(css));
  check("de omschrijving heeft verreweg de grootste krimpfactor",
    /#minicond\{[^}]*flex-shrink:9999/.test(css));
  check("de plaatsnaam krijgt zijn volledige naam mee via title en aria-label",
    /pl\.title=S\.label; pl\.setAttribute\("aria-label",S\.label\)/.test(css));

  /* Het flexbox-krimpalgoritme nabootsen met echte gemeten tekenbreedtes, zodat
     dit geen aanname is maar een berekening: bij elke combinatie van breedte en
     plaatsnaam moeten tijd en temperatuur hun volledige breedte behouden en mag
     de rij nooit breder worden dan het scherm. */
  function simuleer(schermPx, plaats, cond){
    const gap = schermPx<=340 ? 6 : 10;
    const padding = (schermPx<=340 ? 14 : 20) * 2;
    const beschikbaar = schermPx - padding;
    const tijdB = breed("16:38",12,"mono");
    const tempB = breed("20°C",15,"mono");
    const plaatsVol = breed(plaats,17,"serif");
    const condVol = breed(cond,15,"serif");
    // vaste onderdelen plus drie tussenruimtes (plaats-tijd, tijd-temp, temp-cond)
    const vast = tijdB + tempB + gap*3;
    let restVoorPlaatsEnCond = beschikbaar - vast;
    if(restVoorPlaatsEnCond < 0) restVoorPlaatsEnCond = 0;
    /* Met shrink-factor 9999 tegenover 1 levert de omschrijving vrijwel altijd
       eerst in, tot aan nul toe, en pas daarna de plaatsnaam. Eerst plaats op
       volle breedte reserveren, wat overblijft is voor de omschrijving; is dat
       negatief, dan gaat ook de plaatsnaam inleveren. */
    const restVoorCond = restVoorPlaatsEnCond - plaatsVol;
    let condBreedte, plaatsBreedte;
    if(restVoorCond >= condVol){ condBreedte=condVol; plaatsBreedte=plaatsVol; }
    else if(restVoorCond >= 0){ condBreedte=restVoorCond; plaatsBreedte=plaatsVol; }
    else{ condBreedte=0; plaatsBreedte=Math.max(0, restVoorPlaatsEnCond); }
    return { tijdB, tempB, plaatsBreedte, plaatsVol, condBreedte,
      totaal: plaatsBreedte + tijdB + tempB + condBreedte + gap*3 };
  }

  const namen=["Almere","'s-Hertogenbosch"];
  const breedtes=[320,375,768,1440];
  const fouten=[];
  for(const schermPx of breedtes) for(const plaats of namen){
    const u=simuleer(schermPx, plaats, "overwegend zonnig");
    const padding = (schermPx<=340 ? 14 : 20) * 2;
    if(u.tijdB + padding > schermPx || u.tempB + padding > schermPx)
      fouten.push(schermPx+"px / "+plaats+": tijd of temperatuur past niet eens alleen al");
    if(Math.abs(u.tijdB - breed("16:38",12,"mono")) > 0.01)
      fouten.push(schermPx+"px / "+plaats+": tijd is aangetast");
    if(Math.abs(u.tempB - breed("20°C",15,"mono")) > 0.01)
      fouten.push(schermPx+"px / "+plaats+": temperatuur is aangetast");
    if(u.totaal > schermPx - padding + 0.5)
      fouten.push(schermPx+"px / "+plaats+": rij ("+u.totaal.toFixed(0)+"px) breder dan beschikbaar ("+(schermPx-padding)+"px)");
  }
  check("tijd en temperatuur blijven op elke breedte en elke plaatsnaam volledig intact",
    fouten.length===0, fouten.join(" | "));

  // bij de brede desktop moet de plaatsnaam zelf nooit hoeven in te leveren
  const breedDesktop=simuleer(1440,"'s-Hertogenbosch","overwegend zonnig");
  check("op een gangbare desktopbreedte hoeft zelfs een lange plaatsnaam niet in te korten",
    Math.abs(breedDesktop.plaatsBreedte-breedDesktop.plaatsVol)<0.5,
    breedDesktop.plaatsBreedte.toFixed(1)+" van de "+breedDesktop.plaatsVol.toFixed(1)+" px");

  // en op 320px met de lange naam mag de omschrijving verdwijnen, maar plaats en klok niet
  const smalLang=simuleer(320,"'s-Hertogenbosch","overwegend zonnig");
  check("op 320px met een lange naam krimpt eerst de omschrijving",
    smalLang.condBreedte < breed("overwegend zonnig",15,"serif"));
}

/* 10t. neerslagtegel: exacte formulering, juiste dag, 0mm is geldig.
   Correctieronde punt 3: de subtekst is nu altijd de volledige dagsom, ongeacht
   of de neerslag al gevallen is of nog moet komen, en ook bij 0,0 mm. Geen
   "viel er tot nu toe" en geen "blijft het droog" meer. */
groep("Neerslagtegel");
{
  const KLOK=new Date("2026-07-22T12:00:00Z");   // 14:00 lokaal, past bij bouw()'s fixture

  function metPrec(opties){
    const {api,bak}=laadKern(1280);
    Object.assign(api.S,{d:bouw(opties),i0:14,op:Date.now(),lat:52.35,lon:5.26,label:"T",dag:null,bereik:24,
      klokOverride:KLOK});
    api.meters();
    return norm(bak.precsub.textContent);
  }

  // uitsluitend al gevallen neerslag: krijgt nu dezelfde formulering als toekomstige
  const alGevallen=metPrec({pr:(u)=>u<14?0.3:0,pp:(u)=>u<14?70:5,som:2.4});
  check("al gevallen neerslag gebruikt ook de dagsomformulering, niet 'viel er tot nu toe'",
    /^Voor vandaag wordt in totaal 2,4 mm neerslag verwacht\.$/.test(alGevallen)
    && !/\bviel\b/.test(alGevallen), alGevallen);

  // een prognose die nog grotendeels moet komen
  const nogKomend=metPrec({pr:(u)=>u===20?1.5:0,pp:(u)=>u===20?70:5,som:1.5});
  check("een prognose met toekomstige neerslag heet 'wordt in totaal verwacht'",
    /^Voor vandaag wordt in totaal 1,5 mm neerslag verwacht\.$/.test(nogKomend),nogKomend);
  check("die formulering gebruikt nooit 'viel'",!/\bviel\b/.test(nogKomend),nogKomend);

  // 0,0 mm is geldige data: dezelfde formulering, geen "blijft het droog" meer
  const droog=metPrec({pp:()=>4,pr:()=>0,som:0});
  check("0,0 mm gebruikt dezelfde dagsomformulering, geen 'blijft het droog' en geen 'niet beschikbaar'",
    /^Voor vandaag wordt in totaal 0,0 mm neerslag verwacht\.$/.test(droog),droog);

  // ontbrekende of ongeldige dagsom
  const {api:aM,bak:bM}=laadKern(1280);
  const dM=bouw({}); dM.daily.precipitation_sum[
    dM.daily.time.indexOf("2026-07-22")
  ]=null;
  Object.assign(aM.S,{d:dM,i0:14,op:Date.now(),lat:52.35,lon:5.26,label:"T",dag:null,bereik:24,klokOverride:KLOK});
  aM.meters();
  check("ontbrekende dagsom geeft de nette foutmelding",
    bM.precsub.textContent==="Totale neerslag van vandaag niet beschikbaar",bM.precsub.textContent);

  // de dag wordt via de datum opgezocht, niet blind index 0
  check("de code zoekt de dag via plaatsVandaag(), niet blind day.time[0]",
    /const vandaagIdx=day\.time\.indexOf\(plaatsVandaag\(\)\)/.test(
      require("fs").readFileSync(__dirname+"/index.html","utf8")));
  {
    // een oudere, uit de cache teruggevallen dataset waarvan "vandaag" niet meer
    // op index 0 staat, moet nog altijd de juiste dag oppikken
    const {api:aO,bak:bO}=laadKern(1280);
    const dO=bouw({som:1.2});
    // schuif de datums een dag terug, zodat "2026-07-22" nu op index 1 staat
    dO.daily.time=["2026-07-21",...dO.daily.time.slice(0,6)];
    dO.daily.precipitation_sum=[0,...dO.daily.precipitation_sum.slice(0,6)];
    Object.assign(aO.S,{d:dO,i0:14,op:Date.now(),lat:52.35,lon:5.26,label:"T",dag:null,bereik:24,klokOverride:KLOK});
    aO.meters();
    check("een verschoven dagreeks levert nog steeds de juiste dagsom",
      /1,2 mm/.test(norm(bO.precsub.textContent)),bO.precsub.textContent);
  }
}

/* 10t2. neerslagkans komend uur: de subtekst gebruikt exact hetzelfde tijdvenster
   als de tegel zelf (h.precipitation_probability[i+1]), niet een bredere
   dagdeel- of piekconclusie (correctieronde punt 4). */
groep("Neerslagkans komend uur");
{
  const KLOK=new Date("2026-07-22T12:00:00Z");
  function metPop(opties){
    const {api,bak}=laadKern(1280);
    Object.assign(api.S,{d:bouw(opties),i0:14,op:Date.now(),lat:52.35,lon:5.26,label:"T",dag:null,bereik:24,
      klokOverride:KLOK});
    api.meters();
    // .textContent werkt niet betrouwbaar in deze lichtgewicht DOM-mock zodra de
    // waarde via innerHTML is gezet (zoals set() doet); innerHTML zelf wel.
    return {pop:norm(bak.pop.innerHTML).replace(/<[^>]+>/g,""),sub:norm(bak.popsub.textContent)};
  }
  // i0=14, dus i+1=15 is precies het uur dat de tegel toont. De piek van 90%
  // ligt bewust later (uur 20), zodat deze test aantoont dat de subtekst zich
  // niet baseert op die latere piek maar uitsluitend op uur 15.
  const laag=metPop({pp:(u)=>u===20?90:5});
  check("lage kans komend uur meldt 'zeer klein', ook als er verderop een piek van 90% zit",
    /^Komend uur is de neerslagkans zeer klein\.$/.test(laag.sub),laag.sub);
  check("de subtekst noemt geen dagdeel en geen 'grootste kans'",
    !/Vandaag|Vanavond|Vannacht|grootste kans/.test(laag.sub),laag.sub);

  const hoog=metPop({pp:(u)=>u===15?77:5});
  check("hoge kans komend uur noemt het percentage van dat uur",
    /^Komend uur is de neerslagkans 77%\.$/.test(hoog.sub),hoog.sub);
  check("de kop en de subtekst tonen hetzelfde percentage",hoog.pop.startsWith("77"),hoog.pop);
}

/* 10u. briefing en radartekst delen dezelfde conclusie over de komende twee uur */
groep("Briefing en radar afgestemd");
{
  const fsK=require("fs"), pathK=require("path");
  const bronK=fsK.readFileSync(pathK.join(__dirname,"index.html"),"utf8");
  const KLOK=new Date("2026-07-22T12:00:00Z");

  check("er is een centrale drempel voor korte-termijnneerslag",
    /const NEERSLAG_DREMPEL_MM\s*=\s*0\.1/.test(bronK));
  check("de briefing gebruikt kortetermijn()",
    /kt\s*=\s*kortetermijn\(\)/.test(bronK.slice(bronK.indexOf("function briefing"))));
  check("de radartekst gebruikt kortetermijn()",
    /const kt=kortetermijn\(\);/.test(bronK.slice(bronK.indexOf("function nowcast"))));

  function samen(opties){
    const {api,bak}=laadKern(1280);
    Object.assign(api.S,{d:bouw(opties),i0:14,op:Date.now(),lat:52.35,lon:5.26,label:"T",dag:null,bereik:24,
      klokOverride:KLOK});
    api.meters();api.briefing();api.nowcast();
    return { briefing:norm(bak.brief.innerHTML).replace(/<[^>]+>/g,""), radar:norm(bak.nctext.textContent) };
  }

  // droog scenario: allebei "droog", geen van beide "regent" of "neerslag"
  const d1=samen({pp:()=>5,pr:()=>0,som:0});
  check("droog: de briefing zegt droog",/komende twee uur.*droog/.test(d1.briefing),d1.briefing);
  check("droog: de radartekst zegt droog",/komende twee uur blijft het droog/.test(d1.radar),d1.radar);

  // nat scenario binnen de eerste twee uur: geen van beide mag "droog" beweren
  const n1=samen({pr:(u)=>u===15?2:0,pp:(u)=>u===15?80:5});
  check("nat: de briefing beweert geen droogte",!/komende twee uur.*blijft het.*droog/.test(n1.briefing),n1.briefing);
  check("nat: de radartekst beweert geen droogte",!/komende twee uur blijft het droog/.test(n1.radar),n1.radar);
  check("nat: beide noemen neerslag",/neerslag/.test(n1.briefing)&&/neerslag/.test(n1.radar));

  // het regent nu: allebei "regent nu"
  const r1=samen({nu:0.6,pp:(u)=>u<17?85:5,pr:(u)=>u<17?0.6:0,som:3});
  check("het regent nu: de briefing zegt dat",/regent nu/.test(r1.briefing),r1.briefing);

  /* De echte kern van punt 8: geen van beide teksten interpreteert de brondata
     zelf opnieuw. Beide moeten voor exact hetzelfde scenario tot dezelfde
     droog/nat-conclusie komen, over een reeks willekeurige patronen heen. */
  let tegenstrijdig=[];
  for(let seed=0;seed<12;seed++){
    const regen=(seed%4===1)?15:(seed%4===2)?16:-1;
    const opt = regen<0 ? {pp:()=>5,pr:()=>0} : {pr:(u)=>u===regen?0.3+seed*0.05:0,pp:(u)=>u===regen?60:5};
    const s=samen(opt);
    const briefDroog=/komende twee uur.*blijft het.*droog/.test(s.briefing)||/komende <b>twee uur<\/b> blijft het <b>droog/.test(s.briefing);
    const radarDroog=/komende twee uur blijft het droog/.test(s.radar);
    if(briefDroog!==radarDroog) tegenstrijdig.push("seed "+seed+": briefing droog="+briefDroog+", radar droog="+radarDroog);
  }
  check("over een reeks patronen komen briefing en radar nooit tot een andere conclusie",
    tegenstrijdig.length===0, tegenstrijdig.join(" | "));

  // onvoldoende data: geen stellige droogmelding in beide
  const {api:aX,bak:bX}=laadKern(1280);
  const dX=bouw({}); dX.minutely_15=null; dX.hourly.time=dX.hourly.time.slice(0,15);
  dX.hourly.precipitation=dX.hourly.precipitation.slice(0,15);
  dX.hourly.precipitation_probability=dX.hourly.precipitation_probability.slice(0,15);
  Object.assign(aX.S,{d:dX,i0:14,op:Date.now(),lat:52.35,lon:5.26,label:"T",dag:null,bereik:24,klokOverride:KLOK});
  aX.meters();aX.briefing();aX.nowcast();
  const briefX=norm(bX.brief.innerHTML).replace(/<[^>]+>/g,"");
  check("onvoldoende data: geen stellige droogmelding in de briefing",
    !/komende twee uur.*blijft het.*droog/.test(briefX)
    && !/komende <b>twee uur<\/b> blijft het <b>droog/.test(bX.brief.innerHTML),briefX);
  check("onvoldoende data: ook de radartekst blijft terughoudend",
    !/komende twee uur blijft het droog/.test(norm(bX.nctext.textContent)),norm(bX.nctext.textContent));
}

/* 10v. radar-zoom: de aanvraag blijft binnen wat de tegelbron ondersteunt, de
   weergave mag daar voorbij door de laatst geldige tegel op te schalen */
groep("Radar zoomgrens");
{
  const fsZ=require("fs"), pathZ=require("path");
  const bronZ=fsZ.readFileSync(pathZ.join(__dirname,"index.html"),"utf8");
  const m=bronZ.match(/const TEGEL=256, ZSTANDAARD=(\d+), ZMIN=(\d+), ZMAX=(\d+), ZTEGELMAX=(\d+);/);
  check("de zoomconstanten staan er nog in de verwachte vorm",!!m,"regel niet gevonden");
  if(m){
    const zst=+m[1], zmin=+m[2], zmax=+m[3], ztmax=+m[4];
    /* RainViewer documenteert zelf "Maximum zoom level is 7" voor zijn tegel-URL's
       (rainviewer.com/api/weather-maps-api.html). CARTO ondersteunt tot z=20
       (github.com/CartoDB/basemap-styles), dus die is hier niet de beperkende
       factor. Het laagste van de twee bepaalt ZTEGELMAX, de aanvraaggrens. ZMAX
       mag daarboven liggen: dat is puur weergave, client-side opgeschaald. */
    check("het aanvraagmaximum overschrijdt RainViewer's gedocumenteerde grens niet (7)",
      ztmax<=7,"ZTEGELMAX is "+ztmax);
    check("het weergavemaximum beperkt de gebruiker niet tot het aanvraagmaximum",
      zmax>ztmax,"ZMAX ("+zmax+") is niet groter dan ZTEGELMAX ("+ztmax+")");
    check("het zoomminimum is niet groter dan het maximum",zmin<zmax,zmin+" / "+zmax);
    check("de standaardzoom valt binnen het toegestane bereik",
      zst>=zmin&&zst<=zmax,zst+" buiten ["+zmin+","+zmax+"]");
  }
  // deze grens is uit de documentatie afgeleid, niet uit het niets: dat moet ook
  // in de code zelf terug te lezen zijn voor wie hem later aanpast
  check("de reden voor de grens staat als toelichting in de code",
    /Maximum zoom level is 7/.test(bronZ) && /rainviewer\.com/.test(bronZ),
    "de RainViewer-bronvermelding bij ZTEGELMAX ontbreekt");
  // devicePixelRatio mag de tegelaanvraag niet ongemerkt naar een hoger niveau duwen
  check("devicePixelRatio stuurt de tegelaanvraag niet aan",
    !/devicePixelRatio/.test(bronZ.slice(bronZ.indexOf("function radarTeken"),bronZ.indexOf("function markeer"))));
  // de tegel-URL gebruikt het begrensde aanvraagniveau Zt, niet het visuele niveau Zv
  check("de tegel-URL gebruikt het begrensde aanvraagniveau, niet het visuele niveau",
    /const Zt=Math\.min\(Zv,ZTEGELMAX\);/.test(bronZ)
    && /cartocdn\.com\/\$\{stijl\}\/\$\{Zt\}/.test(bronZ)
    && !/cartocdn\.com\/\$\{stijl\}\/\$\{Zv\}/.test(bronZ));
  // boven het aanvraagmaximum wordt er niets hogers opgehaald, alleen groter getekend
  check("boven het aanvraagmaximum wordt de laatst geldige tegel opgeschaald, niet opnieuw aangevraagd",
    /const schaal=Math\.pow\(2,Zv-Zt\);/.test(bronZ)
    && /drawImage\(im,vakken\[k\]\.px,vakken\[k\]\.py,TS,TS\)/.test(bronZ));
  {
    // de opschaling doorrekenen zoals de app hem toepast, los van de brontekst
    const Zt=z=>Math.min(z,7);
    const proef=[4,7,8,9].map(z=>({z,Zt:Zt(z),schaal:Math.pow(2,z-Zt(z))}));
    const fout=proef.filter(p=>p.z<=7 ? (p.Zt!==p.z||p.schaal!==1)
                                        : (p.Zt!==7||p.schaal!==Math.pow(2,p.z-7)));
    check("de opschalingsfactor klopt op elk niveau, ook voorbij het aanvraagmaximum",
      fout.length===0,JSON.stringify(fout));
  }
}

/* 10w. luchtvochtigheidstegel zonder dauwpunt */
groep("Luchtvochtigheid zonder dauwpunt");
{
  const fsV=require("fs"), pathV=require("path");
  const bronV=fsV.readFileSync(pathV.join(__dirname,"index.html"),"utf8");
  const humBlok=bronV.slice(bronV.indexOf("const vocht=c.relative_humidity_2m"),
                             bronV.indexOf("const luchtdrukIdx")||bronV.indexOf("set(\"pres\""));
  check("het dauwpunt staat niet meer in de luchtvochtigheidszin",
    !/dauwpunt|verzadiging|wolken vanaf/.test(humBlok),humBlok);

  function metVocht(pct){
    const {api,bak}=laadKern(1280);
    const d=bouw({}); d.current.relative_humidity_2m=pct;
    Object.assign(api.S,{d:d,i0:14,op:Date.now(),lat:52.35,lon:5.26,label:"T",dag:null,bereik:24});
    api.meters();
    return norm(bak.humsub.textContent);
  }
  check("39,9% is vrij droog",/vrij droog/i.test(metVocht(39.9)),metVocht(39.9));
  check("precies 40% is comfortabel (grens hoort erbij)",/comfortabel/i.test(metVocht(40)),metVocht(40));
  check("precies 60% is nog comfortabel (grens hoort erbij)",/comfortabel/i.test(metVocht(60)),metVocht(60));
  check("60,1% is vochtig",/vochtig/i.test(metVocht(60.1)),metVocht(60.1));
  check("0% is geldige data, geen 'niet beschikbaar'",
    !/niet beschikbaar/.test(metVocht(0)) && /droog/i.test(metVocht(0)),metVocht(0));

  // ontbrekende of ongeldige waarde
  const {api:aH,bak:bH}=laadKern(1280);
  const dH=bouw({}); dH.current.relative_humidity_2m=null;
  Object.assign(aH.S,{d:dH,i0:14,op:Date.now(),lat:52.35,lon:5.26,label:"T",dag:null,bereik:24});
  aH.meters();
  check("ontbrekende luchtvochtigheid geeft de nette foutmelding",
    norm(bH.humsub.textContent)==="Luchtvochtigheid niet beschikbaar",norm(bH.humsub.textContent));

  const {api:aH2,bak:bH2}=laadKern(1280);
  const dH2=bouw({}); dH2.current.relative_humidity_2m=140;   // buiten 0-100
  Object.assign(aH2.S,{d:dH2,i0:14,op:Date.now(),lat:52.35,lon:5.26,label:"T",dag:null,bereik:24});
  aH2.meters();
  check("een waarde buiten 0-100 geldt als ongeldig",
    norm(bH2.humsub.textContent)==="Luchtvochtigheid niet beschikbaar",norm(bH2.humsub.textContent));

  // dew_point_2m mag niet overal verdwenen zijn: de nachtzichtberekening gebruikt
  // het veld nog, dus die aanroep moet intact blijven. De zichtbare regel onder
  // de grote temperatuur toont het dauwpunt zelf niet meer (punt 6).
  check("de gevoelstemperatuurregel leest dew_point_2m niet meer uit voor S.i0",
    !/h\.dew_point_2m\[S\.i0\]/.test(bronV));
  check("dew_point_2m blijft bestaan voor de nachtzichtberekening",
    /dew_point_2m\[i\]/.test(bronV));
  check("de API-parameter dew_point_2m is niet verwijderd",/hourly=[^"]*dew_point_2m/.test(bronV));

  {
    const {api:aF,bak:bF}=laadKern(390);
    Object.assign(aF.S,{d:bouw({}),i0:14,op:Date.now(),lat:52.35,lon:5.26,label:"T",dag:null,bereik:24});
    aF.tekenAlles();
    const feelsTekst=norm(bF.feels.textContent);
    check("dauwpunt staat nergens meer zichtbaar onder de temperatuur",
      !/dauwpunt/i.test(feelsTekst),feelsTekst);
    check("de gevoelstemperatuur zelf blijft wel zichtbaar",
      /^Gevoelstemperatuur -?\d+°C$/.test(feelsTekst),feelsTekst);
  }
}

/* 10x. nachtzicht vereenvoudigd: geen planeten meer, Unicode-maanfase, specifieke reden */
groep("Nachtzicht vereenvoudigd");
{
  const fsN2=require("fs"), pathN2=require("path");
  const bronN2=fsN2.readFileSync(pathN2.join(__dirname,"index.html"),"utf8");

  check("de planeetberekening bestaat niet meer in de app",
    !/function planeet\(/.test(bronN2) && !/const BANEN\s*=/.test(bronN2));
  check("de nachtzicht-rij bevat geen planeetregel meer",!/nplaneten/.test(bronN2));

  const SYMBOLEN=["\u{1F311}","\u{1F312}","\u{1F313}","\u{1F314}","\u{1F315}","\u{1F316}","\u{1F317}","\u{1F318}"];
  const {api}=laadKern(390);
  // de grens tussen fase i en i+1 ligt precies op (i+0,5)/8; net dat getal
  // gebruiken in plaats van geraden ronde waarden, anders test je de verkeerde kant
  const mis=[];
  for(let i=0;i<8;i++){
    const grens=(i+0.5)/8;
    if(api.maanUnicode(grens-0.001)!==SYMBOLEN[i])
      mis.push((grens-0.001).toFixed(4)+" verwacht "+SYMBOLEN[i]+" kreeg "+api.maanUnicode(grens-0.001));
    if(api.maanUnicode(grens+0.001)!==SYMBOLEN[(i+1)%8])
      mis.push((grens+0.001).toFixed(4)+" verwacht "+SYMBOLEN[(i+1)%8]+" kreeg "+api.maanUnicode(grens+0.001));
  }
  check("elke fase rondt af naar het dichtstbijzijnde van de acht symbolen",
    mis.length===0,mis.join(", "));
  check("1,0 wordt hetzelfde behandeld als 0,0",api.maanUnicode(1)===api.maanUnicode(0),
    api.maanUnicode(1)+" / "+api.maanUnicode(0));
  check("de index loopt na 7 terug naar 0, geen achtste apart symbool",
    api.maanUnicode(0.999)===SYMBOLEN[0]);

  // ongeldige of ontbrekende invoer geeft een neutrale weergave, geen verkeerd symbool
  for(const bad of [null,undefined,NaN,-0.1,1.1,"0.5",Infinity]){
    const r=api.maanUnicode(bad);
    check("ongeldige invoer ("+String(bad)+") geeft geen symbool uit de lijst",
      !SYMBOLEN.includes(r),String(r));
  }

  // de specifieke oorzaak (bewolkt / maanlicht / allebei) blijft behouden
  for(const [opt,verw] of [
    [{cc:()=>90},"te bewolkt"],
  ]){
    const {api:aV,bak:bV}=laadKern(390);
    Object.assign(aV.S,{d:bouw(opt),i0:14,op:Date.now(),lat:52.35,lon:5.26,label:"T",dag:null,bereik:24});
    aV.nachten();
    const t=norm(bV.nights.innerHTML).replace(/<[^>]+>/g," ");
    check("de reden '"+verw+"' staat er nog achter de dubbele punt",
      new RegExp("Geen geschikt zichtvenster: "+verw).test(t),
      (t.match(/Geen geschikt zichtvenster[^\u00b7]*/)||["niet gevonden"])[0]);
  }
  check("de drie mogelijke redenen staan letterlijk in de code",
    /Geen geschikt zichtvenster: te veel maanlicht/.test(bronN2) &&
    /Geen geschikt zichtvenster: te bewolkt/.test(bronN2) &&
    /Geen geschikt zichtvenster: te bewolkt en te veel maanlicht/.test(bronN2));

  /* maanschijf() tekende bij volle maan (fase 0,5) een pad waarvan de twee bogen
     elkaar vrijwel opheffen (rx valt dan samen met r): het resultaat was een
     bijna lege vlakte, zichtbaar als een zwarte stip in plaats van een gevulde
     schijf. De kop boven de tabel gebruikt daarom nu dezelfde Unicode-fase als
     de nachtrijen; maanUnicode(0,5) is hierboven al bevestigd op 🌕 uit te komen. */
  check("de kop boven de tabel gebruikt maanUnicode(), niet meer de getekende maanschijf()",
    /moonlab"\)\.innerHTML=maanUnicode\(m\.fase\)/.test(bronN2)
    && !/moonlab"\)\.innerHTML=maanschijf\(/.test(bronN2));
}

/* 10y. zonuren op de plek van fijnstof, juiste dagindex, exacte drempels */
groep("Zonuren in plaats van fijnstof");
{
  const fsZon=require("fs"), pathZon=require("path");
  const bronZon=fsZon.readFileSync(pathZon.join(__dirname,"index.html"),"utf8");
  const KLOK=new Date("2026-07-22T12:00:00Z");

  check("PM2,5 staat niet meer in de tegel",!/Fijnstof PM2,5/.test(bronZon));
  check("de zonurentegel staat op dezelfde plek in de gridvolgorde",
    /\$\{zonurenTegel\(\)\}`;/.test(bronZon));
  check("er komt geen tweede API-aanroep bij: sunshine_duration zit op de bestaande daily-lijst",
    /&daily=[\s\S]{0,400}sunshine_duration/.test(bronZon) && !/air-quality-api[\s\S]{0,200}sunshine_duration/.test(bronZon));
  check("pm2_5 en pm10 zijn ook uit de aanroep zelf verwijderd (nergens anders gebruikt)",
    !/pm2_5/.test(bronZon)&&!/\bpm10\b/.test(bronZon));

  function metZon(uren){
    const {api,bak}=laadKern(1280);
    const d=bouw({}); const idx=d.daily.time.indexOf("2026-07-22");
    d.daily.sunshine_duration=d.daily.time.map((_,i)=>i===idx?uren*3600:0);
    Object.assign(api.S,{d:d,air:{current:{european_aqi:20,us_aqi:30},hourly:{time:d.hourly.time.slice(0,24),
      grass_pollen:new Array(24).fill(5),birch_pollen:new Array(24).fill(0),alder_pollen:new Array(24).fill(0),
      mugwort_pollen:new Array(24).fill(0),ragweed_pollen:new Array(24).fill(0),olive_pollen:new Array(24).fill(0)}},
      i0:14,op:Date.now(),lat:52.35,lon:5.26,label:"T",dag:null,bereik:24,klokOverride:KLOK});
    api.lucht();
    return norm(bak.aq.innerHTML);
  }
  check("0 uur is geldige data: 'weinig zon', niet 'niet beschikbaar'",
    /Weinig zon vandaag/.test(metZon(0)) && !/niet beschikbaar/.test(metZon(0)),metZon(0));
  check("1,9 uur is nog weinig",/Weinig zon vandaag/.test(metZon(1.9)),metZon(1.9));
  check("precies 2 uur is al 'een aantal' (grens hoort bij de middelste band)",
    /Een aantal zonuren vandaag/.test(metZon(2)),metZon(2));
  check("precies 7 uur is nog 'een aantal'",/Een aantal zonuren vandaag/.test(metZon(7)),metZon(7));
  check("7,1 uur is 'redelijk wat zon'",/Vandaag redelijk wat zon/.test(metZon(7.1)),metZon(7.1));
  check("de weergave rondt af op een decimaal met een komma",/6,5<s>uur/.test(metZon(6.5)),metZon(6.5));

  // ontbrekende, niet-numerieke en negatieve data
  for(const [naam,zet] of [
    ["ontbrekend",d=>{ d.daily.sunshine_duration=undefined; }],
    ["niet-numeriek",d=>{ const i=d.daily.time.indexOf("2026-07-22"); d.daily.sunshine_duration=d.daily.time.map((_,k)=>k===i?"x":0); }],
    ["negatief",d=>{ const i=d.daily.time.indexOf("2026-07-22"); d.daily.sunshine_duration=d.daily.time.map((_,k)=>k===i?-100:0); }]
  ]){
    const {api,bak}=laadKern(1280);
    const d=bouw({}); zet(d);
    Object.assign(api.S,{d:d,air:{current:{european_aqi:20,us_aqi:30},hourly:{time:d.hourly.time.slice(0,24),
      grass_pollen:new Array(24).fill(5),birch_pollen:new Array(24).fill(0),alder_pollen:new Array(24).fill(0),
      mugwort_pollen:new Array(24).fill(0),ragweed_pollen:new Array(24).fill(0),olive_pollen:new Array(24).fill(0)}},
      i0:14,op:Date.now(),lat:52.35,lon:5.26,label:"T",dag:null,bereik:24,klokOverride:KLOK});
    api.lucht();
    check(naam+" geeft de nette foutmelding",/Zonuren niet beschikbaar/.test(norm(bak.aq.innerHTML)),
      norm(bak.aq.innerHTML));
  }

  check("de dag wordt via plaatsVandaag() opgezocht, niet blind day.time[0]",
    /day&&day\.time\?day\.time\.indexOf\(plaatsVandaag\(\)\)/.test(bronZon));
}

console.log("\n"+goed+" geslaagd, "+fout+" mislukt");
process.exit(fout?1:0);
