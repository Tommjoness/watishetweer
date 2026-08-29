"use strict";

const fs=require("fs"),path=require("path"),os=require("os"),{spawnSync}=require("child_process"),{bouw}=require("./data.js");
const browser=process.env.CHROME_PATH||process.env.CHROMIUM_PATH||"google-chrome";
const bron=path.join(__dirname,"public","index.html");
if(!fs.existsSync(bron))throw new Error("public/index.html ontbreekt; voer eerst de postbuild uit");
let html=fs.readFileSync(bron,"utf8");

/* Deterministische stressfixture voor precies de randgevallen die in de 24-uurs-
   grafiek visueel druk kunnen worden: meerdere losse regenperioden, één periode
   over middernacht en meerdere lokale temperatuurpieken/dalen. */
const temp=(u,d)=>{
  const patroon=[19.5,19.1,18.7,18.2,18.8,19.4,18.9,18.4,18.1,18.6,19.2,19.8,20.4,19.9,19.3,18.8,18.4,18.1,18.6,19.2,19.7,19.1,18.5,18.9];
  return patroon[u]+(d===1?0.2:0);
};
const regen=(u,d)=>{
  if(d===0&&[16,17].includes(u))return 0.2;
  if((d===0&&u===23)||(d===1&&[0,1].includes(u)))return 0.3;
  if(d===1&&[6,7].includes(u))return 0.4;
  if(d===1&&[13,14].includes(u))return 0.2;
  return 0;
};
const fixtureData=bouw({
  temp,
  tempNu:19.3,
  wcNu:53,
  ccNu:92,
  pr:regen,
  pp:(u,d)=>regen(u,d)>0?88:18,
  som:5.1
});
fixtureData.latitude=52.37;fixtureData.longitude=5.22;fixtureData.timezone="Europe/Amsterdam";fixtureData.utc_offset_seconds=7200;
fixtureData.daily.sunshine_duration=fixtureData.daily.time.map(()=>6*3600);
const fixtureAir={current:{european_aqi:31,us_aqi:45},hourly:{time:[fixtureData.current.time],alder_pollen:[0],birch_pollen:[0],grass_pollen:[2],mugwort_pollen:[0],ragweed_pollen:[0],olive_pollen:[0]}};

const fetchStub=`<script>
const GRAPH_STRESS_FIXTURE=${JSON.stringify(fixtureData)};
const GRAPH_STRESS_AIR=${JSON.stringify(fixtureAir)};
const GRAPH_NATIVE_DATE=Date;
const GRAPH_NATIVE_START=GRAPH_NATIVE_DATE.now();
const GRAPH_FIXTURE_START=GRAPH_NATIVE_DATE.parse('2026-07-22T12:30:00Z');
class GraphStressDate extends GRAPH_NATIVE_DATE{
  constructor(...args){super(...(args.length?args:[GRAPH_FIXTURE_START+(GRAPH_NATIVE_DATE.now()-GRAPH_NATIVE_START)]));}
  static now(){return GRAPH_FIXTURE_START+(GRAPH_NATIVE_DATE.now()-GRAPH_NATIVE_START);}
}
window.Date=GraphStressDate;
window.fetch=async function(url){
  const u=String(url);
  const payload=u.includes('/api/waarschuwingen')?{bron:'test',dekking:true,land:'NL',lijst:[]}
    :u.includes('/api/neerslag')?{beschikbaar:false,provider:'knmi',reden:'niet beschikbaar'}
    :u.includes('/api/plaatsnaam')?{naam:'Grafiekstresstest',land:'NL',bron:'test'}
    :u.includes('air-quality-api.open-meteo.com')?GRAPH_STRESS_AIR:GRAPH_STRESS_FIXTURE;
  return {ok:true,status:200,json:async()=>payload,text:async()=>JSON.stringify(payload)};
};
try{Object.defineProperty(navigator,'geolocation',{value:undefined,configurable:true});}catch(e){}
</script>`;
html=html.replace("</head>",fetchStub+"</head>");

const reporter=`<script>
(function(){
  const botsingen=elementen=>elementen.filter((a,i)=>elementen.slice(i+1).some(b=>{
    const ra=a.getBoundingClientRect(),rb=b.getBoundingClientRect();
    return ra.width&&rb.width&&ra.height&&rb.height&&ra.left<rb.right-0.5&&ra.right>rb.left+0.5&&ra.top<rb.bottom-0.5&&ra.bottom>rb.top+0.5;
  })).length;
  setTimeout(()=>{
    try{
      const chart=document.getElementById('chart'),chartBox=chart&&chart.getBoundingClientRect();
      const tempLabels=chart?[...chart.querySelectorAll('text')].filter(el=>String(el.getAttribute('font-family')||'').includes('Bodoni Moda')&&/^-?\\d+°$/.test((el.textContent||'').trim())):[];
      const regenGroep=chart&&chart.querySelector('g[data-q4-rain-periods]');
      const regenLabels=regenGroep?[...regenGroep.querySelectorAll('text')]:[];
      const brackets=regenGroep?[...regenGroep.querySelectorAll('line[aria-label]')]:[];
      const regenBuiten=chartBox?regenLabels.filter(el=>{const r=el.getBoundingClientRect();return r.left<chartBox.left-1||r.right>chartBox.right+1||r.top<chartBox.top-1||r.bottom>chartBox.bottom+1;}).length:999;
      /* De Q4-owner voegt uitsluitend bij een echte kalendergrens aan beide
         zijden een weekdag toe. Toets dus dát semantische contract en niet één
         vooraf geraden klokrange: uurwaarden beschrijven het voorafgaande
         interval en kunnen daardoor bewust anders liggen dan de fixture-index. */
      const bracketAria=brackets.map(el=>el.getAttribute('aria-label')||'');
      const middernacht=bracketAria.some(aria=>{
        const m=/\\b(ma|di|wo|do|vr|za|zo)\\s+\\d{2}:\\d{2}[–-](ma|di|wo|do|vr|za|zo)\\s+\\d{2}:\\d{2}\\b/i.exec(aria);
        return !!(m&&m[1].toLowerCase()!==m[2].toLowerCase());
      });
      const bedragen=regenGroep?[...regenGroep.querySelectorAll('text[data-q4-rain-period-amount]')]:[];
      const resultaat=!!(chart&&regenGroep&&tempLabels.length>=5&&brackets.length>=4&&bedragen.length>=4&&middernacht&&botsingen(tempLabels)===0&&botsingen(regenLabels)===0&&regenBuiten===0&&chart.scrollWidth<=chart.clientWidth+1);
      document.body.dataset.graphStressResult=resultaat?'ok':'fout';
      document.body.dataset.graphStressTemps=String(tempLabels.length);
      document.body.dataset.graphStressPeriods=String(brackets.length);
      document.body.dataset.graphStressAmounts=String(bedragen.length);
      document.body.dataset.graphStressTempCollisions=String(botsingen(tempLabels));
      document.body.dataset.graphStressRainCollisions=String(botsingen(regenLabels));
      document.body.dataset.graphStressRainOutside=String(regenBuiten);
      document.body.dataset.graphStressMidnight=String(middernacht);
      document.body.dataset.graphStressAria=bracketAria.join('|');
    }catch(e){document.body.dataset.graphStressResult='exception';document.body.dataset.graphStressException=String(e&&e.message||e);}
  },10000);
})();
</script>`;
html=html.replace("</body>",reporter+"</body>");

const dir=fs.mkdtempSync(path.join(os.tmpdir(),"weathernow-graph-stress-"));
const fixture=path.join(dir,"index.html");fs.writeFileSync(fixture,html);
const url="file://"+fixture+"?lat=52.3700&lon=5.2200&plaats=Grafiekstresstest&land=NL";
try{
  const r=spawnSync(browser,["--headless=new","--no-sandbox","--disable-gpu","--disable-dev-shm-usage","--allow-file-access-from-files","--window-size=1440,1000","--virtual-time-budget=12000","--dump-dom",url],{encoding:"utf8",maxBuffer:16*1024*1024});
  if(r.status!==0)throw new Error("grafiekstresstest browser exit "+r.status+" "+(r.stderr||"").slice(-1000));
  const dom=r.stdout||"";
  const waarde=veld=>{const m=new RegExp('data-'+veld+'="([^"]*)"').exec(dom);return m&&m[1];};
  if(waarde("graph-stress-result")!=="ok")throw new Error("grafiekstresstest resultaat="+waarde("graph-stress-result")+", tempLabels="+waarde("graph-stress-temps")+", perioden="+waarde("graph-stress-periods")+", bedragen="+waarde("graph-stress-amounts")+", tempBotsingen="+waarde("graph-stress-temp-collisions")+", regenBotsingen="+waarde("graph-stress-rain-collisions")+", regenBuiten="+waarde("graph-stress-rain-outside")+", middernacht="+waarde("graph-stress-midnight")+", bracketAria="+waarde("graph-stress-aria")+", exception="+waarde("graph-stress-exception"));
  console.log("24-uursgrafiek stressregressie geslaagd: meerdere regenperioden, middernachtgrens en temperatuurpieken zonder labelbotsingen.");
}finally{fs.rmSync(dir,{recursive:true,force:true});}
