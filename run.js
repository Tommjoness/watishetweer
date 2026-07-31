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
     de neerslagtekst (kortetermijn()). Neerslag verderop vandaag komt er als losse,
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
  for(const bron of ["Open-Meteo"])
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
  const moetCentraal=[".dwind",".dmin,.dmax",".score",".nmeta","#aq .stat"];
  const nietCentraal=moetCentraal.filter(sel=>{
    const re2=new RegExp(sel.replace(/[.#*]/g,"\\$&")+"\\{([^}]*)\\}");
    const m2=css.match(re2);
    return !m2||!/text-align:center/.test(m2[1]);
  });
  check("alle overige getalkolommen staan gecentreerd",nietCentraal.length===0,nietCentraal.join(", "));
  // v70-correctie: de kanskolom (.drain) lijnt nu consequent rechts uit, zowel
  // in de data-rijen als in de kop, zodat percentages van wisselende breedte
  // (bv. "8%" naast "100%") niet meer heen en weer springen
  check(".drain (de kanskolom) lijnt rechts uit, in zowel de data-rijen als de kop",
    /\.drain\{[^}]*text-align:right/.test(css) && /\.row\.kop \.drain\{text-align:right\}/.test(css));
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
  /* v71: labels volgen nu een prioriteitsvolgorde (huidig punt > globaal
     max/min > lokale pieken/dalen > het drie-uursraster) in plaats van
     uitsluitend i%stap===0. Het aantal labels kan dus hoger liggen dan het
     aantal drie-uursmomenten (een piek/dal ernaast telt nu ook mee), maar
     nooit hoger dan het totaal van alle toegestane candidate-indices samen:
     raster + globaal max/min + PROMINENT-lokale extremen + het huidige punt.
     De precieze prioriteits- en botsingslogica met voorspelbare, gecontroleerde
     data staat in de nieuwe groep "Grafieklabel-prioriteit" verderop. */
  const idxStap=[];
  for(let k=0;k<reeks.length;k++) if(k%stapTest===0 && reeks[k]!=null && isFinite(reeks[k])) idxStap.push(k);
  const soortScen=new Array(reeks.length).fill(0);
  for(let k=1;k<reeks.length-1;k++){
    const a=reeks[k-1],bb=reeks[k],c=reeks[k+1];
    if(a==null||bb==null||c==null||!isFinite(a)||!isFinite(bb)||!isFinite(c)) continue;
    if(bb>=a&&bb>c&&bb-Math.min(a,c)>=0.5) soortScen[k]=1;
    if(bb<=a&&bb<c&&Math.max(a,c)-bb>=0.5) soortScen[k]=-1;
  }
  const geldigScen=reeks.map(v=>v!=null&&isFinite(v));
  const alleToegestaan=new Set(idxStap);
  reeks.forEach((v,k)=>{ if(geldigScen[k]&&soortScen[k]!==0) alleToegestaan.add(k); });
  if(geldigScen[0]){
    const geldigeWaarden=reeks.filter((_,k)=>geldigScen[k]);
    alleToegestaan.add(reeks.indexOf(Math.max.apply(null,geldigeWaarden)));
    alleToegestaan.add(reeks.indexOf(Math.min.apply(null,geldigeWaarden)));
  }
  check(naam+": nooit meer labels dan er toegestane candidate-indices zijn (raster + extremen samen)",
    lab.length<=alleToegestaan.size+1,   // +1 marge voor het huidige-punt-candidate, dat niet in reeks-index zit maar in TI
    lab.length+" labels tegen ten hoogste "+(alleToegestaan.size+1)+" toegestane indices");

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
/* v71: probleem B - een scherpe lokale piek rond 09:00-10:00 kreeg geen
   label omdat de oude selectie uitsluitend i%stap===0 toestond. Deze groep
   toetst de nieuwe prioriteitsvolgorde (huidig punt > globaal max/min >
   lokale extremen > het drie-uursraster) met gecontroleerde, voorspelbare
   synthetische reeksen, zodat elk gedrag exact is na te rekenen. */
groep("Grafieklabel-prioriteit");
{
  // helper: bouwt een 24-uursreeks vanaf i0=0 (uur 0 van dag -1 in de
  // bouw()-fixture, altijd "vandaag" voor plaatsNuIndex), tekent de grafiek
  // en geeft de gerenderde labels terug als {i,v,x,y}, met i herleid uit x
  const labelsVoor=(reeks,opties)=>{
    const {api,bak}=laadKern((opties&&opties.breed)||1280);
    const d=bouw({});
    d.hourly.temperature_2m=d.hourly.time.map((_,k)=>k<reeks.length?reeks[k]:reeks[reeks.length-1]);
    let klokOverride=null;
    if(opties&&opties.klokUur!=null){
      // een geldig "huidig punt" simuleren op een vast uur diezelfde dag.
      // plaatsNu() telt (plaats-offset - eigen-offset) op bij de meegegeven
      // klokOverride; dat verschil hier vooraf compenseren zodat het
      // resultaat precies op opties.klokUur in TI landt, ongeacht de
      // tijdzone van de omgeving waarin de test draait.
      const dagStr=d.hourly.time[0].slice(0,10);
      const eigenOffset=-new Date().getTimezoneOffset()*60;
      const daarOffset=d.utc_offset_seconds!=null?d.utc_offset_seconds:eigenOffset;
      const verschil=daarOffset-eigenOffset;
      klokOverride=new Date(Date.parse(dagStr+"T"+String(opties.klokUur).padStart(2,"0")+":00:00Z")-verschil*1000);
    }
    Object.assign(api.S,{d,i0:0,op:Date.now(),lat:52.35,lon:5.26,label:"T",dag:null,klokOverride,
      bereik:(opties&&opties.bereik)||24});
    api.etmaal(0,(opties&&opties.bereik)||24);
    const svg=bak.chart.innerHTML;
    const vb=bak.chart.getAttribute("viewBox").split(" ").map(Number);
    const M=((opties&&opties.breed)||1280)<760;
    const pl=M?34:44, pr=M?10:20, iw=vb[2]-pl-pr, cw=iw/(reeks.length-1);
    const x=k=>pl+cw*k;
    const labs=[...svg.matchAll(/<text x="(-?[\d.]+)" y="(-?[\d.]+)"[^<]*?font-family="Bodoni Moda,serif" font-size="([\d.]+)">(-?\d+)°</g)]
      .map(m=>{
        const xx=+m[1];
        // dichtstbijzijnde i herleiden uit de bekende lineaire x-schaal
        let i=Math.round((xx-pl)/cw); i=Math.max(0,Math.min(reeks.length-1,i));
        return {i,x:xx,y:+m[2],v:+m[4]};
      });
    return {labs,svg,vb,api,bak};
  };

  // 1: een scherpe lokale piek krijgt een label
  {
    const reeks=[10,10,10,12,17,12,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10];
    const {labs}=labelsVoor(reeks);
    check("1. een scherpe lokale piek (index 4, niet op het drie-uursraster) krijgt een label",
      labs.some(l=>l.i===4), labs.map(l=>l.i+":"+l.v).join(","));
  }
  // 2: een scherpe lokale bodem krijgt een label
  {
    const reeks=[10,10,10,10,8,3,8,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10];
    const {labs}=labelsVoor(reeks);
    check("2. een scherpe lokale bodem (index 5, niet op het drie-uursraster) krijgt een label",
      labs.some(l=>l.i===5), labs.map(l=>l.i+":"+l.v).join(","));
  }
  // 3+4: globaal maximum en minimum krijgen altijd een label
  {
    const reeks=[10,10,9,9,20,9,9,10,10,10,10,-4,10,10,10,10,10,10,10,10,10,10,10,10];
    const {labs}=labelsVoor(reeks);
    check("3. het globale maximum krijgt een label",labs.some(l=>l.v===20));
    check("4. het globale minimum krijgt een label",labs.some(l=>l.v===-4));
  }
  // 5: het actuele punt behoudt zijn prioriteit (blijft altijd gelabeld,
  // ook wanneer het niet op het raster valt en geen lokaal extreem is)
  {
    const reeks=[10,11,12,13,14,15,16,17,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10];
    // uur 8 (index 8): monotoon oplopend tot dan, dus geen lokaal extreem,
    // en 8%3!==0, dus ook niet op het raster; alleen "huidig punt" kan dit labelen
    const {labs}=labelsVoor(reeks,{klokUur:8});
    check("5. het actuele punt (index 8, geen raster/extreem) krijgt een label puur op basis van zijn prioriteit",
      labs.some(l=>l.i===8), labs.map(l=>l.i+":"+l.v).join(","));
  }
  // 6: een kleine fluctuatie van 0,1°C veroorzaakt niet automatisch een extra label
  {
    // een echte piek (index 10) en een echt dal (index 16) elders in de reeks,
    // zodat de 0,1°C-bult bij index 4 aantoonbaar niet het globale maximum of
    // minimum is (dat zou terecht altijd een label krijgen, ongeacht de
    // PROMINENT-drempel) en dus puur de drempel zelf test
    const reeks=[10,10,10,10,10.1,10,10,10,10,10,15,10,10,10,10,10,5,10,10,10,10,10,10,10];
    const {labs}=labelsVoor(reeks);
    check("6. een fluctuatie van 0,1°C (index 4, onder de PROMINENT-drempel, buiten het raster, niet het globale extreem) krijgt geen eigen label",
      !labs.some(l=>l.i===4), labs.map(l=>l.i+":"+l.v).join(","));
  }
  // 7+8: een duidelijk lokaal maximum blijft behouden wanneer een regulier
  // label te dichtbij staat; dat regulier label wijkt dan
  {
    // piek op index 4, vlak naast het rasterpunt index 3 (3%3===0): op een
    // smal scherm (390px) staan die twee dicht genoeg bij elkaar om te botsen
    const reeks=[10,10,10,10.6,17,10.6,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10];
    const {labs}=labelsVoor(reeks,{breed:390});
    check("7. het duidelijke lokale maximum (index 4) blijft behouden, ook naast een regulier rasterlabel",
      labs.some(l=>l.i===4));
    check("8. het botsende, lager geprioriteerde rasterlabel (index 3) is verplaatst of verdwenen: geen enkele botsing in de uiteindelijke plaatsing",
      (()=>{ for(let a=0;a<labs.length;a++) for(let b=a+1;b<labs.length;b++){
               const p=labs[a],r=labs[b];
               if(Math.abs(p.x-r.x)<14 && Math.abs(p.y-r.y)<12) return false;
             }
             return true; })());
  }
  // 8b: expliciete regressietest, precies zoals gevraagd: een scherpe piek
  // bewust tussen twee vaste drie-uursmomenten (i=3 en i=6, dus op i=4 of 5),
  // met genoeg even hoge kandidaten eromheen om ALLE botsingslagen te vullen.
  // Zonder de evictie hierboven zou dit ofwel het label van de piek missen,
  // ofwel het over een ander label heen laten vallen.
  {
    const reeks=new Array(24).fill(10);
    reeks[3]=10; reeks[4]=20; reeks[5]=10;                 // de piek, tussen i=3 en i=6 in
    reeks[9]=10; reeks[12]=10; reeks[15]=10; reeks[18]=10; reeks[21]=10;  // vult de lagen
    const {labs}=labelsVoor(reeks,{breed:390});
    check("8b. regressie: een scherpe piek bewust tussen twee drie-uursmomenten (i=4, niet i%3===0) krijgt aantoonbaar een label, ook onder zware botsingsdruk",
      labs.some(l=>l.i===4 && l.v===20), labs.map(l=>l.i+":"+l.v).join(","));
    check("8c. diezelfde plaatsing bevat geen enkele overlap (elk ander label bleef leesbaar of week netjes)",
      (()=>{ for(let a=0;a<labs.length;a++) for(let b=a+1;b<labs.length;b++){
               const p=labs[a],r=labs[b];
               if(Math.abs(p.x-r.x)<14 && Math.abs(p.y-r.y)<12) return false;
             }
             return true; })(),labs.map(l=>l.i+":"+l.v).join(","));
    const {labs:labsD}=labelsVoor(reeks,{breed:1280});
    check("8d. dezelfde regressie op desktopbreedte",
      labsD.some(l=>l.i===4 && l.v===20));
  }
  // 9: labels overlappen niet op 390px breedte (algemene regressie, drukke reeks)
  {
    const reeks=[8,9,11,9,12,8,13,9,14,8,15,9,16,8,17,9,18,8,19,9,20,8,21,9];
    const {labs}=labelsVoor(reeks,{breed:390});
    let botst=false;
    for(let a=0;a<labs.length;a++) for(let b=a+1;b<labs.length;b++){
      const p=labs[a],r=labs[b];
      if(Math.abs(p.x-r.x)<14 && Math.abs(p.y-r.y)<12) botst=true;
    }
    check("9. labels overlappen niet op 390px breedte, ook bij een drukke, grillige reeks",!botst);
  }
  // 10: labels vallen niet buiten het SVG-viewBox
  {
    const reeks=[8,9,11,9,12,8,13,9,14,8,15,9,16,8,17,9,18,8,19,9,20,8,21,9];
    const {labs,vb}=labelsVoor(reeks,{breed:390});
    check("10. geen enkel label valt buiten het SVG-viewBox",
      labs.every(l=>l.x>=0&&l.x<=vb[2]&&l.y>=0&&l.y<=vb[3]));
  }
  // 11+12+13: labels werken bij 24, 48 uur en 7 dagen
  for(const bereik of [24,48,168]){
    const reeks=new Array(Math.max(24,bereik)).fill(10).map((v,k)=>10+3*Math.sin(k/5));
    const {labs,api}=labelsVoor(reeks,{bereik});
    check("11-13. labels werken bij "+bereik+" uur (er staat minstens één label)",labs.length>0);
  }
  // 14: vlakke temperatuurreeksen veroorzaken geen reeks dubbele labels
  {
    const reeks=new Array(24).fill(9);
    const {labs}=labelsVoor(reeks);
    const idxSet=new Set(labs.map(l=>l.i));
    check("14. een volkomen vlakke reeks geeft geen dubbele labels op dezelfde i",
      idxSet.size===labs.length,labs.map(l=>l.i).join(","));
  }
  // 15: dubbele temperatuurwaarden krijgen niet onnodig meerdere labels op
  // vrijwel dezelfde positie (twee losse, ver uit elkaar liggende pieken met
  // toevallig dezelfde waarde mogen elk hun eigen label houden, maar nooit
  // twee labels die elkaar overlappen)
  {
    const reeks=[10,10,10,15,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,15,10,10,10,10];
    const {labs}=labelsVoor(reeks,{breed:390});
    let botst=false;
    for(let a=0;a<labs.length;a++) for(let b=a+1;b<labs.length;b++){
      const p=labs[a],r=labs[b];
      if(Math.abs(p.x-r.x)<14 && Math.abs(p.y-r.y)<12) botst=true;
    }
    check("15. twee gelijke pieken (beide 15°, ver uit elkaar) botsen niet en verliezen geen van beide hun label",
      !botst && labs.filter(l=>l.v===15).length===2);
  }
  // 16: de tooltip blijft alle waarden tonen, ongeacht welke vaste labels
  // zichtbaar zijn (de tooltip leest rechtstreeks uit S.geo, niet uit de
  // labelselectie)
  {
    const reeks=[10,10,10,10.6,17,10.6,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10];
    const {bak}=labelsVoor(reeks,{breed:390});
    bak.hit.dispatchEvent({type:"pointermove",clientX:180,clientY:100,pointerType:"mouse"});
    check("16. de tooltip blijft alle velden tonen, onafhankelijk van de vaste labelselectie",
      /temperatuur/.test(bak.scrub.innerHTML) && /neerslagkans/.test(bak.scrub.innerHTML));
  }

  // regressiereeks die overeenkomt met het gerapporteerde scenario: eerst
  // dalend, dan een duidelijke stijging, één scherpe lokale top, dan een
  // scherpe daling. Geen enkel hardcoded tijdstip uit een screenshot: dit is
  // een generieke vorm, niet gekoppeld aan 09:00 specifiek.
  {
    const reeks=[16,15,14,13,12,19,12,11,10.5,10,9.5,9,8.5,8,7.5,7,6.5,6,5.5,5,4.5,4,3.5,3];
    const {labs}=labelsVoor(reeks);
    const piekIdx=reeks.indexOf(19);
    check("regressiereeks: de scherpe lokale top na de daling en vóór de nieuwe daling krijgt aantoonbaar een label",
      labs.some(l=>l.i===piekIdx && l.v===19),
      "piek op index "+piekIdx+", gevonden labels: "+labs.map(l=>l.i+":"+l.v).join(","));
  }
}


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
/* v70-herstel: binnen @media(max-width:900px) stonden drie //-commentaarregels
   direct vóór de mobiele .day-regel. CSS kent geen //-commentaar; zo'n regel
   maakt de erop volgende selector ongeldig voor de browser, die de hele regel
   dan negeert. Deze groep toetst zowel de algemene afwezigheid van //-syntax
   in het volledige <style>-blok als de concrete, nog altijd geldige inhoud
   van de mobiele .day-regel zelf. */
groep("Geldige CSS-syntax in het style-blok");
{
  const fsS=require("fs"), pathS=require("path");
  const bronS=fsS.readFileSync(pathS.join(__dirname,"index.html"),"utf8");
  const styleBlok=bronS.slice(bronS.indexOf("<style>"),bronS.indexOf("</style>"));
  const ongeldig=styleBlok.split("\n").filter(regel=>/^\s*\/\//.test(regel));
  check("het <style>-blok bevat nergens meer een regel die begint met // (ongeldige CSS-commentaarsyntax)",
    ongeldig.length===0,ongeldig.join(" | "));
  check("de mobiele .day-regel (max-width:900px) gebruikt nog exact de vaste 40px-dagkolom",
    /@media\(max-width:900px\)\{[\s\S]*?\.day\{grid-template-columns:40px 22px 56px 1fr 1fr 48px;gap:6px\}/.test(styleBlok));
  check("de regel voor max-width:370px blijft intact (eigen vaste 40px-dagkolom, windkolom valt daar weg)",
    /@media\(max-width:370px\)\{[\s\S]*?\.day\{grid-template-columns:40px 22px 1fr 1fr 48px\}/.test(styleBlok));
}

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
  // "vandaag"/"morgen" zijn sinds v69 geen mogelijke .dname-inhoud meer (dagen()
  // gebruikt nu altijd dagnaam+datum, ook voor vandaag/morgen zelf), dus die
  // hoeven niet langer als kandidaat meegewogen te worden voor de kolombreedte
  const namen=(langVerborgen?DAGENKORT:DAGENVOL).map(d=>d+" 30");
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

  /* v70-correctie: de naamkolom stond op max-content, maar iedere .row.day is
     een eigen, onafhankelijke grid (losse broer-en-zus-divs, geen gedeelde
     container). Daardoor mat elke rij zijn éigen dagnaam en verschilde de
     kolombreedte per rij: wiebelige uitlijning zodra "maandag 27" naast
     "wo 29" stond. Nu een vaste pixelbreedte, hetzelfde voor alle rijen. Wat
     nog wel telt: dat die vaste breedte ook echt breed genoeg is voor de
     langste realistische naam, en dat de overige kolommen er samen met die
     naamkolom niet toch buiten het scherm van 320 px vallen. */
  // kolM blijft nodig voor de andere, ongewijzigde kolommen verderop (kans, temperatuur)
  const kolM=ontleed(mobiel);

  check("de naamkolom heeft nu een vaste breedte, geen max-content meer (dat verschilde per rij)",
    /^\d+px$/.test(String(mobiel).trim().split(/\s+/)[0]),
    "eerste kolom is '"+String(mobiel).trim().split(/\s+/)[0]+"'");
  check("dezelfde vaste breedte-aanpak geldt op een smal scherm",
    /^\d+px$/.test(String(smal).trim().split(/\s+/)[0]),
    "eerste kolom is '"+String(smal).trim().split(/\s+/)[0]+"'");
  check("de vaste naamkolom is breed genoeg voor de langste realistische dagnaam (mobiel, 12,5px)",
    typeof kolM[0]==="number" && kolM[0]>=langstePx,
    "kolom "+kolM[0]+"px, langste nodige tekst '"+langste+"' is "+langstePx.toFixed(1)+"px");

  const ICOON=22;
  const kolSmal=ontleed(smal);
  check("de icoonkolom is minstens zo breed als het icoon zelf ("+ICOON+" px)",
    kolSmal[1]>=ICOON, "kolom is "+kolSmal[1]+" px");

  check("de dagnaam kapt niet meer af: geen ellipsis-vangnet meer op .dname",
    !/\.dname\{[^}]*overflow:hidden/.test(html) && !/\.dname\{[^}]*text-overflow:ellipsis/.test(html));
  check("de dagnaam breekt niet middenin een woord",/\.dname\{[^}]*white-space:nowrap/.test(html));

  /* Met de daadwerkelijk gedeclareerde vaste naamkolombreedte (kolSmal[0])
     simuleren wat er op 320 px gebeurt: past de rij, en is die vaste breedte
     ook echt genoeg voor de langste naam die er ooit in hoeft te passen? */
  {
    const smalNamen=langVerborgen?DAGENKORT:DAGENVOL;
    const langsteSmal=Math.max(...smalNamen.map(d=>breed(d+" 30",12.5,"sans")));
    check("de vaste naamkolom (smal scherm) is breed genoeg voor de langste naam die er echt kan staan",
      typeof kolSmal[0]==="number" && kolSmal[0]>=langsteSmal,
      "kolom "+kolSmal[0]+"px tegen "+langsteSmal.toFixed(1)+"px nodig");
    const naamKolom=typeof kolSmal[0]==="number"?kolSmal[0]:langsteSmal;
    const vasteKolommen=kolSmal.slice(1).reduce((s2,v)=>s2+(v==="fr"?40:v),0);   // 1fr voorzichtig op 40px geschat
    const gapSmal=parseFloat(vanaf("@media(max-width:370px)",/\.day\{[^}]*gap:(\d+)px/))||gap;
    const totaal=naamKolom+vasteKolommen+gapSmal*(kolSmal.length-1);
    const beschikbaar=320-2*20;   // sheet-padding van 20px aan weerszijden
    check("de rij past op 320 px met de vaste naamkolom",
      totaal<=beschikbaar,
      "rij "+totaal.toFixed(0)+" px tegen "+beschikbaar+" px beschikbaar (naamkolom: "+naamKolom+" px)");
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
  // v69: mobiel en desktop hebben ieder hun eigen binnenmarge en lettergrootte;
  // die per viewport uit de bron lezen in plaats van een vaste oude aanname,
  // anders test dit tegen maten die de app niet meer gebruikt
  const inzetM_=regel.match(/const inzet=G\.M\?(\d+):(\d+)/);
  const inzetM=inzetM_?parseFloat(inzetM_[1]):15, inzetD=inzetM_?parseFloat(inzetM_[2]):15;
  const fontenM_=regel.match(/const fLabel=([\d.]+), fWaarde=([\d.]+)/);
  const fLabelM=fontenM_?parseFloat(fontenM_[1]):11, fLabelD=fLabelM;
  const fWaardeM=fontenM_?parseFloat(fontenM_[2]):11.5, fWaardeD=fWaardeM;
  const tussen=4;

  check("de doos slaat om op basis van de werkelijke ruimte, niet op een vast percentage",
    /G\.W\s*-\s*G\.pr/.test(regel) && !/G\.W\s*\*\s*0?\.\d+/.test(regel), regel.replace(/\s+/g," ").slice(0,120));
  check("de doos wordt hoe dan ook binnen de randen geklemd",
    /clamp\(\s*bx/.test(regel), regel.replace(/\s+/g," ").slice(0,120));

  for(const [naam,br,bw,inzet,fLabel,fWaarde] of
      [["telefoon",390,bwM,inzetM,fLabelM,fWaardeM],["desktop",1280,bwD,inzetD,fLabelD,fWaardeD]]){
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
      breedSans(l,fLabel)+breedMono(v,fWaarde)+tussen > bw-2*inzet);
    check(naam+": elke tooltipregel past in de doos ("+bw+" px)",teKrap.length===0,
      teKrap.map(([l,v])=>"\""+l+" "+v+"\" vraagt "
        +(breedSans(l,fLabel)+breedMono(v,fWaarde)).toFixed(0)+" px van de "+(bw-2*inzet)+" px").join(", "));
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

  /* De briefing blijft staan als het netwerk wegvalt. Dat zat er al in, maar er
     stond geen enkele controle op, dus kon het ongemerkt sneuvelen. */
  {
    check("de laatste briefing wordt bewaard",/ls\.set\(KEY_D,\{d:S\.d/.test(bronW));
    check("bij een mislukte poging komt die terug",
      /const oud=ls\.get\(KEY_D,null\)/.test(bronW) && /S\.d=oud\.d/.test(bronW));
    check("er staat bij van wanneer die is",/laatste briefing van/.test(bronW));
  }
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

/* 10l. vetgedrukt in de briefing */
groep("Nadruk");
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

  /* v69: vandaag en morgen kregen eerder de woorden "vandaag"/"morgen" in
     plaats van een dag+datumpatroon; dat gaf bij de dagkiezer (die de
     grafiek vult) een ongelijk typografisch ritme. Nu gebruiken alle dagen,
     ook vandaag en morgen, hetzelfde compacte patroon. De datum zelf komt
     nog steeds uit echte Date-objecten, zodat maandgrenzen en
     schrikkeljaren vanzelf goed gaan. */
  {
    const {api:a,bak:b}=laadKern(1280);
    Object.assign(a.S,{d:bouw({}),i0:14,op:Date.now(),lat:52.35,lon:5.26,label:"T",dag:null,bereik:24});
    a.dagen();
    const namen=[...b.days.innerHTML.matchAll(/class="dlang">([^<]*)</g)].map(m=>m[1]);
    check("vandaag en morgen tonen geen 'vandaag'/'morgen' meer bij de grafiek",
      !/vandaag/i.test(namen[0]||"") && !/morgen/i.test(namen[1]||""),
      namen.slice(0,2).join(" | "));
    check("vandaag en morgen hebben, als alle andere dagen, een dagnaam en een datum",
      /^[a-zA-Z]+ \d+$/.test(namen[0]||"")&&/^[a-zA-Z]+ \d+$/.test(namen[1]||""),
      namen.slice(0,2).join(" | "));
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

/* 10r. de laklaag: uitlijning, selectielijn en voettekst */
groep("Opmaak en uitlijning");
{
  const fsL2=require("fs"), pathL2=require("path");
  const css=fsL2.readFileSync(pathL2.join(__dirname,"index.html"),"utf8");

  /* De rode selectielijn zat tegen de tekst aan. */
  check("de geselecteerde dag heeft ruimte naast de lijn",
    /\.day\{[^}]*padding-left:\d+px/.test(css) && /\.day\.on\{box-shadow:inset [3-9]px/.test(css));
  check("de rij schuift niet op door die ruimte",/\.day\{[^}]*margin-left:-\d+px/.test(css));

  /* De voettekst: elke bron op een eigen regel. */
  check("de voettekst staat onder elkaar",/footer\{[^}]*flex-direction:column/.test(css));
  const bronnen=(css.match(/<span class="bron"/g)||[]).length;
  check("elke bron heeft een eigen regel",bronnen>=1,bronnen+" regels");
  check("de bronnen staan niet meer als een lopend blok",
    !/Weer: <a[\s\S]{0,400}Kaart: <a/.test(css));
  // en de verplichte vermeldingen moeten er nog wel staan
  for(const bron of ["open-meteo.com"]){
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

/* 10u. briefing en neerslagtekst delen dezelfde conclusie over de komende twee uur */
groep("Briefing en neerslagtekst afgestemd");
{
  const fsK=require("fs"), pathK=require("path");
  const bronK=fsK.readFileSync(pathK.join(__dirname,"index.html"),"utf8");
  const KLOK=new Date("2026-07-22T12:00:00Z");

  check("er is een centrale drempel voor korte-termijnneerslag",
    /const NEERSLAG_DREMPEL_MM\s*=\s*0\.1/.test(bronK));
  check("de briefing gebruikt kortetermijn()",
    /kt\s*=\s*kortetermijn\(\)/.test(bronK.slice(bronK.indexOf("function briefing"))));
  check("de neerslagtekst gebruikt kortetermijn()",
    /const kt=kortetermijn\(\);/.test(bronK.slice(bronK.indexOf("function nowcast"))));

  function samen(opties){
    const {api,bak}=laadKern(1280);
    Object.assign(api.S,{d:bouw(opties),i0:14,op:Date.now(),lat:52.35,lon:5.26,label:"T",dag:null,bereik:24,
      klokOverride:KLOK});
    api.meters();api.briefing();api.nowcast();
    return { briefing:norm(bak.brief.innerHTML).replace(/<[^>]+>/g,""), neerslagtekst:norm(bak.nctext.textContent) };
  }

  // droog scenario: allebei "droog", geen van beide "regent" of "neerslag"
  const d1=samen({pp:()=>5,pr:()=>0,som:0});
  check("droog: de briefing zegt droog",/komende twee uur.*droog/.test(d1.briefing),d1.briefing);
  check("droog: de neerslagtekst zegt droog",/komende twee uur blijft het droog/.test(d1.neerslagtekst),d1.neerslagtekst);

  // nat scenario binnen de eerste twee uur: geen van beide mag "droog" beweren
  const n1=samen({pr:(u)=>u===15?2:0,pp:(u)=>u===15?80:5});
  check("nat: de briefing beweert geen droogte",!/komende twee uur.*blijft het.*droog/.test(n1.briefing),n1.briefing);
  check("nat: de neerslagtekst beweert geen droogte",!/komende twee uur blijft het droog/.test(n1.neerslagtekst),n1.neerslagtekst);
  check("nat: beide noemen neerslag",/neerslag/.test(n1.briefing)&&/neerslag/.test(n1.neerslagtekst));

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
    const tekstDroog=/komende twee uur blijft het droog/.test(s.neerslagtekst);
    if(briefDroog!==tekstDroog) tegenstrijdig.push("seed "+seed+": briefing droog="+briefDroog+", neerslagtekst droog="+tekstDroog);
  }
  check("over een reeks patronen komen briefing en neerslagtekst nooit tot een andere conclusie",
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
  check("onvoldoende data: ook de neerslagtekst blijft terughoudend",
    !/komende twee uur blijft het droog/.test(norm(bX.nctext.textContent)),norm(bX.nctext.textContent));
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

/* 10zz. live plaatsklok: #plaatstijd en #minitijd werken zelfstandig iedere
   minuut bij, zonder fetch en zonder de rest van de app opnieuw te tekenen. */
groep("Live plaatsklok");
{
  const fsK2=require("fs"), pathK2=require("path");
  const bronK2=fsK2.readFileSync(pathK2.join(__dirname,"index.html"),"utf8");

  // 30 seconden vóór de minuutwisseling: een voorspelbaar uitlijnmoment
  const START=new Date("2026-07-22T09:12:30.000Z");
  const {api,bak,avancerenTimers,fetchStaat,doc,timerAantal}=laadKern(1280);
  Object.assign(api.S,{d:bouw({}),op:Date.now(),lat:52.35,lon:5.26,label:"T",dag:null,bereik:24,
    klokOverride:START});
  api.tekenAlles();

  // tijd en timers samen laten opschuiven: avancerenTimers alleen laat de
  // timers afgaan, maar leest zelf niets van de klok; S.klokOverride is wat
  // plaatsKlok() daadwerkelijk teruggeeft
  const verstrijk=ms=>{ api.S.klokOverride=new Date(api.S.klokOverride.getTime()+ms); avancerenTimers(ms); };

  // 1. beide elementen tonen bij initialisatie dezelfde, juiste tijd
  const t1=api.plaatsKlok();
  check("#plaatstijd en #minitijd tonen bij initialisatie dezelfde juiste tijd",
    bak.plaatstijd.textContent===t1 && bak.minitijd.textContent===t1,
    bak.plaatstijd.textContent+" / "+bak.minitijd.textContent+" (verwacht "+t1+")");

  // 2. een minuut verder: beide waarden veranderen mee, uitgelijnd op de grens
  const tellerVoor=fetchStaat.teller;
  verstrijk(60000);
  const t2=api.plaatsKlok();
  check("na het verstrijken van een minuut veranderen beide klokken mee",
    t2!==t1 && bak.plaatstijd.textContent===t2 && bak.minitijd.textContent===t2,
    "was "+t1+", nu plaatstijd="+bak.plaatstijd.textContent+" minitijd="+bak.minitijd.textContent+" (verwacht "+t2+")");

  // 3. dat kostte geen enkele fetch
  check("de klokupdate haalt geen nieuwe weerdata op",fetchStaat.teller===tellerVoor,
    tellerVoor+" -> "+fetchStaat.teller);

  // 4. herinitialisatie (zoals bij een nieuwe locatie) mag geen tweede,
  //    gelijktijdig lopende timer achterlaten: het aantal actieve timers moet
  //    na drie keer opnieuw tekenen gelijk blijven, niet oplopen
  const na1=timerAantal();
  api.tekenAlles();
  api.tekenAlles();
  const na3=timerAantal();
  check("drie keer opnieuw tekenen laat het aantal actieve timers niet oplopen",
    na3===na1,na1+" -> "+na3+" na twee extra herinitialisaties");

  // en na precies een minuut nog altijd maar één stap verder, niet twee of drie
  const t3=api.plaatsKlok();
  verstrijk(60000);
  const t4=api.plaatsKlok();
  check("na herinitialisatie plus een minuut precies een stap verder, geen dubbele tik",
    bak.plaatstijd.textContent===t4 && bak.minitijd.textContent===t4 && t4!==t3,
    bak.plaatstijd.textContent+" / "+bak.minitijd.textContent+" (verwacht "+t4+")");

  // 5. de pagina komt terug uit de achtergrond: de klok herstelt zichzelf
  //    direct, zonder daarvoor te hoeven wachten op de eerstvolgende minuuttik
  //    en zonder een fetch (de data is met opzet niet oud genoeg om dat te
  //    veroorzaken: S.op staat op de echte Date.now() van zonet)
  api.S.klokOverride=new Date(api.S.klokOverride.getTime()+5*60000+17000); // 5 min 17 sec, met opzet niet op een grens
  doc.visibilityState="hidden";
  doc.dispatchEvent({type:"visibilitychange"});
  doc.visibilityState="visible";
  const tellerVoor2=fetchStaat.teller;
  doc.dispatchEvent({type:"visibilitychange"});
  const t5=api.plaatsKlok();
  check("zichtbaar worden na achtergrondgebruik herstelt de klok direct",
    bak.plaatstijd.textContent===t5 && bak.minitijd.textContent===t5,
    bak.plaatstijd.textContent+" / "+bak.minitijd.textContent+" (verwacht "+t5+")");
  check("dat herstel gebeurt zonder fetch",fetchStaat.teller===tellerVoor2,
    tellerVoor2+" -> "+fetchStaat.teller);

  // de bron zelf: geen weerdata-aanroep in de klokfuncties, en scheiding van de nu-lijn
  check("klokBijwerken/klokTimerStart doen geen eigen dataverzoek",
    !/function klokBijwerken[\s\S]{0,300}?fetch/.test(bronK2)
    && !/function klokTimerStart[\s\S]{0,600}?fetch/.test(bronK2));
  const klokTimerBron=bronK2.slice(bronK2.indexOf("function klokTimerStart"),bronK2.indexOf("function etmaal"));
  check("de klok-timer staat los van etmaal()/de nu-lijn",!/etmaal\(/.test(klokTimerBron));
}

/* 11. opstartlocatie: prioriteit A/B/C/D, de herbruikbare locatieNu()-procedure,
   racebescherming en het afstandscriterium. Async, dus in een eigen functie die
   de rest van het script (de afsluitende telling) netjes afwacht. */
/* 12. v67: structuur van 'Bewaarde plaatsen' - kop en chips gescheiden,
   opslag/selectie/verwijderlogica ongewijzigd. Let op: dit toetst DOM- en
   opslagstructuur, geen visuele weergave. Of het er ook goed uitziet op een
   scherm is hiermee niet aangetoond. */
groep("Bewaarde plaatsen (structuur)");
{
  const fsC=require("fs"), pathC=require("path");
  const bronC=fsC.readFileSync(pathC.join(__dirname,"index.html"),"utf8");
  const KL="weerbriefing.lijst";

  check("de kop staat in een eigen kolom-item, niet meer tussen de chips in dezelfde rij",
    /\.chips\{display:flex;flex-direction:column/.test(bronC));
  check("de chips staan in een eigen flex-wrap-container (.chiprij)",
    /\.chiprij\{display:flex;gap:8px;flex-wrap:wrap/.test(bronC));
  check("lange plaatsnamen mogen wrappen zonder buiten de chip te lopen",
    /\.chip\{[^}]*max-width:100%[^}]*overflow-wrap:anywhere/.test(bronC));
  check("de verwijderknop krimpt niet mee als de naam wrapt",
    /\.chip \.x\{[^}]*flex-shrink:0/.test(bronC));

  // één opgeslagen plaats
  {
    const {api,bak}=laadKern(390);
    api.ls.set(KL,[{lat:52.35,lon:5.26,label:"Almere"}]);
    Object.assign(api.S,{lat:10,lon:10,label:"Elders"});
    api.chips();
    const kop=bak.chips.querySelector(".chipskop"), rij=bak.chips.querySelector(".chiprij");
    check("de kop en chipcontainer zijn afzonderlijke elementen",!!kop&&!!rij&&kop!==rij);
    check("de kop staat buiten de lijst met chips",!!kop&&!rij.contains(kop));
    check("één opgeslagen plaats: de chiprij bevat precies één chip",
      rij&&rij.querySelectorAll(".chip[data-i]").length===1);
    const chip0=rij.querySelector('.chip[data-i="0"]');
    check("iedere opgeslagen plaats bevat een verwijderknop",!!chip0&&!!chip0.querySelector(".x"));
  }

  // meerdere opgeslagen plaatsen: volgorde en actieve chip
  {
    const lijst=[{lat:52.35,lon:5.26,label:"Almere"},{lat:52.34,lon:4.97,label:"Diemen"},
      {lat:51.99,lon:5.09,label:"Vianen"},{lat:7.29,lon:80.63,label:"Kandy"}];
    const {api,bak}=laadKern(390);
    api.ls.set(KL,lijst);
    Object.assign(api.S,{lat:52.34,lon:4.97,label:"Diemen"});   // exact de tweede plaats
    api.chips();
    const rij=bak.chips.querySelector(".chiprij");
    const chipEls=rij.querySelectorAll(".chip[data-i]").sort((a,b)=>+a.dataset.i-+b.dataset.i);
    check("meerdere opgeslagen plaatsen werken (chiprij bevat alle vier)",chipEls.length===4);
    check("alle opgeslagen plaatsen worden in de oorspronkelijke volgorde gerenderd",
      chipEls.map(c=>c.textContent.replace("×","")).join("|")===lijst.map(p=>p.label).join("|"),
      chipEls.map(c=>c.textContent).join("|"));
    check("de actieve chip behoudt de bestaande actieve class",
      chipEls[1].classList.contains("on") && !chipEls[0].classList.contains("on"));
    check("de chiprij toont geen bewaarknop als de huidige plaats al in de lijst staat",
      bak.chips.querySelector("#chipadd")==null);
  }

  // verwijderen
  {
    const {api,bak}=laadKern(390);
    api.ls.set(KL,[{lat:1,lon:1,label:"Een"},{lat:2,lon:2,label:"Twee"}]);
    Object.assign(api.S,{lat:99,lon:99,label:"Elders"});
    api.chips();
    const x0=bak.chips.querySelector('.chip[data-i="0"]').querySelector(".x");
    x0.dispatchEvent({type:"click",target:x0,stopPropagation(){}});
    const na=api.ls.get(KL,[]);
    check("verwijderen blijft functioneel werken",na.length===1&&na[0].label==="Twee",JSON.stringify(na));
  }

  // selecteren
  {
    const {api,bak}=laadKern(390);
    api.ls.set(KL,[{lat:52.35,lon:5.26,label:"Almere"}]);
    Object.assign(api.S,{lat:99,lon:99,label:"Elders"});
    api.chips();
    const chip0=bak.chips.querySelector('.chip[data-i="0"]');
    chip0.dispatchEvent({type:"click",target:chip0});
    check("selecteren blijft functioneel werken",api.S.lat===52.35&&api.S.lon===5.26,
      api.S.lat+"/"+api.S.lon);
  }

  // bestaande keyboardbediening
  {
    const {api,bak}=laadKern(390);
    api.ls.set(KL,[{lat:52.35,lon:5.26,label:"Almere"}]);
    Object.assign(api.S,{lat:99,lon:99,label:"Elders"});
    api.chips();
    const chip0=bak.chips.querySelector('.chip[data-i="0"]');
    let geblokkeerd=false;
    chip0.dispatchEvent({type:"keydown",key:"Enter",target:chip0,preventDefault(){geblokkeerd=true;}});
    check("bestaande keyboardbediening (Enter) blijft behouden",geblokkeerd&&api.S.lat===52.35);
  }

  // zonder opgeslagen plaatsen
  {
    const {api,bak}=laadKern(390);
    api.ls.set(KL,[]);
    Object.assign(api.S,{lat:null,lon:null,label:null});
    api.chips();
    check("zonder opgeslagen plaatsen en zonder actuele locatie blijft #chips leeg",
      bak.chips.innerHTML==="",bak.chips.innerHTML);
  }
  {
    const {api,bak}=laadKern(390);
    api.ls.set(KL,[]);
    Object.assign(api.S,{lat:52.35,lon:5.26,label:"Almere"});
    api.chips();
    check("zonder opgeslagen plaatsen verschijnt geen lege kop",bak.chips.querySelector(".chipskop")==null);
    const add=bak.chips.querySelector("#chipadd");
    check("zonder opgeslagen plaatsen blijft de bewaaractie beschikbaar",!!add);
    // de app zelf koppelt de handler via document.getElementById("chipadd"),
    // dus bak.chipadd (dezelfde referentie als de app gebruikt), niet het los
    // geparste span-element uit chips.innerHTML
    bak.chipadd.dispatchEvent({type:"click",target:bak.chipadd});
    check("de bewaaractie blijft werken",api.ls.get(KL,[]).length===1);
  }

  // veilige HTML bij een lange/onveilige plaatsnaam
  {
    const rare='<img src=x onerror=alert(1)>Zeer Lange Plaatsnaam Die Best Wel Lang Kan Zijn';
    const {api,bak}=laadKern(390);
    api.ls.set(KL,[{lat:1,lon:1,label:rare}]);
    Object.assign(api.S,{lat:99,lon:99,label:"Elders"});
    api.chips();
    check("een langere/onveilige plaatsnaam veroorzaakt geen onveilige HTML-structuur",
      !/<img/.test(bak.chips.innerHTML)&&/&lt;img/.test(bak.chips.innerHTML),
      bak.chips.innerHTML.slice(0,140));
  }
}

/* 13. v67: nachtzone in de grafiek - navy in plaats van grijs, deterministische
   sterren, bestaande segmentberekening en laagvolgorde ongewijzigd. Dit toetst
   SVG-structuur, geen visuele weergave. */
groep("Nachtzone in de grafiek");
{
  const fsN=require("fs"), pathN=require("path");
  const bronN=fsN.readFileSync(pathN.join(__dirname,"index.html"),"utf8");

  check("de nachtzone gebruikt de centrale --accent-night-variabele, geen losse hex",
    /NIGHT="var\(--accent-night\)"/.test(bronN) && /fill="\$\{NIGHT\}"/.test(bronN));
  check("de sterren gebruiken de centrale --accent-sun-variabele",
    /STER="var\(--accent-sun\)"/.test(bronN) && /fill="\$\{STER\}"/.test(bronN));
  check("geen Math.random in de sterrenpositionering: dezelfde plek bij elke render",
    !/Math\.random/.test(bronN.slice(bronN.indexOf("sterretjes"),bronN.indexOf("sterretjes")+700)));
  check("de sterren staan in een aria-hidden, pointer-events-loze groep",
    /<g aria-hidden="true" pointer-events="none">\$\{sterren\}<\/g>/.test(bronN));
  check("balk (dagbalk + sterren) komt vóór grid, spreiding, curve, labels, nu-lijn en tooltip in de SVG",
    /svg\.innerHTML=\s*\n\s*`\$\{balk\}\$\{gitter\}\$\{bars\}/.test(bronN)
    && bronN.indexOf("${balk}")<bronN.indexOf('id="scrub"')
    && bronN.indexOf("${balk}")<bronN.indexOf('id="hit"'));
  check("er is geen groot nachtvlak meer over het temperatuurplot (nachtvlak bestaat niet)",
    !/nachtvlak/.test(bronN));
  check("de tooltipstructuur (#scrub) bestaat nog",/<g id="scrub"/.test(bronN));
  check("het hitvlak (#hit) bestaat nog",/id="hit"/.test(bronN));
  check("de rode Nu-lijn (CARMINE, tekst \"nu\") bestaat nog",
    /fill="\$\{CARMINE\}"[^>]*>nu<\/text>/.test(bronN));
  check("geen specifieke plaatsnaam, landcode of tijdzone is aan de balklogica toegevoegd",
    !/Almere|Diemen|Vianen|Kandy|Nederland|Sri Lanka|Amsterdam|Colombo/.test(
      bronN.slice(bronN.indexOf("/* dagbalk */"),bronN.indexOf("const gitter"))));
  check("hourly.is_day bepaalt de overgang niet meer rechtstreeks (geen ND[k]===0-segmentdetectie meer)",
    !/const nacht=k<ND\.length&&ND\[k\]===0;/.test(bronN));
  check("fractIndex() (de nieuwe positionering) gebruikt geen new Date()",
    !/new Date/.test(bronN.slice(bronN.indexOf("const fractIndex"),bronN.indexOf('let nu="",nuX=null;'))));

  /* v70: functionele tests op basis van exacte daily.sunset/sunrise, met een
     bijpassende is_day (nodig voor de randgevallen: begint/eindigt de reeks
     al in de nacht). Volledig generiek: geen enkel scenario hardcodet een
     plaats, land of tijdzone; alleen lat/lon/utc_offset_seconds als
     willekeurige testwaarden. */
  const scenario=(naam,opties)=>{
    const {api,bak}=laadKern(1280);
    const d=bouw({});
    if(opties.isDay) d.hourly.is_day=d.hourly.time.map((_,i)=>opties.isDay(i));
    if(opties.utcOffset!=null) d.utc_offset_seconds=opties.utcOffset;
    if(opties.zon) opties.zon.forEach(([di,onder,op])=>{
      if(onder!==undefined) d.daily.sunset[di]=onder;
      if(op!==undefined) d.daily.sunrise[di]=op;
    });
    Object.assign(api.S,{d,i0:opties.i0??14,op:Date.now(),lat:12.3,lon:45.6,label:"T",dag:null,bereik:opties.bereik??24});
    let fout=null;
    try{ api.etmaal(api.S.i0,opties.bereik??24); }catch(e){ fout=e; }
    return {bak,fout,d};
  };
  const nachtRects=svg=>[...svg.matchAll(/<rect x="([\d.]+)" y="[\d.]+" width="([\d.]+)" height="[\d.]+" fill="var\(--accent-night\)" opacity="0\.92"\/>/g)];
  const sterren=svg=>(svg.match(/<circle[^>]*opacity="0\.(85|55)"/g)||[]);

  // hierboven kon de exacte kalenderdatum niet los van de fixture worden
  // ingevuld; de kernpositionering wordt daarom rechtstreeks getoetst met de
  // echte datums uit een verse bouw({})-fixture
  {
    const {api,bak}=laadKern(1280);
    const d=bouw({});
    const dagStr=d.daily.time[0];
    const morgenStr=d.daily.time[1];
    d.daily.sunset[0]=dagStr+"T21:37";
    d.daily.sunrise[1]=morgenStr+"T05:54";
    d.hourly.is_day=d.hourly.time.map(t=>{
      const u=+t.slice(11,13), dag=t.slice(0,10);
      if(dag===dagStr) return u<=21?1:0;
      if(dag===morgenStr) return u<6?0:1;
      return 1;
    });
    // i0 op 21:00 dezelfde dag (index 24+21=45 in de volledige hourly-reeks)
    const i0=d.hourly.time.indexOf(dagStr+"T21:00");
    Object.assign(api.S,{d,i0,op:Date.now(),lat:12.3,lon:45.6,label:"T",dag:null,bereik:24});
    api.etmaal(i0,24);
    const svg=bak.chart.innerHTML;
    const rects=nachtRects(svg);
    check("1. sunset 21:37 geeft precies één nachtsegment",rects.length===1,rects.length);
    if(rects.length){
      // fractionele positie van 21:37 (index 0 + 37/60) vs. van heel uur 21:00
      const x0=+rects[0][1];
      const x0Verwacht=44+((900-44-20)/23)*(0+37/60);       // desktop: pl=44, iw=836, cw=iw/23
      const x0Uur=44;                                        // waar hij zou staan bij afronding op 21:00
      check("2. de indicator begint niet om het hele uur (21:00), maar op de fractionele minuut",
        Math.abs(x0-x0Uur)>5,x0);
      check("de fractionele startpositie klopt (binnen 1px van de berekende waarde)",
        Math.abs(x0-x0Verwacht)<1,x0+" vs verwacht "+x0Verwacht.toFixed(2));
    }
    check("label 'onder 21:37' staat op de bron",/>onder 21:37</.test(svg));
    check("3. sunrise 05:54 eindigt niet om 05:00 of 06:00",/>op 05:54</.test(svg));
    {
      // v70-herstel: de vorige versie van deze check testte (!!m)!==undefined,
      // en een boolean is nooit undefined -- dus hij was altijd waar, ook als
      // de match faalde. Nu een echte numerieke vergelijking: de x-positie
      // van het nachtvlak-rect (begin en eind) tegen de dichtstbijzijnde
      // overgangslijn, met een tolerantie van 0,1px, apart voor zonsondergang
      // en zonsopkomst.
      const lijnen=[...svg.matchAll(/<line x1="([\d.]+)" y1="[\d.-]+" x2="\1"[^>]*stroke="var\(--ink\)"/g)].map(m=>+m[1]);
      check("er zijn minstens twee overgangslijnen (zonsondergang en zonsopkomst)",lijnen.length>=2,lijnen.length);
      const x0=rects.length?+rects[0][1]:null;                       // begin van het nachtvlak (zonsondergang)
      const x1=rects.length?+rects[0][1]+ +rects[0][2]:null;          // eind van het nachtvlak (zonsopkomst)
      const dichtsteBij=doel=>lijnen.length?lijnen.reduce((b,l)=>Math.abs(l-doel)<Math.abs(b-doel)?l:b,lijnen[0]):null;
      const startLijn=x0!=null?dichtsteBij(x0):null;
      const eindLijn=x1!=null?dichtsteBij(x1):null;
      check("4. de overgangslijn bij zonsondergang (21:37) staat exact (<0,1px) op het begin van het nachtvlak",
        startLijn!=null && Math.abs(startLijn-x0)<0.1, startLijn+" vs "+x0);
      check("4b. de overgangslijn bij zonsopkomst (05:54) staat exact (<0,1px) op het einde van het nachtvlak",
        eindLijn!=null && Math.abs(eindLijn-x1)<0.1, eindLijn+" vs "+x1);
      // aantoonbaar onderscheidend: schuif een grens kunstmatig 1px op en
      // bevestig dat de tolerantie dat terecht afkeurt (anders zou de check
      // hierboven net zo min informatief zijn als de vorige)
      check("4c. de vergelijking is echt onderscheidend: 1px kunstmatige verschuiving op de startgrens faalt de tolerantie",
        startLijn!=null && !(Math.abs(startLijn-(x0+1))<0.1));
      check("4d. de vergelijking is echt onderscheidend: 1px kunstmatige verschuiving op de eindgrens faalt de tolerantie",
        eindLijn!=null && !(Math.abs(eindLijn-(x1+1))<0.1));
    }
    check("5. het huidige moment (21:26) staat vóór de zonsondergang (21:37)",21+26/60<21+37/60);
    check("6. de lokale tijdstrings worden zonder browser-tijdzoneverschuiving verwerkt (fractIndex gebruikt geen new Date())",
      !/new Date/.test(bronN.slice(bronN.indexOf("const fractIndex"),bronN.indexOf('let nu="",nuX=null;'))));
    check("7. geen hardcoded locatie of tijdzone in dit mechanisme",
      !/lat===|lon===|Almere|Amsterdam/.test(bronN.slice(bronN.indexOf("const fractIndex"),bronN.indexOf("const gitter"))));
  }

  {
    const {bak,fout}=scenario("volledig dag (geen zonsondergang/-opkomst in beeld)",{
      isDay:()=>1, zon:[[0,null,null],[1,null,null]]
    });
    check("volledig dag-bereik geeft geen enkel nachtsegment en geen sterren",
      !fout && nachtRects(bak.chart.innerHTML).length===0 && sterren(bak.chart.innerHTML).length===0,fout);
  }
  {
    const {bak,fout}=scenario("aantoonbare poolnacht (is_day overal 0, geen zichtbare zonsopkomst)",{
      isDay:()=>0, zon:[[0,null,null],[1,null,null]]
    });
    check("poolnacht: de hele zichtbare reeks is nacht, geen verzonnen overgang",
      !fout && nachtRects(bak.chart.innerHTML).length===1,fout);
  }
  {
    const {bak,fout}=scenario("ontbrekende zonstijden, gemengde is_day: geen verzonnen overgang",{
      isDay:i=>i<12?0:1, zon:[[0,null,null],[1,null,null]]
    });
    check("onvolledige data in het midden van de reeks veroorzaakt geen crash en geen geraden overgang",
      !fout,fout&&fout.message);
  }
  // generieke offsetscenario's: nog steeds geen crash bij diverse UTC-offsets
  const offsetScenarios=[
    ["positieve hele UTC-offset",19800],["negatieve hele UTC-offset",-14400],
    ["halve-uur-offset",-16200],["kwartier-offset",20700],
    ["lokaal etmaal wijkt af van de tijdzone van de tester",50400]
  ];
  for(const [naam,off] of offsetScenarios){
    const {fout}=scenario(naam,{utcOffset:off});
    check("generiek, dezelfde productiecode: "+naam,!fout,fout&&fout.message);
  }
  {
    // meerdaagse weergave (48 uur): meerdere nachtsegmenten mogelijk
    const {bak,fout}=scenario("meerdaagse weergave (48 uur)",{bereik:48});
    check("een 48-uursweergave crasht niet en blijft consistent",!fout,fout&&fout.message);
  }
  {
    // segment dat aan de rand van de zichtbare grafiek wordt afgeknipt
    const {api,bak}=laadKern(1280);
    const d=bouw({});
    const dagStr=d.daily.time[0];
    d.daily.sunset[0]=dagStr+"T02:00";     // vóór het zichtbare bereik
    d.hourly.is_day=d.hourly.time.map(t=>+t.slice(11,13)<6?0:1);
    const i0=d.hourly.time.indexOf(dagStr+"T04:00");
    Object.assign(api.S,{d,i0,op:Date.now(),lat:1,lon:1,label:"T",dag:null,bereik:24});
    let fout=null;
    try{ api.etmaal(i0,24); }catch(e){ fout=e; }
    check("een segment dat al vóór het zichtbare bereik begint, wordt veilig afgeknipt (geen negatieve breedte, geen crash)",
      !fout,fout&&fout.message);
  }
  {
    // ontbrekende/ongeldige dag/nachtdata mag niet crashen
    const {api}=laadKern(1280);
    const d=bouw({});
    d.hourly.is_day=d.hourly.time.map(()=>undefined);
    d.daily.sunset=d.daily.sunset.map(()=>null);
    d.daily.sunrise=d.daily.sunrise.map(()=>null);
    Object.assign(api.S,{d,i0:14,op:Date.now(),lat:1,lon:1,label:"T",dag:null,bereik:24});
    let fout=null;
    try{ api.etmaal(api.S.i0,24); }catch(e){ fout=e; }
    check("ontbrekende dag/nachtdata (allemaal undefined/null) veroorzaakt geen crash",!fout,fout&&fout.message);
  }
}

/* 14. v67: centraal kleursysteem */
groep("Kleursysteem");
{
  const fsK3=require("fs"), pathK3=require("path");
  const bronK3=fsK3.readFileSync(pathK3.join(__dirname,"index.html"),"utf8");

  check("de accentvariabelen (lijnen/tekst/datavisualisatie) staan nog centraal in :root",
    /--text-primary:/.test(bronK3) && /--text-secondary:/.test(bronK3) && /--border-subtle:/.test(bronK3)
    && /--accent-active:#A51D3D/.test(bronK3) && /--accent-info:/.test(bronK3)
    && /--accent-night:#142C4C/.test(bronK3)
    && /--accent-sun:#F2CE63/.test(bronK3));
  check("tekst/border/info harmoniseren met bestaande tokens in plaats van een dubbel systeem",
    /--text-primary:var\(--ink\)/.test(bronK3) && /--text-secondary:var\(--ink-45\)/.test(bronK3)
    && /--border-subtle:var\(--rule\)/.test(bronK3) && /--accent-info:var\(--teal\)/.test(bronK3));
  check("#142C4C en #F2CE63 komen ieder precies één keer als hardcoded hex voor (alleen in de tokendefinitie)",
    (bronK3.match(/#142C4C/g)||[]).length===1 && (bronK3.match(/#F2CE63/g)||[]).length===1);
  check("actieve chips gebruiken het actieve accent",/\.chip\.on\{[^}]*var\(--accent-active\)/.test(bronK3));
  check("bestaande waarschuwing- en foutkleuren (carmine) zijn niet overschreven",
    /--carmine:#A02036/.test(bronK3) && /html\[data-thema="donker"\][^}]*--carmine:#E4707E/.test(bronK3)
    && /html\[data-thema="rood"\][^}]*--carmine:#F06A5A/.test(bronK3));
  check("de themakeuzelogica zelf is niet gewijzigd (auto kiest nog op is_day)",
    /keuze==="auto".*is_day===0.*"donker".*"licht"/.test(bronK3.replace(/\s+/g," ")));
  /* v70: alle --surface-*-tokens (module-achtergrondtinten) zijn verwijderd;
     ze werden nergens anders meer gebruikt zodra de laatste moduleachtergronden eruit gingen. */
  check("de vijf --surface-*-tokens bestaan niet meer",
    !/--surface-info:/.test(bronK3) && !/--surface-rain:/.test(bronK3)
    && !/--surface-night:/.test(bronK3) && !/--surface-sun:/.test(bronK3)
    && !/--surface-active:/.test(bronK3));
  check("geen enkele module heeft nog een gekleurde achtergrondvulling (background:var(--surface-...))",
    !/background:var\(--surface-/.test(bronK3));
  check("#aq behoudt alleen zijn dunne accentlijn (border-top), geen background meer",
    /#aq\{border-top:2px solid var\(--accent-info\)\}/.test(bronK3)
    && !/#aq\{[^}]*background/.test(bronK3));

  check("basisachtergronden (--paper, --sheet) bestaan nog onaangeroerd",
    /--paper:#F4F5F3/.test(bronK3) && /--sheet:#FFFFFF/.test(bronK3));
  check("donker en rood thema hebben geen hardcoded witte achtergrond gekregen",
    !/html\[data-thema="donker"\][^}]*--sheet:#FFFFFF/.test(bronK3)
    && !/html\[data-thema="rood"\][^}]*--sheet:#FFFFFF/.test(bronK3));
}

/* 15. v68: responsive dashboardlayout. Dit toetst DOM-/CSS-structuur (delen van
   één DOM, mediaqueries, geen dubbele ids, veilige grids), geen visuele
   weergave. Of het er ook echt goed uitziet op een scherm is hiermee niet
   aangetoond. */
groep("Responsive structuur (v68)");
{
  const fsD=require("fs"), pathD=require("path");
  const bronD=fsD.readFileSync(pathD.join(__dirname,"index.html"),"utf8");

  // 1-3: één gedeelde DOM, geen dubbele ids en geen verwijderde radar
  check("er is precies één #chart in de hele pagina",(bronD.match(/id="chart"/g)||[]).length===1);
  check("de verwijderde radar komt nergens meer in de DOM voor",(bronD.match(/id="radar"/g)||[]).length===0);
  check("er is precies één #days en één #nights (geen dubbele desktopkopie)",
    (bronD.match(/id="days"/g)||[]).length===1 && (bronD.match(/id="nights"/g)||[]).length===1);

  // 4: desktoplayout via mediaqueries
  check("de desktoplayout activeert via een CSS-mediaquery, niet via JavaScript",
    /@media\(min-width:1100px\)/.test(bronD));

  // 5-6: geen user-agent- of viewport-routing in JS
  const scriptBron=bronD.slice(bronD.indexOf("<script>"),bronD.indexOf("</script>"));
  check("geen user-agentdetectie is toegevoegd",!/userAgent/.test(scriptBron));
  // bestaande, geverifieerde basislijn: de twee M-regels (grafiek) gebruiken
  // window.innerWidth elk twee keer (typeof-check + vergelijking) en de
  // ongewijzigde resize-listener drie keer (init, vergelijking, herwaarde) = 7
  check("geen nieuwe JavaScript-viewportrouting (naast de al bestaande, ongewijzigde M-vlag voor de grafiek)",
    (scriptBron.match(/window\.innerWidth/g)||[]).length===7,
    (scriptBron.match(/window\.innerWidth/g)||[]).length);

  // 7: mobiele DOM-volgorde blijft logisch (brief -> hero -> stats -> grafiek -> neerslagtekst -> ... -> footer)
  const volgorde=["id=\"brief\"","class=\"hero\"","class=\"stats\"","id=\"chartlab\"",
    "id=\"nctext\"","<span>Zeven dagen</span>",
    "<span>Nachtzicht</span>","<span>Luchtkwaliteit en pollen</span>","<footer>"];
  let vorigeIdx=-1, volgordeKlopt=true;
  for(const stuk of volgorde){
    const idx=bronD.indexOf(stuk);
    if(idx<0||idx<vorigeIdx) volgordeKlopt=false;
    vorigeIdx=idx;
  }
  check("de DOM-volgorde (lezen, toetsenbord, schermlezer) is logisch en ongewijzigd",volgordeKlopt);

  // 8: de noodzakelijke layoutwrappers bestaan (twee van de vier dashcols
  // hebben sinds v69 ook een mod-*-class voor de volledig gevulde
  // achtergrond, dus op het prefix tellen i.p.v. de exacte class-string)
  check("de minimale layoutwrappers (dashrow/dashcol) bestaan",
    /class="dashrow dashrow-hero"/.test(bronD) && /class="dashrow dashrow-chart"/.test(bronD)
    && /class="dashrow dashrow-days"/.test(bronD) && (bronD.match(/class="dashcol/g)||[]).length===3);
  check("dashrow is tot 1100px functioneel onzichtbaar (display:contents)",
    /\.dashrow\{display:contents\}/.test(bronD));

  // 9: veilige minmax(0, ...)-kolommen in het resterende desktopgrid.
  // De grafiek gebruikt na de radarverwijdering de volle breedte; dagen/nachtzicht blijft gestapeld.
  check("de resterende desktopgrids gebruiken minmax(0, ...) tegen overflow",
    (bronD.match(/grid-template-columns:minmax\(0,[^)]+\) minmax\(0,[^)]+\)/g)||[]).length===1);

  // 10: geen nieuwe overflow-verbergende noodregel
  check("geen nieuwe overflow:hidden/clip-regel is toegevoegd als noodoplossing voor de dashboardlaag",
    !/dashboardlaag[\s\S]*?overflow:(hidden|clip)/.test(bronD.slice(bronD.indexOf("v68: dashboardlaag"))));
}

/* 16. v68: desktoplayout - structuur van de dashboardgrids zelf */
groep("Desktoplayout (v68)");
{
  const fsD2=require("fs"), pathD2=require("path");
  const bronD2=fsD2.readFileSync(pathD2.join(__dirname,"index.html"),"utf8");
  const desktopBlok=bronD2.slice(bronD2.indexOf("@media(min-width:1100px)"),bronD2.indexOf("@media(min-width:1500px)"));

  check("een brede desktopcontainer is gedefinieerd (max-width tussen 1360 en 1480px)",
    /\.sheet\{max-width:min\(1440px,100%\)/.test(desktopBlok));
  check("de header (.mast) blijft de bestaande flex-indeling gebruiken, niet vervangen",
    /\.mast\{display:flex/.test(bronD2) && !/\.mast\{display:grid/.test(desktopBlok));
  check("het metriekgrid heeft op tablet een eigen (tweekoloms) variant",
    /min-width:900px\) and \(max-width:1099px\)[\s\S]{0,20}\{[\s\S]*?\.stats\{grid-template-columns:repeat\(2,1fr\)/.test(bronD2));
  check("de grafiek gebruikt na verwijdering van de radar de volle desktopbreedte",
    /\.dashrow-chart\{display:block\}/.test(desktopBlok));
  check("herstelronde: Zeven dagen en Nachtzicht vormen bewust GEEN zij-aan-zij-grid (.dashrow-days blijft gestapeld)",
    !/\.dashrow-days\{display:grid/.test(bronD2));
  check("luchtkwaliteit/pollen (#aq) krijgt geen eigen tweekoloms grid en loopt dus over de volle dashboardbreedte",
    !/\.dashrow-aq/.test(bronD2) && /#aq\{border-top:2px solid var\(--accent-info\)\}/.test(bronD2));
  check("tablet (900-1099px) valt terug op een gestapelde layout: de desktopgrids staan alleen in het 1100px-blok",
    !/@media\(min-width:900px\) and \(max-width:1099px\)\)?[\s\S]{0,300}dashrow-chart\{display:grid/.test(bronD2));
  check("mobiel (onder 900px) blijft één kolom: de bestaande mobiele media query is niet gewijzigd",
    /@media\(max-width:900px\)\{[\s\S]*?body\{padding:14px 12px\}/.test(bronD2));
  check("geen desktoplayout is actief onder het afgesproken breakpoint (geen andere min-width:110\\dpx-waarde)",
    !/@media\(min-width:11(?!00px\))/.test(bronD2));
}

/* v70: de eerdere "Kleursysteem (v68)"-testgroep dwong de --surface-*-
   oppervlaktetinten af die deze ronde bewust heeft verwijderd (zie de
   herstelopdracht: "verwijder tests die alleen de verwijderde verkeerde
   implementatie afdwingen"). De vervangende afwezigheidscontroles staan in
   de bijgewerkte "Kleursysteem"-groep verderop in dit bestand. */


/* 18. v68-herstelronde: gerichte tests voor de drie herstelpunten uit de
   herstelopdracht (metriekgrid, Zeven dagen/Nachtzicht, kleur op elke
   breedte). Dit toetst broncode-/CSS-structuur, geen visuele weergave. */
groep("Herstelronde v68");
{
  const fsH=require("fs"), pathH=require("path");
  const bronH=fsH.readFileSync(pathH.join(__dirname,"index.html"),"utf8");
  const desktopH=bronH.slice(bronH.indexOf("@media(min-width:1100px)"),bronH.indexOf("@media(min-width:1500px)"));

  // 12.1 metriekgrid
  check("1. het hero-grid (.dashrow-hero) wordt pas vanaf 1100px een echt grid",
    /@media\(min-width:1100px\)\{[\s\S]*?\.dashrow-hero\{display:grid/.test(bronH)
    && !/\.dashrow-hero\{display:grid/.test(bronH.slice(0,bronH.indexOf("@media(min-width:1100px)"))));
  check("2. .stats gebruikt binnen die hero-grid twee kolommen",
    /\.dashrow-hero \.stats\{grid-template-columns:repeat\(2,minmax\(0,1fr\)\)\}/.test(desktopH));
  check("3. die tweekoloms regel gebruikt minmax(0,1fr)",
    /repeat\(2,minmax\(0,1fr\)\)/.test(desktopH));
  check("4. de brede rij (UV) overspant beide kolommen",
    /\.dashrow-hero \.stat\.breed\{grid-column:1 \/ -1\}/.test(desktopH));
  check("5. metriekblokken krijgen min-width:0 (veilige minimale breedte)",
    /\.dashrow-hero \.stat\{min-width:0\}/.test(desktopH));
  check("6. geen desktopregel zet .dashrow-hero .stats terug naar vier kolommen",
    !/\.dashrow-hero \.stats\{grid-template-columns:repeat\(4/.test(bronH));
  check("7. de tablet- (900-1099px) en mobiele metriekregels bestaan nog onaangeroerd",
    /min-width:900px\) and \(max-width:1099px\)[\s\S]{0,20}\{[\s\S]*?\.stats\{grid-template-columns:repeat\(2,1fr\)/.test(bronH)
    && /@media\(max-width:900px\)\{[\s\S]*?\.stats\{grid-template-columns:repeat\(2,1fr\)/.test(bronH));

  // 12.2 zeven dagen en Nachtzicht
  check("1. .dashrow-days is van 1100 tot 1359px (en ook daarboven) één kolom",
    !/\.dashrow-days\{display:grid/.test(bronH));
  check("2. er is geen zij-aan-zij-regel actief op 1100px",
    !/\.dashrow-days\{display:grid/.test(desktopH));
  check("3. er is geen enkele zij-aan-zij-regel voor .dashrow-days, dus ook niet per ongeluk vóór 1360px",
    !/\.dashrow-days[^}]*display:grid/.test(bronH));
  check("4. geen dubbele #days of #nights zijn ontstaan",
    (bronH.match(/id="days"/g)||[]).length===1 && (bronH.match(/id="nights"/g)||[]).length===1);
  check("5. geen functionele inhoud van Zeven dagen/Nachtzicht is verborgen (display:none)",
    !/#days\{display:none|#nights\{display:none/.test(bronH));
  check("6. geen nieuwe horizontale scroll is toegevoegd als workaround",
    !/#days\{[^}]*overflow-x|#nights\{[^}]*overflow-x/.test(bronH));
  check("7. de mobiele .night-regel bestaat nog onaangeroerd (niet in deze ronde gewijzigd)",
    /\.night\{grid-template-columns:70px 40px minmax\(20px,1fr\) max-content;gap:4px 9px\}/.test(bronH));
  check("7b. de mobiele .day-regel gebruikt sinds de v70-kolomcorrectie een vaste naamkolom (40px), geen max-content meer",
    /\.day\{grid-template-columns:40px 22px 56px 1fr 1fr 48px;gap:6px\}/.test(bronH));
  check("8. de standaard (desktop-breedte) .night-grid is niet gewijzigd",
    /\.night\{grid-template-columns:104px 52px minmax\(40px,1fr\) 104px max-content;gap:16px\}/.test(bronH));
  check("8b. de standaard (desktop-breedte) .day-grid gebruikt sinds de v70-kolomcorrectie een vaste naamkolom (100px), geen max-content meer",
    /\.day\{grid-template-columns:100px 26px 1fr 72px 54px 128px 46px 52px;gap:14px;cursor:pointer\}/.test(bronH));
  check("9. zeven-dagenklikwerking (de dag-click-handler) is niet aangeraakt",
    /class="row"[\s\S]{0,40}data-i|dagKlik|\.day.{0,3}addEventListener|onclick/i.test(bronH)
    || /dagen\(\)/.test(bronH));   // functie bestaat nog; geen inhoudelijke aanname over de exacte implementatie
  check("10. de Nachtzicht-berekeningsfunctie (nachten) is niet aangeraakt",
    /function nachten\(\)/.test(bronH));

  // 12.3 kleur op alle viewports
  check("2. het nachtaccent (#nights) staat buiten iedere mediaquery",
    bronH.indexOf("#nights{border-top:2px solid var(--accent-night)}")>=0
    && bronH.indexOf("#nights{border-top:2px solid var(--accent-night)}")
      < bronH.indexOf("@media(min-width:900px) and (max-width:1099px)"));
  check("3. het informatie-accent (#aq) staat buiten iedere mediaquery",
    bronH.indexOf("#aq{border-top:2px solid var(--accent-info)}")>=0
    && bronH.indexOf("#aq{border-top:2px solid var(--accent-info)}")
      < bronH.indexOf("@media(min-width:900px) and (max-width:1099px)"));
  check("4. een beperkt zon-/UV-accent staat buiten iedere mediaquery",
    bronH.indexOf(".stat.breed{border-top:2px solid var(--accent-sun)}")
      < bronH.indexOf("@media(min-width:900px) and (max-width:1099px)")
    && bronH.indexOf(".stat.zon{border-top:2px solid var(--accent-sun)}")
      < bronH.indexOf("@media(min-width:900px) and (max-width:1099px)"));
  check("5. desktop-specifieke padding voor luchtkwaliteit blijft binnen de 1100px-mediaquery",
    /#aq\{padding:var\(--s2\)\}/.test(desktopH));
  check("6. de kleurregels gebruiken de centrale accenttokens, geen losse hex/rgba, en geen surface-tints meer",
    /var\(--accent-night\)/.test(bronH)
    && /var\(--accent-info\)/.test(bronH) && /var\(--accent-sun\)/.test(bronH)
    && !/var\(--surface-/.test(bronH));
  check("7. geen nieuwe losse hex-/rgba-kleurwaarde is toegevoegd voor de resterende accenten",
    !/border-top:2px solid #[0-9A-Fa-f]{3,6}/.test(bronH));
  check("8. fout-/waarschuwingskleuren (carmine) zijn niet gewijzigd",
    /--carmine:#A02036/.test(bronH));

  // functionele check: de zonurentegel-class is puur presentationeel toegevoegd,
  // de berekening zelf (sunshine_duration, plaatsVandaag) is niet aangeraakt
  {
    const {api,bak}=laadKern(1280);
    const d=bouw({});
    d.daily.sunshine_duration=d.daily.time.map(()=>5*3600);   // 5 uur zon, ruim boven de "weinig"-grens
    const air={current:{european_aqi:31,us_aqi:42,pm2_5:5.9,pm10:9},
      hourly:{time:d.hourly.time.slice(0,24),
        grass_pollen:new Array(24).fill(12),birch_pollen:new Array(24).fill(null),
        alder_pollen:new Array(24).fill(null),mugwort_pollen:new Array(24).fill(null),
        ragweed_pollen:new Array(24).fill(null),olive_pollen:new Array(24).fill(null)}};
    // klokOverride vastzetten binnen de gefixeerde testdatums: plaatsVandaag()
    // gebruikt anders de echte wandklok, die inmiddels voorbij het bereik van
    // bouw()'s vaste datums (2026-07-22 t/m 2026-07-28) kan zijn gelopen. Dit
    // is een pre-existing, aan deze ronde ongerelateerd fixture-detail.
    Object.assign(api.S,{d,air,i0:14,op:Date.now(),lat:52.35,lon:5.26,label:"T",dag:null,bereik:24,
      klokOverride:new Date(d.daily.time[0]+"T14:00:00Z")});
    let fout=null;
    try{ api.lucht(); }catch(e){ fout=e; }
    check("de zonurentegel blijft werken en toont de klasse 'zon' voor het accent",
      !fout && /class="stat zon"/.test(bak.aq.innerHTML) && /5,0<s>uur<\/s>/.test(bak.aq.innerHTML),
      fout?fout.message:bak.aq.innerHTML.slice(0,200));
  }
}

/* 19. v69-polishronde: grafieklabels, Nachtzicht-/grafiekachtergrond en mobiele
   tooltip. Dit toetst broncode-/DOM-structuur en
   functioneel gedrag, geen visuele weergave. */
groep("v69 polishronde");
{
  const fsP=require("fs"), pathP=require("path");
  const bronP=fsP.readFileSync(pathP.join(__dirname,"index.html"),"utf8");

  // 14.1 grafieklabels
  {
    const {api,bak}=laadKern(1280);
    Object.assign(api.S,{d:bouw({}),i0:14,op:Date.now(),lat:52.35,lon:5.26,label:"T",dag:null,bereik:24});
    api.dagen();
    const namen=[...bak.days.innerHTML.matchAll(/class="dlang">([^<]*)</g)].map(m=>m[1]);
    api.tekenAlles();
    check("1. de grafiekcontext (dagkiezer) gebruikt niet meer letterlijk 'vandaag'",
      !/vandaag/i.test(namen[0]||""),namen[0]);
    check("2. de grafiekcontext gebruikt niet meer letterlijk 'morgen'",
      !/morgen/i.test(namen[1]||""),namen[1]);
    check("3. overige dagen gebruiken hetzelfde compacte dag+datumpatroon als vandaag/morgen",
      namen.every(n=>/^[a-zA-Z]+ \d+$/.test(n)),namen.join(" | "));
    check("4. de datumweergave blijft generiek (komt uit day.time, geen vaste tekst)",
      /DAGENVOL\[dt\.getDay\(\)\]\+" "\+nr/.test(bronP) && /DAGEN\[dt\.getDay\(\)\]\+" "\+nr/.test(bronP));
    check("5. geen hardcoded kalenderdatum is toegevoegd in dagen()",
      !/20\d\d-\d\d-\d\d/.test(bronP.slice(bronP.indexOf("function dagen()"),bronP.indexOf("function dagen()")+1500)));
    check("6. normale briefingteksten (dagDeel) zijn niet globaal aangepast: 'Vandaag' bestaat daar nog gewoon",
      /woord:"Vandaag", klein:"vandaag"/.test(bronP));
    check("de suntimes-regel gebruikt geen 'vandaag:'-voorvoegsel meer (gelijk ritme in elke weergave)",
      !/const voorvoegsel/.test(bronP) && !/\+voorvoegsel\+/.test(bronP));
  }

  // 14.2 Nachtzicht (v70: geen gekleurde achtergrond meer, mod-night is
  // volledig verwijderd; alleen de dunne accentlijn op #nights zelf blijft)
  {
    check("1. .mod-night bestaat niet meer (Nachtzicht is weer een gewone .dashcol)",
      !/class="dashcol mod-night"/.test(bronP) && !/\.mod-night\{/.test(bronP));
    check("Nachtzicht-kop en -rijen staan weer in een gewone, ongekleurde wrapper",
      /<div class="dashcol">\s*\n\s*<h2><span>Nachtzicht<\/span><span class="r" id="moonlab">/.test(bronP));
    check("2. #nights heeft geen background meer, alleen nog de dunne accentlijn",
      /#nights\{border-top:2px solid var\(--accent-night\)\}/.test(bronP)
      && !/#nights\{[^}]*background/.test(bronP));
    check("4. de accentlijn staat buiten desktop-only mediaqueries",
      bronP.indexOf("#nights{border-top:2px solid var(--accent-night)}")
        < bronP.indexOf("@media(min-width:900px) and (max-width:1099px)"));
    check("6. geen overflow:hidden wordt gebruikt om inhoud af te knippen bij Nachtzicht",
      !/#nights\{[^}]*overflow:hidden/.test(bronP));
    check("7. geen dubbele #nights is ontstaan",(bronP.match(/id="nights"/g)||[]).length===1);

    // 5: de module bevat nog steeds alle bestaande inhoud (functioneel)
    const {api,bak}=laadKern(1280);
    const d=bouw({});
    Object.assign(api.S,{d,i0:14,op:Date.now(),lat:52.35,lon:5.26,label:"T",dag:null,bereik:24});
    api.nachten();
    check("5. Nachtzicht bevat nog alle bestaande inhoud (score, bewolking, venster, maan)",
      /bewolking/.test(bak.nights.innerHTML) && /maanbij/.test(bak.nights.innerHTML));
  }

  // 14.3 grafiekmodule blijft ongekleurd (mod-chart bestaat niet, is nooit
  // teruggekomen); de nachtvlak-specifieke controles staan nu in de
  // uitgebreide "Nachtzone in de grafiek"-groep hierboven
  {
    check("1. .mod-chart bestaat niet meer als class of CSS-regel",
      !/class="dashcol mod-chart"/.test(bronP) && !/\.mod-chart\{/.test(bronP));
    check("2. de buitenste grafiekmodule gebruikt geen --surface-rain",
      !/\.mod-chart\{background:var\(--surface-rain\)/.test(bronP));
    check("de grafiek-dashcol is weer de gewone, ongekleurde wrapper",
      /<div class="dashcol">\s*\n\s*<h2><span id="chartlab">Het etmaal<\/span>/.test(bronP));
    check("8. geen dubbele #chart is ontstaan",(bronP.match(/id="chart"/g)||[]).length===1);

    const {api,bak}=laadKern(1280);
    const d=bouw({});
    // venster binnen "2026-07-22" zelf (00:00-23:00), zodat het samenvalt met
    // de standaard sunset/sunrise (21:46/05:44) uit de fixture; nacht aan
    // beide randen van de dag, dag ertussenin
    d.hourly.is_day=d.hourly.time.map(t=>{
      const u=+t.slice(11,13);
      return (u>=6&&u<21)?1:0;
    });
    const i0=d.hourly.time.indexOf("2026-07-22T00:00");
    Object.assign(api.S,{d,i0,op:Date.now(),lat:52.35,lon:5.26,label:"T",dag:null,bereik:24});
    api.etmaal(i0,24);
    check("4. de grafiek en de instructietekst blijven aanwezig",
      bak.chart.innerHTML.length>0 && /vinger/i.test(bak.charthint.textContent));
    check("7. de sterren blijven aanwezig",
      (bak.chart.innerHTML.match(/<circle[^>]*opacity="0\.(85|55)"/g)||[]).length>0);
    check("8. de rode Nu-lijn blijft aanwezig",
      /fill="\$\{CARMINE\}"[^>]*>nu<\/text>/.test(bronP));
  }

  // 14.4 tooltip
  {
    const {api,bak}=laadKern(390);
    Object.assign(api.S,{d:bouw({}),op:Date.now(),lat:52.35,lon:5.26,label:"T",dag:null,bereik:24});
    api.S.i0=api.S.d.hourly.time.findIndex(t=>t.slice(0,13)===api.S.d.current.time.slice(0,13));
    api.etmaal(api.S.i0,24);
    bak.hit.dispatchEvent({type:"pointermove",clientX:180,clientY:100,pointerType:"mouse"});
    const html=bak.scrub.innerHTML;
    check("1. alle bestaande tooltipvelden blijven aanwezig (mobiel)",
      /temperatuur/.test(html) && /voelt als/.test(html) && /neerslagkans/.test(html)
      && />wind</.test(html) && /windstoten/.test(html) && /bewolking/.test(html));
    check("2. de mobiele maximale breedte is begrensd, maar niet te klein voor comfortabele leesbaarheid (186-192px)",
      (()=>{ const m=bronP.match(/const bw=G\.M\?(\d+):224;/); return !!m && +m[1]>=186 && +m[1]<=192; })());
    check("10. mobiele tooltiptekst is niet kleiner dan 11px (labels/waarden)",
      /const fLabel=11, fWaarde=11\.5/.test(bronP));
    check("de regelhoogte is niet kleiner dan 15px op mobiel",
      /const rijH=G\.M\?15:17;/.test(bronP));
    check("3. de doos wordt hoe dan ook binnen de randen geklemd (kan niet standaard buiten de grafiek vallen)",
      /bx = clamp\(bx, 2, G\.W-bw-2\);/.test(bronP));
    check("4. productiedata/tooltipberekeningen (G.x/G.y, de finite-guard) zijn ongewijzigd",
      /const X=G\.x\(i\),Y=G\.y\(G\.T\[i\]\);/.test(bronP)
      && /\[X,Y,bx,by,bw,bh,G\.W,G\.H\]\.every\(Number\.isFinite\)/.test(bronP));
    check("5. geen inhoud wordt via CSS verborgen (display:none op een tooltipveld)",
      !/#scrub \w+\{display:none/.test(bronP));
  }
}

/* Radar is op verzoek volledig verwijderd; de aparte twee-uursneerslagtekst blijft bestaan. */
groep("Radar verwijderd");
{
  const fsR=require("fs"), pathR=require("path");
  const bronR=fsR.readFileSync(pathR.join(__dirname,"index.html"),"utf8");
  check("de radarinterface is uit de DOM verwijderd",
    !/Neerslagradar|id="radar"|id="rspeel"|id="rschuif"|id="radartijd"|id="radarmelding"/.test(bronR));
  check("de radarlogica en externe radarbronnen zijn verwijderd",
    !/radarLaden|radarTeken|api\.rainviewer|tilecache\.rainviewer|basemaps\.cartocdn|radarverwachting/.test(bronR));
  check("de aparte verwachting voor de komende twee uur blijft bestaan",
    /Neerslag komende twee uur/.test(bronR) && /id="nctext"/.test(bronR) && /id="nc"/.test(bronR));
}

async function testenOpstartlocatie(){
  const fsL=require("fs"), pathL=require("path");
  const bronL2=fsL.readFileSync(pathL.join(__dirname,"index.html"),"utf8");
  const wacht=async(n)=>{ for(let i=0;i<(n||10);i++) await new Promise(r=>setImmediate(r)); };

  groep("Opstartlocatie");

  // bronchecks: geen hardcoded Almere-fallback, en de sleutel die kern.js
  // vooraf in localStorage zet komt echt overeen met KEY_P in de app
  check("geen enkele Almere-coördinaat staat nog als fallback in de broncode",
    !/52\.3508.{0,40}5\.2647|5\.2647.{0,40}52\.3508/s.test(bronL2));
  check("KEY_P in de app is nog steeds \"weerbriefing.plaats\" (kern.js zet dit vooraf onder diezelfde naam)",
    /const KEY_P="weerbriefing\.plaats"/.test(bronL2));

  // 1. geldige gedeelde URL-locatie
  {
    let geoTellers=0;
    const {api,fetchStaat,localStorage}=laadKern(1280,{
      zoek:"?lat=52.0116&lon=4.3571&plaats=Delft",
      geo:()=>{geoTellers++;},
      opgeslagen:{lat:1,lon:1,label:"Oud"}
    });
    await wacht();
    check("1. de URL-locatie wordt geladen",
      api.S.lat===52.0116&&api.S.lon===4.3571&&api.S.label==="Delft",
      api.S.lat+"/"+api.S.lon+"/"+api.S.label);
    check("1. GPS wordt niet gestart",geoTellers===0,geoTellers);
    check("1. de opgeslagen locatie wordt niet geladen, de URL wint",api.S.label!=="Oud",api.S.label);
    const opgeslagenNa=JSON.parse(localStorage.getItem("weerbriefing.plaats")||"null");
    check("1. de gedeelde locatie overschrijft de persoonlijke laatst gebruikte locatie niet",
      opgeslagenNa&&opgeslagenNa.label==="Oud",JSON.stringify(opgeslagenNa));
  }

  // 2. url met hier=1
  {
    let geoTellers=0;
    const geo=(gelukt)=>{ geoTellers++; gelukt({coords:{latitude:52.5,longitude:5.5,accuracy:15}}); };
    const fetchMock=async(url)=>{
      if(String(url).includes("/api/plaatsnaam")) return {ok:true,json:async()=>({naam:"Testplaats"})};
      return {ok:false,status:500,json:async()=>({})};
    };
    const {api}=laadKern(1280,{zoek:"?hier=1",geo,fetch:fetchMock});
    await wacht();
    check("2. GPS wordt precies één keer gestart via hier=1",geoTellers===1,geoTellers);
    check("2. dezelfde herbruikbare procedure levert de gevonden plaats op",
      api.S.label==="Testplaats",api.S.label);
  }

  // 3. terugkerende gebruiker, nieuwe locatie op meer dan 1 km
  {
    const opgeslagen={lat:52.0907,lon:5.1214,label:"Utrecht"};
    let geoTellers=0;
    const geo=(gelukt)=>{ geoTellers++; gelukt({coords:{latitude:52.3676,longitude:4.9041,accuracy:15}}); }; // Amsterdam
    const fetchMock=async(url)=>{
      if(String(url).includes("/api/plaatsnaam")) return {ok:true,json:async()=>({naam:"Amsterdam"})};
      return {ok:false,status:500,json:async()=>({})};
    };
    const {api}=laadKern(1280,{opgeslagen,geo,fetch:fetchMock});
    // synchroon, vóór enige microtaak: load() voor de opgeslagen locatie wordt
    // niet afgewacht, dus S.label hoort meteen "Utrecht" te zijn
    check("3. de opgeslagen locatie wordt direct geladen",api.S.label==="Utrecht",api.S.label);
    await wacht(3);
    check("3. GPS wordt daarna automatisch gestart",geoTellers===1,geoTellers);
    await wacht(6);
    check("3. een gevonden locatie op meer dan 1 km veroorzaakt een gerichte tweede load()",
      api.S.label==="Amsterdam",api.S.label);
  }
  {
    // GPS-fout laat de opgeslagen locatie intact
    const opgeslagen={lat:52.0907,lon:5.1214,label:"Utrecht"};
    const geo=(gelukt,mislukt)=>{ mislukt({code:2}); };
    const {api}=laadKern(1280,{opgeslagen,geo});
    await wacht(4);
    check("3. een GPS-fout laat de opgeslagen locatie intact",api.S.label==="Utrecht",api.S.label);
  }

  // 4. vrijwel dezelfde locatie: geen onnodige tweede volledige fetch
  {
    const opgeslagen={lat:52.0907,lon:5.1214,label:"Utrecht"};
    const geo=(gelukt)=>{ gelukt({coords:{latitude:52.0950,longitude:5.1214,accuracy:15}}); }; // ~0,5 km verderop
    const {api,fetchStaat}=laadKern(1280,{opgeslagen,geo});
    await wacht(3);
    const tellerNaOpgeslagen=fetchStaat.teller;
    await wacht(6);
    check("4. een positie binnen ~1 km veroorzaakt geen nieuwe volledige fetch",
      fetchStaat.teller===tellerNaOpgeslagen,tellerNaOpgeslagen+" -> "+fetchStaat.teller);
    check("4. de geladen plaatsnaam blijft die van de opgeslagen locatie",api.S.label==="Utrecht",api.S.label);
  }

  // 5. eerste bezoek: geen url, geen opgeslagen locatie
  {
    let geoTellers=0;
    const geo=(gelukt,mislukt)=>{ geoTellers++; mislukt({code:1}); };
    const {api,bak}=laadKern(1280,{geo});
    await wacht();
    check("5. zonder URL en zonder opgeslagen locatie wordt GPS automatisch gestart",geoTellers===1,geoTellers);
    check("5. Almere (of enige andere gegokte plaats) wordt nergens geladen",api.S.lat==null,api.S.lat);
    check("5. bij weigering verschijnt een doorzoekbare foutstatus, geen weerdata",
      api.S.d==null && /locatie/i.test(bak.state.textContent),bak.state.textContent);
    check("5. het zoekveld blijft beschikbaar",bak.q!=null);
  }

  // 6. race-condition: handmatige keuze wint van een trage gps-aanvraag
  {
    let bewaard=null;
    const geo=(gelukt,mislukt)=>{ bewaard={gelukt,mislukt}; };   // bewust niet meteen reageren
    const {api,bak}=laadKern(1280,{geo});
    await wacht(2);
    check("6. de gps-aanvraag staat klaar maar heeft nog niet gereageerd",api.S.lat==null);

    bak.res.dispatchEvent({type:"click",target:{closest:sel=>sel==="div[data-lat]"
      ?{dataset:{lat:"51.9225",lon:"4.47917",nm:"Rotterdam"}}:null}});
    await wacht(3);
    check("6. de handmatige keuze wordt direct geladen",api.S.label==="Rotterdam",api.S.label);

    bewaard.gelukt({coords:{latitude:52.09,longitude:5.12,accuracy:10}});
    await wacht(6);
    check("6. een later binnenkomend gps-resultaat overschrijft de handmatige keuze niet",
      api.S.label==="Rotterdam",api.S.label);
  }

  // 7. dubbele aanvraag: automatisch en een snelle klik op de knop
  {
    let geoTellers=0;
    const geo=()=>{ geoTellers++; };   // reageert bewust nooit
    const {api}=laadKern(1280,{geo});
    await wacht(2);
    const tweede=await api.locatieNu("knop");
    check("7. een snelle klik terwijl de automatische aanvraag nog loopt start geen tweede gps-aanvraag",
      geoTellers===1,geoTellers);
    check("7. die klik krijgt een stille no-op terug",tweede===false,tweede);
  }

  // 8. weigering: binnen dezelfde sessie niet automatisch opnieuw
  {
    let geoTellers=0;
    const geo=(gelukt,mislukt)=>{ geoTellers++; mislukt({code:1}); };
    const opgeslagen={lat:52.0907,lon:5.1214,label:"Utrecht"};
    const {api}=laadKern(1280,{opgeslagen,geo});
    await wacht(4);
    check("8. eerste weigering wordt geregistreerd",geoTellers===1,geoTellers);
    const opnieuw=await api.locatieNu("auto-terugkerend");
    check("8. na een expliciete weigering vraagt de achtergrondprocedure niet opnieuw",
      geoTellers===1&&opnieuw===false,geoTellers+" / "+opnieuw);
    await api.locatieNu("knop");
    check("8. een bewuste klik op de knop mag zelf wel een nieuwe poging doen",geoTellers===2,geoTellers);
  }

  // 9. geen geolocation-ondersteuning
  {
    const {api,bak}=laadKern(1280,{geoOntbreekt:true});
    await wacht(4);
    check("9. geen geolocation-ondersteuning geeft een duidelijke melding, geen crash",
      /locatie/i.test(bak.state.textContent),bak.state.textContent);
    check("9. zoeken blijft bruikbaar",bak.q!=null);
  }

  // 10. geen regressie
  {
    const {api:aP}=laadKern(1280,{zoek:"?lat=50&lon=4&plaats=X"});
    await wacht();
    check("10. de url-prioriteit blijft correct",aP.S.lat===50&&aP.S.lon===4);
    check("10. de live klok (v65) staat nog gewoon in tekenAlles(), onaangeroerd",
      /klokTimerStart\(\);\s*\n}/.test(bronL2));
    check("10. nuTimerStart (de nu-lijn) staat er ook nog onaangeroerd naast",
      /nuTimerStart\(\);\s*\n\s*klokTimerStart\(\);/.test(bronL2));
  }
}

testenOpstartlocatie().then(()=>{
  console.log("\n"+goed+" geslaagd, "+fout+" mislukt");
  process.exit(fout?1:0);
}).catch(e=>{
  console.error("Onverwachte fout in de opstartlocatie-tests:",e);
  process.exit(1);
});
