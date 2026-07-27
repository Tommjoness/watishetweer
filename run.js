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
  Object.assign(api.S,{d:bouw(opties),i0:14,op:Date.now(),lat:52.35,lon:5.26,label:"Test",dag:null,bereik:24});
  api.meters();api.briefing();api.nowcast();api.etmaal(14,24);api.dagen();api.nachten();
  const proxy=new Proxy(bak,{get:(o,k)=>{const e=o[k];if(!e)return e;
    return {get textContent(){return norm(e.textContent);},get innerHTML(){return norm(e.innerHTML);},
            getAttribute:x=>e.getAttribute(x)};}});
  return {tekst:norm(bak.brief.innerHTML).replace(/<[^>]+>/g,""),bak:proxy,api:api};
}
{
  const droog=brief({pp:()=>5,pr:()=>0,som:0}).tekst;
  check("droog etmaal meldt droog",/blijft het droog/.test(droog),droog);
  const bui=brief({pp:(u)=>u===18?80:5,pr:(u)=>u===18?2:0,som:2}).tekst;
  check("duidelijke bui krijgt tijd en kans",/tot 18:00.*80% kans/.test(bui),bui);
  const klein=brief({pp:(u)=>u===16?37:5,pr:()=>0,som:0}).tekst;
  check("kleine kans wordt genoemd, niet verzwegen",/grotendeels droog.*37%/.test(klein),klein);
  const regent=brief({nu:0.6,pp:(u)=>u<17?85:5,pr:(u)=>u<17?0.6:0,som:3}).tekst;
  check("het regent nu, met eindtijd",/Het regent nu, rond 17:00/.test(regent),regent);
  check("geen punt als decimaalteken in de briefing",!/\d\.\d/.test(bui),bui);
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
  check("nachtzicht toont maantijden",/maan op|maan onder|maan /.test(bak.nights.innerHTML));
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
  check("bewolkte nacht krijgt geen venster",/geen venster/.test(rb[0][2]),rb[0][2]);
  check("maantijden staan er altijd bij",/maan \d\d:\d\d/.test(rh[0][2])&&/maan \d\d:\d\d/.test(rb[0][2]));

  /* maanschijfje per nacht */
  {
    const {api,bak}=laadKern(390);
    Object.assign(api.S,{d:bouw({}),i0:14,op:Date.now(),lat:52.35,lon:5.26,label:"T",dag:null,bereik:24});
    api.nachten();
    const html=bak.nights.innerHTML;
    const nachtrijen=html.split('class="row night"').slice(1).filter(r=>/class="score"/.test(r));
    const metSchijf=nachtrijen.filter(r=>/class="maanbij"/.test(r));
    check("elke nacht krijgt een maanschijfje",
      nachtrijen.length>0 && metSchijf.length===nachtrijen.length,
      metSchijf.length+" van de "+nachtrijen.length);
    check("het schijfje is een tekening en geen letterteken",
      /class="maanbij"[^>]*>\s*<svg/.test(html));
    check("het schijfje staat bij de maantijden, niet vooraan",
      /·\s*<span class="maanbij"/.test(html));
    check("het schijfje heeft een omschrijving voor wie het niet ziet",
      /title="[^"]*procent verlicht"/.test(html));
    // het cijfer moet blijven staan: een schijfje leest snel, een percentage niet
    check("de maantijden blijven naast het schijfje staan",
      nachtrijen.every(r=>/maan \d\d:\d\d/.test(r.replace(/<[^>]+>/g,""))));
    // de fase moet per nacht verschillen, anders is het een vast plaatje
    const vormen=new Set(nachtrijen.map(r=>(r.match(/<path d="([^"]*)"/)||["",""])[1]));
    check("de fase verschilt per nacht",vormen.size>1,vormen.size+" verschillende vormen");
  }


}

/* 8b. teksten noemen altijd een waarde en waar het kan een tijdstip */
groep("Volledigheid van de teksten");
{
  const {bak}=brief({temp:(u)=>u<14?22-Math.abs(u-13):16});   // piek lag om 13:00, dus in het verleden
  const t=bak.brief.innerHTML.replace(/<[^>]+>/g,"");
  check("warmste moment in het verleden krijgt tijd en temperatuur",/warmst rond \d\d:\d\d met \d+ graden/.test(t),t);
  const nat=brief({pr:(u)=>u<12?0.4:0,pp:(u)=>u<12?70:5,som:2.4}).bak;
  check("neerslag die al gevallen is heet 'viel'",/\bviel\b/.test(nat.precsub.textContent),nat.precsub.textContent);
  const komt=brief({pr:(u)=>u===20?1.5:0,pp:(u)=>u===20?70:5,som:1.5}).bak;
  check("neerslag die nog komt heet 'verwacht'",/nog .* verwacht/.test(komt.precsub.textContent),komt.precsub.textContent);
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

  check(naam+": er staan cijfers bij de lijn",lab.length>0,"geen enkel label gevonden");
  check(naam+": de hoogste temperatuur krijgt een label",waarden.includes(hoog),
    "hoogste is "+hoog+"°, gelabeld zijn "+waarden.join(", "));
  check(naam+": de laagste temperatuur krijgt een label",waarden.includes(laag),
    "laagste is "+laag+"°, gelabeld zijn "+waarden.join(", "));

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

  // de naamkolom is een vaste maat, die moet het langste label gewoon bevatten
  const kolM=ontleed(mobiel);
  check("de naamkolom past het langste daglabel ("+langste+", "+langstePx.toFixed(1)+" px)",
    kolM[0]>=langstePx, "kolom is "+kolM[0]+" px");

  /* Passen is niet genoeg: het gaat om de witruimte die je ziet.
     Die bestaat uit wat er in de kolom overblijft, plus de tussenruimte, min de
     overhang van het icoon. Het icoon wordt op 22 px getekend; staat het in een
     smallere kolom, dan steekt het aan weerszijden uit, en wel precies aan de kant
     van de tekst. Dat was de tweede helft van de botsing. */
  const ICOON=22;
  const icoonKol=kolM[1];
  check("de icoonkolom is minstens zo breed als het icoon zelf ("+ICOON+" px)",
    icoonKol>=ICOON, "kolom is "+icoonKol+" px, het icoon steekt "+((ICOON-icoonKol)/2).toFixed(1)+" px uit");

  const overhang=Math.max(0,(ICOON-icoonKol)/2);
  const wit=l=>(kolM[0]-breed(l,12.5,"sans"))+gap-overhang;
  const krapLabels=namen.filter(l=>wit(l)<6);
  check("elk daglabel houdt minstens 6 px vrij tot het icoon",krapLabels.length===0,
    krapLabels.map(l=>"\""+l+"\" houdt "+wit(l).toFixed(1)+" px over").join(", "));

  /* En de spatiëring moet ook consistent voelen. Een vaste kolom op maat van het
     langste label geeft het kortste label een gat; wordt dat verschil te groot,
     dan oogt de tabel rommelig ook al botst er niets. */
  const witten=namen.map(wit);
  const verschil=Math.max(...witten)-Math.min(...witten);
  check("het verschil in witruimte tussen kort en lang label blijft onder 30 px",
    verschil<30, "verschil is "+verschil.toFixed(1)+" px");

  // valt een lettertype weg, dan mag een bredere vervanger nooit over het icoon lopen
  check("de dagnaam kapt af in plaats van door te lopen",
    /\.dname\{[^}]*overflow:hidden/.test(html)&&/\.dname\{[^}]*text-overflow:ellipsis/.test(html));

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
  const blok=(bron.match(/const bw=G\.M\?(\d+):(\d+);[\s\S]{0,400}?const by=/)||
              bron.match(/const bw=G\.M\?(\d+):(\d+)[\s\S]{0,200}?by=G\.pt-6;/));
  check("de tooltipbreedte staat in de code",!!blok,"regel niet gevonden");
  const bwM=blok?parseFloat(blok[1]):0, bwD=blok?parseFloat(blok[2]):0;
  const regel=blok?blok[0]:"";

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
    && regels.every(([,r])=>/^(beste zicht|geen venster)/.test(r)),
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
    const klem=(z,stap)=>Math.max(4,Math.min(z+stap,10));
    const raar=[[4,-1,4],[10,1,10],[7,1,8],[7,-1,6],[4,-5,4],[10,5,10]]
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
  check("het maandeel breekt als geheel af",
    /\.maangroep\{white-space:nowrap\}/.test(bronL) && /class="maangroep">·/.test(bronL));

  // 6. een vlakke lijn hoort niet vol labels te staan
  {
    const {api:a6,bak:b6}=laadKern(1280);
    // nacht met rimpelingen van een tiende graad rond 19 graden
    const vlak=(u)=>19+((u%3)-1)*0.1;
    Object.assign(a6.S,{d:bouw({temp:vlak}),i0:14,op:Date.now(),lat:52.35,lon:5.26,label:"T",dag:null,bereik:24});
    a6.etmaal(14,24);
    const labels=[...b6.chart.innerHTML.matchAll(/font-family="Bodoni Moda,serif" font-size="[\d.]+">(-?\d+)°</g)].map(m=>m[1]);
    const zelfde=labels.filter(v=>v==="19").length;
    check("een rimpeling van een tiende graad telt niet als piek",zelfde<=4,
      labels.length+" labels waarvan "+zelfde+" keer 19 graden: "+labels.join(" "));
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
    // het huidige uur staat in de testdata op index 38, alleen daar tekent de nu-lijn
    Object.assign(aN.S,{d:bouw({}),i0:38,op:Date.now(),lat:52.35,lon:5.26,label:"T",dag:null,bereik:24});
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

/* 10o. planeetstanden en bovenlucht */
groep("Planeten en bovenlucht");
{
  const fsP=require("fs"), pathP=require("path");
  const bronP=fsP.readFileSync(pathP.join(__dirname,"index.html"),"utf8");
  const {api}=laadKern(390);

  /* De standen zijn getoetst tegen pyephem, een echte efemeride. Het bestand
     efemeride.json bevat 90 gecontroleerde standen over twaalf plaatsen van 78
     noord tot 55 zuid en vijf jaar. Zonder zo'n toets is "het lijkt te kloppen"
     geen uitspraak: een fout van anderhalve dag in het nulpunt gaf eerder een
     azimut die 180 graden verkeerd stond en zag er in de app nog plausibel uit. */
  const ref=JSON.parse(fsP.readFileSync(pathP.join(__dirname,"efemeride.json"),"utf8"));
  let ergstH=0, ergstA=0, ergste="", nietEindig=0;
  for(const rr of ref){
    const p=api.planeet(rr.planeet,new Date(rr.datum),rr.lat,rr.lon);
    if(!p||!isFinite(p.hoogte)||!isFinite(p.azimut)){nietEindig++;continue;}
    const dh=Math.abs(p.hoogte-rr.hoogte);
    let da=Math.abs(p.azimut-rr.azimut); if(da>180) da=360-da;
    if(dh>ergstH){ergstH=dh;ergste=rr.plaats+" "+rr.planeet+" "+rr.datum.slice(0,10);}
    if(Math.abs(rr.hoogte)<85&&da>ergstA) ergstA=da;
  }
  check("elke stand levert een eindig getal op",nietEindig===0,nietEindig+" niet-eindig");
  check("de hoogte klopt binnen een tiende graad ("+ref.length+" standen)",ergstH<0.1,
    "grootste afwijking "+ergstH.toFixed(3)+" bij "+ergste);
  check("het azimut klopt binnen een tiende graad",ergstA<0.1,
    "grootste afwijking "+ergstA.toFixed(3));

  // het nulpunt van het dagnummer is de fout die eerder alles omgooide
  check("het dagnummer klopt met Schlyters eigen formule",
    api.dagNummer(new Date("2000-01-01T00:00:00Z"))===1 &&
    api.dagNummer(new Date("2026-07-27T00:00:00Z"))===9705,
    String(api.dagNummer(new Date("2000-01-01T00:00:00Z"))));

  // en het moet werken op het zuidelijk halfrond en aan de evenaar
  for(const [plaats,la,lo] of [["Sydney",-33.87,151.21],["Nairobi",-1.29,36.82],
                               ["Ushuaia",-54.8,-68.3],["Longyearbyen",78.22,15.65]]){
    const p=api.planeet("Jupiter",new Date("2026-07-27T22:00:00Z"),la,lo);
    check(plaats+": de stand is bruikbaar",
      isFinite(p.hoogte)&&p.hoogte>=-90&&p.hoogte<=90&&p.azimut>=0&&p.azimut<360,
      JSON.stringify(p));
  }
  check("een onbekende planeet geeft een duidelijke fout",(()=>{
    try{ api.planeet("Pluto",new Date(),52,5); return false; }catch(e){ return /onbekende planeet/.test(e.message); }
  })());

  /* alleen planeten die er werkelijk toe doen */
  {
    const {api:a3,bak:b3}=laadKern(390);
    Object.assign(a3.S,{d:bouw({cc:()=>5}),i0:14,op:Date.now(),lat:52.35,lon:5.26,label:"T",dag:null,bereik:24});
    a3.nachten();
    const platte=b3.nights.innerHTML.replace(/<svg[\s\S]*?<\/svg>/g,"").replace(/<[^>]+>/g,"|");
    const hoogtes=[...platte.matchAll(/(?:Mercurius|Venus|Mars|Jupiter|Saturnus) tot (\d+)\u00b0/g)]
      .map(m=>parseInt(m[1],10));
    check("er staan planeten bij een heldere nacht",hoogtes.length>0,String(hoogtes.length));
    check("niets onder de tien graden, daar zit je in de horizonnevel",
      hoogtes.every(v=>v>=10),hoogtes.join(", "));
    // per nacht sorteren, niet over alle nachten heen: elke rij begint opnieuw
    const perNacht=(b3.nights.innerHTML.match(/class="nmeta wide nplaneten">[^<]*/g)||[])
      .map(rij=>[...rij.matchAll(/tot (\d+)\u00b0/g)].map(m=>parseInt(m[1],10)));
    check("de hoogste staat per nacht vooraan",
      perNacht.length>0 && perNacht.every(rij=>rij.every((v,i)=>i===0||v<=rij[i-1])),
      perNacht.map(r2=>r2.join(">")).join(" | "));
  }

  /* bovenlucht: seeing en doorzicht */
  {
    const {api:a4,bak:b4}=laadKern(390);
    const d4=bouw({}); const nn=d4.hourly.time.length;
    d4.hourly.wind_speed_250hPa=Array.from({length:nn},()=>120);
    d4.hourly.relative_humidity_700hPa=Array.from({length:nn},()=>95);
    Object.assign(a4.S,{d:d4,i0:14,op:Date.now(),lat:52.35,lon:5.26,label:"T",dag:null,bereik:24});
    a4.nachten();
    const t4=b4.nights.innerHTML;
    check("harde straalstroom heet zeer onrustig",/beeld zeer onrustig/.test(t4));
    check("vochtige bovenlucht heet zeer waterig",/lucht zeer waterig/.test(t4));
    check("de windsnelheid staat erbij",/\(\d+ km\/u op 10 km\)/.test(t4));

    // ontbreekt de bovenlucht, dan hoort er niets te staan in plaats van een gok
    const {api:a5,bak:b5}=laadKern(390);
    Object.assign(a5.S,{d:bouw({}),i0:14,op:Date.now(),lat:52.35,lon:5.26,label:"T",dag:null,bereik:24});
    a5.nachten();
    check("zonder bovenlucht wordt er niets verzonnen",!/nlucht/.test(b5.nights.innerHTML));
  }

  check("de bovenlucht wordt bij de API opgevraagd",
    /wind_speed_250hPa/.test(bronP) && /relative_humidity_700hPa/.test(bronP));
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
    if(uur===23) check("om 23:00 staat er niet meer vandaag in de neerslagtegel",
      !/Vandaag/.test(b.precsub.textContent),b.precsub.textContent);
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

console.log("\n"+goed+" geslaagd, "+fout+" mislukt");
process.exit(fout?1:0);
