"use strict";

const fs=require("fs");
const os=require("os");
const path=require("path");
const {spawnSync}=require("child_process");
const {LOCATIES}=require("./seo-locations.config.js");

function browser(){
  for(const n of ["google-chrome","google-chrome-stable","chromium","chromium-browser"]){
    const r=spawnSync("sh",["-lc","command -v "+n],{encoding:"utf8"});
    if(r.status===0&&r.stdout.trim())return r.stdout.trim();
  }
  return null;
}
const chrome=browser();
if(!chrome){
  if(process.env.CI)throw new Error("Chrome/Chromium ontbreekt voor release-recovery-browser-gate.");
  console.log("SKIP release-recovery-browser-gate: lokaal geen Chrome/Chromium.");
  process.exit(0);
}

const ROOT=path.join(__dirname,"..");
const PUBLIC=path.join(ROOT,"public");
const APP_RE=/<script src="\/(app-[0-9a-f]{12}\.min\.js)" defer><\/script>/;
const profileRoot=fs.mkdtempSync(path.join(os.tmpdir(),"weather-release-recovery-"));

function prepare(html,name,mode,delayMs){
  let bron=String(html).replace('<base href="/">',"").replace(/src="\//g,'src="./');
  const app=(APP_RE.exec(html)||[])[1];
  if(!app)throw new Error(`${name}: actieve hoofdclient ontbreekt in harnessbron.`);
  const appTag=`<script src="./${app}" defer></script>`;
  if((bron.split(appTag).length-1)!==1)throw new Error(`${name}: hoofdclienttag niet eenduidig na padnormalisatie.`);
  if(mode==="blocked"){
    bron=bron.replace(appTag,'<script src="./__blocked-main.js" defer></script>');
  }else if(mode==="delayed"){
    const loader=`release-loader-${name.replace(/[^a-z0-9]/gi,"-")}-${delayMs}.js`;
    fs.writeFileSync(path.join(PUBLIC,loader),`setTimeout(function(){var s=document.createElement("script");s.src="./${app}";document.body.appendChild(s);},${delayMs});`,"utf8");
    bron=bron.replace(appTag,`<script src="./${loader}" defer></script>`);
  }
  const pad=path.join(PUBLIC,`release-recovery-${name}.html`);
  fs.writeFileSync(pad,bron,"utf8");
  return {pad,app};
}
function run(pad,budget,extra=[]){
  const profile=path.join(profileRoot,path.basename(pad)+"-"+Math.random().toString(36).slice(2));
  const r=spawnSync(chrome,[
    "--headless=new","--no-sandbox","--disable-gpu","--disable-dev-shm-usage",
    "--allow-file-access-from-files","--window-size=390,900",
    "--user-data-dir="+profile,"--virtual-time-budget="+budget,"--dump-dom",
    ...extra,"file://"+pad
  ],{encoding:"utf8",maxBuffer:32*1024*1024});
  if(r.status!==0)throw new Error(`Chrome exit ${r.status}: ${String(r.stderr||"").slice(-1600)}`);
  return r.stdout||"";
}
function assert(cond,msg){if(!cond)throw new Error(msg);}
function controlDisabled(dom,id){
  const m=new RegExp(`<(?:input|button)[^>]*id="${id}"[^>]*>`).exec(dom);
  return !!(m&&/\sdisabled(?:=""|\s|>)/.test(m[0]));
}

try{
  const root=fs.readFileSync(path.join(PUBLIC,"index.html"),"utf8");
  const amsterdam=LOCATIES.find(x=>x.slug==="amsterdam");
  if(!amsterdam)throw new Error("Amsterdam ontbreekt uit locatieconfig.");
  const ams=fs.readFileSync(path.join(PUBLIC,"weer",amsterdam.slug,"index.html"),"utf8");

  {
    const h=prepare(root,"nojs-root","normal",0);
    const dom=run(h.pad,1000,["--disable-javascript"]);
    assert(dom.includes("JavaScript is nodig om actuele weergegevens op te halen."),"No-JS root mist begrijpelijke foutmelding.");
    for(const id of ["q","here","ververs","thema"])assert(controlDisabled(dom,id),`No-JS root: #${id} is niet disabled.`);
  }
  {
    const h=prepare(ams,"nojs-amsterdam","normal",0);
    const dom=run(h.pad,1000,["--disable-javascript"]);
    assert(dom.includes("JavaScript is nodig om actuele weergegevens op te halen."),"No-JS plaatsroute mist begrijpelijke foutmelding.");
    for(const id of ["q","here","ververs","thema"])assert(controlDisabled(dom,id),`No-JS plaatsroute: #${id} is niet disabled.`);
  }

  {
    const h=prepare(root,"blocked-root","blocked",0);
    const dom=run(h.pad,16500);
    assert(/<html[^>]*class="[^"]*weather-app-failed/.test(dom),"Geblokkeerde root-mainbundle activeert failed state niet.");
    assert(dom.includes('id="weather-bootstrap-status" class="msg err" role="alert">'),"Geblokkeerde root-mainbundle toont herstelstate niet.");
    for(const id of ["q","here","ververs","thema"])assert(controlDisabled(dom,id),`Failed-JS root: #${id} is niet disabled.`);
  }
  {
    const h=prepare(ams,"blocked-amsterdam","blocked",0);
    const dom=run(h.pad,16500);
    assert(/<html[^>]*class="[^"]*weather-app-failed/.test(dom),"Geblokkeerde plaats-mainbundle activeert failed state niet.");
    for(const id of ["q","here","ververs","thema"])assert(controlDisabled(dom,id),`Failed-JS plaatsroute: #${id} is niet disabled.`);
  }

  {
    const h=prepare(root,"slow-success","delayed",5000);
    const dom=run(h.pad,8000);
    assert(dom.includes('data-weather-app-ready="1"'),"Trage succesvolle bootstrap markeert app niet ready.");
    assert(!/weather-app-failed/.test((/<html[^>]*>/.exec(dom)||[""])[0]),"Trage succesvolle bootstrap gaf valse failed state.");
    for(const id of ["q","here","ververs","thema"])assert(!controlDisabled(dom,id),`Trage succesvolle bootstrap laat #${id} disabled.`);
  }

  {
    const h=prepare(root,"error-recovery","delayed",16000);
    const dom=run(h.pad,19000);
    assert(dom.includes('data-weather-app-ready="1"'),"Error→success recovery bereikt ready state niet.");
    assert(!/weather-app-failed/.test((/<html[^>]*>/.exec(dom)||[""])[0]),"Error→success recovery ruimt failed class niet op.");
    assert(/id="weather-bootstrap-status"[^>]*hidden/.test(dom),"Error→success recovery verbergt foutstate niet opnieuw.");
    for(const id of ["q","here","ververs","thema"])assert(!controlDisabled(dom,id),`Error→success recovery laat #${id} disabled.`);
  }

  console.log("Release-recovery browser gate groen: no-JS root+plaatsroute, blocked-main root+plaatsroute, slow-success en error→success recovery.");
}finally{
  for(const naam of fs.readdirSync(PUBLIC)){
    if(/^release-(?:recovery|loader)-/.test(naam))fs.rmSync(path.join(PUBLIC,naam),{force:true});
  }
  fs.rmSync(profileRoot,{recursive:true,force:true});
}
