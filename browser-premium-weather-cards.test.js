"use strict";

const fs=require("fs"),path=require("path"),os=require("os"),assert=require("assert"),{spawnSync}=require("child_process"),{bouw}=require("./data.js");
const browser=process.env.CHROME_PATH||process.env.CHROMIUM_PATH||"google-chrome";

const d=bouw({temp:()=>18,tempNu:18,pp:()=>5,pr:()=>0,som:0,ws:9,wsNu:9,cc:()=>85,ccNu:85,wg:()=>12,wc:()=>3,wcNu:3});
d.current.time="2026-07-22T20:10";
d.current.temperature_2m=18;
d.current.apparent_temperature=18;
d.current.relative_humidity_2m=86;
d.current.dew_point_2m=13;
d.current.wind_speed_10m=9;
d.current.wind_direction_10m=157.5;
d.current.wind_gusts_10m=99; // blijft beschikbaar, maar voedt de hoofdtegel niet meer
const i=d.hourly.time.findIndex(t=>t==="2026-07-22T20:00");
assert(i>=0&&i+1<d.hourly.time.length,"fixture mist 20:00/21:00 uurpunten");
d.hourly.wind_gusts_10m[i]=11;
d.hourly.wind_gusts_10m[i+1]=14.4;
const di=d.daily.time.indexOf("2026-07-22");
assert(di>=0&&di+1<d.daily.time.length,"fixture mist vandaag/morgen in daily");
d.daily.sunset[di]="2026-07-22T21:45";
d.daily.sunset[di+1]="2026-07-23T21:44";

const air={current:{european_aqi:25,us_aqi:35},hourly:{time:[d.current.time],alder_pollen:[0],birch_pollen:[0],grass_pollen:[0],mugwort_pollen:[0],ragweed_pollen:[0],olive_pollen:[0]}};
let html=fs.readFileSync(path.join(__dirname,"public","index.html"),"utf8");
const fixedNow=Date.UTC(2026,6,22,18,10); // 20:10 CEST
const stub=`<script>
const PREMIUM_NATIVE_DATE=Date;
class PremiumFixtureDate extends PREMIUM_NATIVE_DATE{
  constructor(...args){super(...(args.length?args:[${fixedNow}]));}
  static now(){return ${fixedNow};}
}
Date=PremiumFixtureDate;
window.fetch=async function(url){
  const u=String(url);
  const payload=u.includes('/api/waarschuwingen')?${JSON.stringify({bron:"test",dekking:true,lijst:[],land:"NL"})}
    :u.includes('air-quality-api.open-meteo.com')?${JSON.stringify(air)}
    :u.includes('/api/plaatsnaam')?${JSON.stringify({naam:"Almere",land:"NL",bron:"test"})}
    :${JSON.stringify(d)};
  return {ok:true,status:200,json:async()=>payload,text:async()=>JSON.stringify(payload)};
};
try{Object.defineProperty(navigator,'geolocation',{value:undefined,configurable:true});}catch(e){}
</script>`;
html=html.replace("</head>",stub+"</head>");

const reporter=`<script>
setTimeout(()=>{
  try{
    const gust=document.getElementById('gust'),hum=document.getElementById('hum');
    const schoon=el=>String(el&&el.textContent||'').replace(/\\s+/g,' ').trim();
    document.body.dataset.premiumResult='ok';
    document.body.dataset.premiumGustKop=schoon(gust&&gust.closest('.stat')&&gust.closest('.stat').querySelector('.eyebrow'));
    document.body.dataset.premiumGustWaarde=schoon(gust);
    document.body.dataset.premiumGustSub=schoon(document.getElementById('gustsub'));
    document.body.dataset.premiumHumWaarde=schoon(hum);
    document.body.dataset.premiumHumSub=schoon(document.getElementById('humsub'));
    document.body.dataset.premiumOverflow=String(document.documentElement.scrollWidth-window.innerWidth);
  }catch(e){document.body.dataset.premiumResult='exception';document.body.dataset.premiumException=String(e&&e.message||e);}
},8000);
</script>`;
html=html.replace("</body>",reporter+"</body>");

const dir=fs.mkdtempSync(path.join(os.tmpdir(),"weathernow-premium-"));
const fixture=path.join(dir,"index.html");fs.writeFileSync(fixture,html);
const url="file://"+fixture+"?lat=52.35&lon=5.26&plaats=Almere&land=NL";

function controleer(maat,naam){
  const r=spawnSync(browser,[
    "--headless=new","--no-sandbox","--disable-gpu","--disable-dev-shm-usage","--allow-file-access-from-files",
    "--window-size="+maat,"--virtual-time-budget=10000","--dump-dom",url
  ],{encoding:"utf8",maxBuffer:16*1024*1024});
  if(r.status!==0)throw new Error(naam+": browser exit "+r.status+" "+String(r.stderr||"").slice(-1000));
  const dom=r.stdout||"";
  const veld=naam=>{const m=new RegExp('data-'+naam+'="([^"]*)"').exec(dom);return m?m[1].replace(/&amp;/g,"&").replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&lt;/g,"<").replace(/&gt;/g,">"):null;};
  assert.equal(veld("premium-result"),"ok",naam+": runtimefixture moet slagen; "+veld("premium-exception"));
  assert.equal(veld("premium-gust-kop"),"Tijd tot zonsondergang",naam+": hoofdtegel benoemt de resterende tijd tot zonsondergang");
  assert(/1\s*u\s*35\s*min/i.test(veld("premium-gust-waarde")||""),naam+": 20:10 tot 21:45 is 1 u 35 min; waarde="+veld("premium-gust-waarde"));
  assert(!/99|14\s*km\/u/i.test(veld("premium-gust-waarde")||""),naam+": windstootdata mag niet in de zonsondergangtegel lekken");
  assert.equal(veld("premium-gust-sub"),"Vandaag om 21:45.",naam+": subtekst noemt dezelfde lokale zonsondergang");
  assert(/86\s*%/.test(veld("premium-hum-waarde")||""),naam+": relatieve luchtvochtigheid blijft zichtbaar; waarde="+veld("premium-hum-waarde"));
  assert.equal(veld("premium-hum-sub"),"Aangename lucht. Dauwpunt circa 13 °C.",naam+": comfortduiding volgt het dauwpunt en niet alleen de relatieve luchtvochtigheid");
  assert(Number(veld("premium-overflow"))<=2,naam+": premium copy veroorzaakt geen horizontale overflow; overflow="+veld("premium-overflow"));
  console.log("Premium weerkaarten "+naam+" groen: tijd tot zonsondergang, dauwpuntgestuurde vochtigheidscopy en overflow kloppen.");
}

try{
  controleer("390,844","mobiel Chromium");
  controleer("1280,900","desktop Chromium");
}finally{fs.rmSync(dir,{recursive:true,force:true});}