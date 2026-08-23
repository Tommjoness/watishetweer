"use strict";

const fs=require("fs"),path=require("path"),os=require("os"),{spawnSync}=require("child_process");
const browser=process.env.CHROME_PATH||process.env.CHROMIUM_PATH||"google-chrome";
const bron=path.join(__dirname,"public","index.html");
if(!fs.existsSync(bron))throw new Error("public/index.html ontbreekt; voer eerst de build/postbuild uit");
let html=fs.readFileSync(bron,"utf8");

/* Deze test heeft bewust geen netwerkdata nodig. De app-shell wordt zichtbaar
   gemaakt en we meten de echte layout van het gebouwde artifact. Daarmee vangen
   we precies het type regressie waarbij een SVG met calc(100% + 34px) een iPhone
   een horizontale scrollrange geeft, ook als html/body die later probeert te clippen. */
const reporter=`<script>
setTimeout(()=>{
  try{
    const app=document.getElementById('app'),state=document.getElementById('state');
    if(app)app.style.display='block';
    if(state)state.style.display='none';
    requestAnimationFrame(()=>requestAnimationFrame(()=>{
      const root=document.documentElement,body=document.body,vw=root.clientWidth;
      const chart=document.getElementById('chart'),nc=document.getElementById('nc');
      const binnen=(el)=>{
        if(!el)return false;
        const r=el.getBoundingClientRect(),p=el.parentElement&&el.parentElement.getBoundingClientRect();
        return r.width>0&&r.left>=-1&&r.right<=vw+1&&(!p||(r.width<=p.width+1&&r.left>=p.left-1&&r.right<=p.right+1));
      };
      const kandidaten=[...document.querySelectorAll('#app *')].filter(el=>{
        const s=getComputedStyle(el);if(s.display==='none'||s.position==='fixed')return false;
        const r=el.getBoundingClientRect();return r.width>0&&(r.left<-1||r.right>vw+1);
      }).slice(0,8).map(el=>el.id||el.className||el.tagName);
      const rootOk=root.scrollWidth<=vw+1,bodyOk=body.scrollWidth<=vw+1,chartOk=binnen(chart),ncOk=binnen(nc);
      body.dataset.overflowTestResult=rootOk&&bodyOk&&chartOk&&ncOk&&!kandidaten.length?'ok':'fout';
      body.dataset.overflowViewport=String(vw);
      body.dataset.overflowRoot=String(root.scrollWidth);
      body.dataset.overflowBody=String(body.scrollWidth);
      body.dataset.overflowChart=String(chartOk);
      body.dataset.overflowNowcast=String(ncOk);
      body.dataset.overflowOffenders=kandidaten.join('|');
    }));
  }catch(e){document.body.dataset.overflowTestResult='exception';document.body.dataset.overflowException=String(e&&e.message||e);}
},80);
</script>`;
html=html.replace("</body>",reporter+"</body>");

const dir=fs.mkdtempSync(path.join(os.tmpdir(),"weathernow-overflow-"));
const fixture=path.join(dir,"index.html");fs.writeFileSync(fixture,html);
const url="file://"+fixture;

function controleer(maat,naam){
  const r=spawnSync(browser,[
    "--headless=new","--no-sandbox","--disable-gpu","--disable-dev-shm-usage","--allow-file-access-from-files",
    "--force-device-scale-factor=1","--window-size="+maat,"--virtual-time-budget=800","--dump-dom",url
  ],{encoding:"utf8",maxBuffer:12*1024*1024});
  if(r.status!==0)throw new Error(naam+": browser exit "+r.status+" "+(r.stderr||"").slice(-1000));
  const dom=r.stdout||"",veld=naam=>{const m=new RegExp('data-'+naam+'="([^"]*)"').exec(dom);return m&&m[1];};
  if(veld("overflow-test-result")!=="ok")throw new Error(
    naam+": resultaat="+veld("overflow-test-result")+", viewport="+veld("overflow-viewport")+
    ", root="+veld("overflow-root")+", body="+veld("overflow-body")+", chart="+veld("overflow-chart")+
    ", nowcast="+veld("overflow-nowcast")+", offenders="+veld("overflow-offenders")+
    ", exception="+veld("overflow-exception")
  );
  console.log("Mobiele overflowtest "+naam+" groen: viewport "+veld("overflow-viewport")+" px zonder horizontale scrollrange.");
}

try{
  controleer("320,800","320px");
  controleer("375,812","375px");
  controleer("390,844","390px");
  controleer("430,932","430px");
}finally{fs.rmSync(dir,{recursive:true,force:true});}
