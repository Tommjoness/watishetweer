"use strict";
const fs=require("fs"),path=require("path"),http=require("http"),assert=require("assert");
const {chromium,webkit}=require("playwright");
const PUBLIC=path.join(__dirname,"public"),indexPad=path.join(PUBLIC,"index.html");
if(!fs.existsSync(indexPad))throw new Error("public/index.html ontbreekt.");
let html=fs.readFileSync(indexPad,"utf8");
html=html.replace("</head>",'<script>try{localStorage.clear();sessionStorage.clear();}catch(e){};window.fetch=async()=>({ok:false,status:503,json:async()=>({}),text:async()=>""});</script></head>');
const mime={".js":"application/javascript",".json":"application/json",".woff2":"font/woff2",".png":"image/png"};
const server=http.createServer((req,res)=>{const p=(req.url||"/").split("?")[0];if(p==="/"){res.writeHead(200,{"content-type":"text/html"});res.end(html);return;}const f=path.join(PUBLIC,p.replace(/^\//,""));if(f.startsWith(PUBLIC+path.sep)&&fs.existsSync(f)){res.writeHead(200,{"content-type":mime[path.extname(f)]||"application/octet-stream"});fs.createReadStream(f).pipe(res);return;}res.writeHead(404);res.end();});
async function check(type,naam,breedte){
  const browser=await type.launch({headless:true}),page=await browser.newPage({viewport:{width:breedte,height:900}}),errors=[];page.on("pageerror",e=>errors.push(String(e)));
  try{
    await page.goto("http://127.0.0.1:"+server.address().port+"/",{waitUntil:"domcontentloaded"});
    await page.waitForSelector("#thema");
    await page.waitForFunction(()=>document.documentElement.dataset.appBootstrap==="ready"&&!document.getElementById("thema-auto")?.disabled,null,{timeout:10000});
    const init=await page.evaluate(()=>{
      const groep=document.getElementById("thema"),auto=document.getElementById("thema-auto"),schakelaar=document.getElementById("thema-switch"),f=document.querySelector('link[rel="icon"]'),s=getComputedStyle(groep),t=getComputedStyle(document.querySelector(".tools"));
      return {
        role:groep.getAttribute("role"),
        label:groep.getAttribute("aria-label")||"",
        keuze:groep.dataset.actieveThemaKeuze,
        actief:document.documentElement.dataset.thema,
        autoPressed:auto.getAttribute("aria-pressed"),
        switchRole:schakelaar.getAttribute("role"),
        checked:schakelaar.getAttribute("aria-checked"),
        menu:!!document.getElementById("themamenu"),
        popup:groep.getAttribute("aria-haspopup"),
        track:!!groep.querySelector(".wiw-theme-track"),
        thumb:!!groep.querySelector(".wiw-theme-thumb"),
        sun:!!groep.querySelector(".wiw-theme-sun"),
        moon:!!groep.querySelector(".wiw-theme-moon"),
        status:!!groep.querySelector(".thema-status"),
        fav:f&&f.getAttribute("href"),
        past:groep.scrollWidth<=groep.clientWidth+1,
        clientWidth:groep.clientWidth,
        scrollWidth:groep.scrollWidth,
        fontSize:s.fontSize,
        fontFamily:s.fontFamily,
        letterSpacing:s.letterSpacing,
        paddingLeft:s.paddingLeft,
        paddingRight:s.paddingRight,
        toolsDisplay:t.display,
        toolsWidth:document.querySelector(".tools").clientWidth,
        childCount:groep.children.length
      };
    });
    assert.equal(init.role,"group",naam+": Weergave is een toegankelijke controlgroep");
    assert.equal(init.keuze,"auto",naam+": nieuwe bezoekers starten in Auto");
    assert.equal(init.autoPressed,"true",naam+": Auto is initieel geselecteerd");
    assert.equal(init.switchRole,"switch",naam+": zon/maan gebruikt een semantische switch");
    assert.equal(init.checked,"false",naam+": Auto toont standaard de lichte/fallback-stand als uitgeschakelde switch");
    assert.equal(init.menu,false,naam+": oud uitklapmenu hoort niet meer bij de weather-shell");
    assert.equal(init.popup,null,naam+": oude menu-popupsemantiek hoort niet meer bij de weather-shell");
    assert(init.track&&init.thumb&&init.sun&&init.moon,naam+": passende zon/maan-toggle ontbreekt");
    assert(!init.status,naam+": oude compacte statusbadge hoort niet meer in de toggle");
    assert(init.label&&/automatisch/i.test(init.label),naam+": huidige Auto-status is niet toegankelijk beschreven");
    assert(init.fav&&init.fav.startsWith("data:image/svg+xml,"),naam+": zon-favicon");
    assert(init.past,naam+": Weergavegroep past op "+breedte+"px; layout="+JSON.stringify({clientWidth:init.clientWidth,scrollWidth:init.scrollWidth,fontSize:init.fontSize,fontFamily:init.fontFamily,letterSpacing:init.letterSpacing,paddingLeft:init.paddingLeft,paddingRight:init.paddingRight,childCount:init.childCount,toolsDisplay:init.toolsDisplay,toolsWidth:init.toolsWidth}));

    const licht=await page.evaluate(()=>{themaKeuzeOpslaan("licht");themaToepassen();const k=document.getElementById("thema"),a=document.getElementById("thema-auto"),s=document.getElementById("thema-switch");return {thema:document.documentElement.dataset.thema,keuze:k.dataset.actieveThemaKeuze,autoPressed:a.getAttribute("aria-pressed"),checked:s.getAttribute("aria-checked"),sessie:JSON.parse(sessionStorage.getItem("weerbriefing.thema.sessie")||'"auto"'),opgeslagen:ls.get("weerbriefing.thema",""),actiefBewaar:ls.get("weerbriefing.actiefThema","")};});
    assert.deepEqual(licht,{thema:"licht",keuze:"licht",autoPressed:"false",checked:"false",sessie:"licht",opgeslagen:"licht",actiefBewaar:"licht"},naam+": expliciete lichte keuze wordt voor deze sessie zichtbaar en bewaard");

    await page.click('[data-thema-handmatig="donker"]');
    const donker=await page.evaluate(()=>{const k=document.getElementById("thema"),a=document.getElementById("thema-auto"),s=document.getElementById("thema-switch");return {thema:document.documentElement.dataset.thema,keuze:k.dataset.actieveThemaKeuze,autoPressed:a.getAttribute("aria-pressed"),checked:s.getAttribute("aria-checked"),sessie:JSON.parse(sessionStorage.getItem("weerbriefing.thema.sessie")||'"auto"'),opgeslagen:ls.get("weerbriefing.thema",""),actiefBewaar:ls.get("weerbriefing.actiefThema",""),ink45:getComputedStyle(document.documentElement).getPropertyValue("--ink-45").trim(),ink25:getComputedStyle(document.documentElement).getPropertyValue("--ink-25").trim()};});
    assert.deepEqual(donker,{thema:"donker",keuze:"donker",autoPressed:"false",checked:"true",sessie:"donker",opgeslagen:"donker",actiefBewaar:"donker",ink45:"#A8A8A8",ink25:"#959595"},naam+": zon/maan-toggle schakelt naar Donker voor deze sessie met sterker secundair contrast");

    await page.evaluate(()=>{S.d={current:{is_day:1}};themaKeuzeOpslaan("auto");themaToepassen();});
    const auto=await page.evaluate(()=>{const k=document.getElementById("thema"),a=document.getElementById("thema-auto"),s=document.getElementById("thema-switch");return {thema:document.documentElement.dataset.thema,keuze:k.dataset.actieveThemaKeuze,autoPressed:a.getAttribute("aria-pressed"),checked:s.getAttribute("aria-checked"),sessie:JSON.parse(sessionStorage.getItem("weerbriefing.thema.sessie")||'"auto"'),opgeslagen:ls.get("weerbriefing.thema",""),actiefBewaar:ls.get("weerbriefing.actiefThema","")};});
    assert.deepEqual(auto,{thema:"licht",keuze:"auto",autoPressed:"true",checked:"false",sessie:"auto",opgeslagen:"auto",actiefBewaar:"licht"},naam+": Auto-reset volgt de systeeminstelling (licht) zonder handmatige voorkeur");

    /* Auto volgt de systeeminstelling: met een donker systeem wordt Auto donker,
       ook als de gekozen plaats het overdag heeft. */
    await page.emulateMedia({colorScheme:"dark"});
    /* WebKit geeft de nieuwe mediawaarde asynchroon door; wacht tot de pagina
       het donkere systeem ziet voordat Auto wordt toegepast. */
    await page.waitForFunction(()=>matchMedia("(prefers-color-scheme: dark)").matches,null,{timeout:3000});
    /* Een change-event op een bestaande MediaQueryList volgt pas in de volgende
       renderronde. Laat die eerst verlopen: schakelt de test binnen hetzelfde
       frame terug naar licht, dan ziet de browser geen wijziging en blijft het
       live-event uit, iets wat bij een echte systeemwissel niet voorkomt. */
    await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
    const oudRood=await page.evaluate(()=>{ls.set("weerbriefing.thema","rood");S.d={current:{is_day:1}};themaToepassen();const k=document.getElementById("thema"),a=document.getElementById("thema-auto"),s=document.getElementById("thema-switch");return {sessie:JSON.parse(sessionStorage.getItem("weerbriefing.thema.sessie")||'"auto"'),opgeslagen:ls.get("weerbriefing.thema",""),actief:document.documentElement.dataset.thema,actiefBewaar:ls.get("weerbriefing.actiefThema",""),keuze:k.dataset.actieveThemaKeuze,autoPressed:a.getAttribute("aria-pressed"),checked:s.getAttribute("aria-checked"),roodOptie:!!document.querySelector('[data-thema-keuze="rood"]'),menu:!!document.getElementById("themamenu")};});
    assert.deepEqual(oudRood,{sessie:"auto",opgeslagen:"auto",actief:"donker",actiefBewaar:"donker",keuze:"auto",autoPressed:"true",checked:"true",roodOptie:false,menu:false},naam+": oude rode localStorage-voorkeur wordt genegeerd en veilig overschreven door de sessiekeuze Auto; gemeten "+JSON.stringify(oudRood));
    await page.emulateMedia({colorScheme:"light"});
    const systeemLicht=await page.waitForFunction(()=>document.documentElement.dataset.thema==="licht",null,{timeout:3000}).then(()=>true,()=>false);
    assert.equal(systeemLicht,true,naam+": Auto schakelt live mee als het systeem van donker naar licht gaat");
    assert.equal(await page.evaluate(()=>document.getElementById("thema-auto").getAttribute("aria-label")),"Automatisch (volgt je systeem)",naam+": Auto-knop legt uit dat hij het systeem volgt");
    assert.deepEqual(errors,[],naam+": geen page errors");
  }finally{await browser.close();}
}
server.listen(0,"127.0.0.1",async()=>{try{for(const [t,n] of [[chromium,"Chromium"],[webkit,"WebKit"]]){await check(t,n,390);await check(t,n,1280);}console.log("UI-shell browsercontrole groen in Chromium en WebKit met canoniek Auto/Licht/Donker-toggle en sessiegebonden handmatige keuze.");}catch(e){console.error(e.stack||e);process.exitCode=1;}finally{server.close();}});
