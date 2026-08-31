"use strict";

const fs=require("fs");
const path=require("path");
const os=require("os");
const {spawnSync}=require("child_process");
const {bouw}=require("./data.js");

const browser=process.env.CHROME_PATH||process.env.CHROMIUM_PATH||"google-chrome";
const bron=path.join(__dirname,"public","index.html");
if(!fs.existsSync(bron))throw new Error("public/index.html ontbreekt; voer eerst de postbuild uit");
let html=fs.readFileSync(bron,"utf8");

/* Echte-browserregressie voor het onderscheid nul versus ontbrekend. Open-Meteo
   levert pollen als CAMS-modelconcentraties. Als voor het exacte actuele uur alle
   beschikbare soorten expliciet 0 zijn, moet de gebruiker dus 0 korrels/m³ zien
   en niet het ontbrekende-data-symbool. De lichtere Node-DOM wordt elders voor
   bron- en randgevallen gebruikt; hier bewijst Chromium de werkelijke DOM-tekst. */
const weer=bouw({tempNu:18,wcNu:3,ccNu:55,pp:()=>15,som:0});
weer.latitude=52.396;weer.longitude=5.280;weer.timezone="Europe/Amsterdam";weer.utc_offset_seconds=7200;
weer.daily.sunshine_duration=weer.daily.time.map(()=>6.4*3600);
const lucht={
  current:{european_aqi:25,us_aqi:40},
  hourly:{
    time:[weer.current.time],
    alder_pollen:[0],birch_pollen:[0],grass_pollen:[0],mugwort_pollen:[0],ragweed_pollen:[0],olive_pollen:[0]
  }
};

const stub=`<script>
const POLLEN_WEER=${JSON.stringify(weer)};
const POLLEN_LUCHT=${JSON.stringify(lucht)};
window.fetch=async function(url){
  const u=String(url);
  const payload=u.includes('/api/waarschuwingen')?{bron:'test',dekking:true,land:'NL',lijst:[]}
    :u.includes('/api/neerslag')?{beschikbaar:false,provider:'knmi',reden:'niet beschikbaar'}
    :u.includes('/api/plaatsnaam')?{naam:'Almere',land:'NL',bron:'test'}
    :u.includes('air-quality-api.open-meteo.com')?POLLEN_LUCHT:POLLEN_WEER;
  return {ok:true,status:200,json:async()=>payload,text:async()=>JSON.stringify(payload)};
};
try{Object.defineProperty(navigator,'geolocation',{value:undefined,configurable:true});}catch(e){}
</script>`;
html=html.replace("</head>",stub+"</head>");

const reporter=`<script>
(function(){
  function controle(){
    try{
      const pollen=[...document.querySelectorAll('#aq .stat')].find(stat=>{
        const kop=stat.querySelector('.eyebrow');return kop&&(kop.textContent||'').trim()==='Pollen';
      });
      const val=pollen&&pollen.querySelector('.sval'),sub=pollen&&pollen.querySelector('.ssub');
      const waarde=val?(val.textContent||'').replace(/\\s+/g,' ').trim():'';
      const uitleg=sub?(sub.textContent||'').replace(/\\s+/g,' ').trim():'';
      const ok=!!pollen&&/^0\\s*korrels\\/m³$/.test(waarde)&&uitleg==='Model verwacht geen pollen voor dit uur.';
      document.body.dataset.pollenZeroResult=ok?'ok':'fout';
      document.body.dataset.pollenZeroValue=waarde;
      document.body.dataset.pollenZeroSub=uitleg;
    }catch(e){
      document.body.dataset.pollenZeroResult='exception';
      document.body.dataset.pollenZeroException=String(e&&e.message||e);
    }
  }
  setTimeout(controle,8000);
})();
</script>`;
html=html.replace("</body>",reporter+"</body>");

const dir=fs.mkdtempSync(path.join(os.tmpdir(),"weathernow-pollen-zero-"));
const fixture=path.join(dir,"index.html");
fs.writeFileSync(fixture,html,"utf8");
try{
  const url="file://"+fixture+"?lat=52.396&lon=5.280&plaats=Almere&land=NL";
  const r=spawnSync(browser,[
    "--headless=new","--no-sandbox","--disable-gpu","--disable-dev-shm-usage","--allow-file-access-from-files",
    "--window-size=1280,900","--virtual-time-budget=10000","--dump-dom",url
  ],{encoding:"utf8",maxBuffer:16*1024*1024});
  if(r.status!==0)throw new Error("Pollen-zero browser exit "+r.status+" "+String(r.stderr||"").slice(-1000));
  const dom=r.stdout||"";
  const veld=naam=>{const m=new RegExp('data-'+naam+'="([^"]*)"').exec(dom);return m&&m[1];};
  if(veld("pollen-zero-result")!=="ok"){
    throw new Error("Pollen-zero browser fout: resultaat="+veld("pollen-zero-result")+", waarde="+veld("pollen-zero-value")+", sub="+veld("pollen-zero-sub")+", exception="+veld("pollen-zero-exception"));
  }
  console.log("Echte Chromium-pollencheck geslaagd: expliciete modelnul toont zichtbaar 0 korrels/m³ en blijft onderscheiden van ontbrekende data.");
}finally{
  fs.rmSync(dir,{recursive:true,force:true});
}
