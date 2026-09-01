"use strict";

const assert=require("assert");
const {chromium}=require("playwright");
const {zichtbaarGetal,verifieerBronwaarheid}=require("./production-source-truth.js");

const ROOT=String(process.env.PRODUCTION_ROOT||"https://watishetweer.nl").replace(/\/$/,"");
const verwacht=String(process.env.EXPECTED_SHA||"").trim();
if(!/^[0-9a-f]{7,40}$/i.test(verwacht))throw new Error("EXPECTED_SHA ontbreekt of is ongeldig.");

const locaties=[
  {naam:"Amsterdam",land:"NL",lat:52.3676,lon:4.9041,tz:"Europe/Amsterdam"},
  {naam:"Singapore",land:"SG",lat:1.3521,lon:103.8198,tz:"Asia/Singapore"},
  {naam:"Ushuaia",land:"AR",lat:-54.8019,lon:-68.3030,tz:"America/Argentina/Ushuaia"},
  {naam:"La Paz",land:"BO",lat:-16.4897,lon:-68.1193,tz:"America/La_Paz"},
  {naam:"Longyearbyen",land:"SJ",lat:78.2232,lon:15.6469,tz:"Arctic/Longyearbyen",pool:true},
  {naam:"Zuidpool",land:"AQ",lat:-90,lon:0,tz:null,pool:true,plaatsnaamVrij:true},
  {naam:"Dubai",land:"AE",lat:25.2048,lon:55.2708,tz:"Asia/Dubai"},
  {naam:"Reykjavik",land:"IS",lat:64.1466,lon:-21.9426,tz:"Atlantic/Reykjavik"},
  {naam:"Punta Arenas",land:"CL",lat:-53.1638,lon:-70.9171,tz:"America/Punta_Arenas"},
  {naam:"Miami",land:"US",lat:25.7617,lon:-80.1918,tz:"America/New_York"},
  {naam:"Tokio",land:"JP",lat:35.6762,lon:139.6503,tz:"Asia/Tokyo"}
];
const schermen=[{naam:"mobiel",width:390,height:844},{naam:"desktop",width:1440,height:1000}];
function klokMinuten(tekst){const m=/^(\d{2}):(\d{2})$/.exec(String(tekst||""));return m?Number(m[1])*60+Number(m[2]):null;}
function klokVerschil(a,b){const x=klokMinuten(a),y=klokMinuten(b);if(x===null||y===null)return Infinity;const d=Math.abs(x-y);return Math.min(d,1440-d);}
function isVolledigeForecast(url){
  try{
    const u=new URL(url);
    return u.hostname==="api.open-meteo.com"&&u.pathname==="/v1/forecast"&&u.searchParams.get("forecast_hours")==="170"&&u.searchParams.get("past_hours")==="24"&&u.searchParams.has("hourly")&&u.searchParams.has("daily");
  }catch(e){return false;}
}

(async()=>{
  const browser=await chromium.launch({headless:true});
  try{
    for(const scherm of schermen){
      const context=await browser.newContext({viewport:{width:scherm.width,height:scherm.height},serviceWorkers:"block",locale:"nl-NL"});
      for(const locatie of locaties){
        const page=await context.newPage(),pageErrors=[];
        page.on("pageerror",e=>pageErrors.push(String(e)));
        const params=new URLSearchParams({lat:String(locatie.lat),lon:String(locatie.lon),plaats:locatie.naam,land:locatie.land});
        const bronBelofte=page.waitForResponse(r=>isVolledigeForecast(r.url())&&r.ok(),{timeout:30000});
        const [response,bronResponse]=await Promise.all([
          page.goto(ROOT+"/?"+params,{waitUntil:"domcontentloaded",timeout:30000}),bronBelofte
        ]);
        assert(response&&response.ok(),`${scherm.naam}/${locatie.naam}: homepage HTTP ${response&&response.status()}`);
        const bron=await bronResponse.json();
        await page.waitForSelector("#app",{state:"visible",timeout:25000});
        await page.waitForFunction(()=>document.querySelectorAll("#days .row.day:not(.kop)").length===7&&/^Gegevens opgehaald om \d{2}:\d{2}/.test(document.getElementById("stamp")?.textContent||""),null,{timeout:25000});
        const uit=await page.evaluate(()=>({
          sha:document.querySelector('meta[name="weather-build-sha"]')?.content||"",
          label:document.getElementById("place")?.getAttribute("aria-label")||"",
          query:document.getElementById("q")?.value||"",
          timezone:(document.getElementById("coords")?.textContent||"").split(" · ").at(-1),
          dagen:document.querySelectorAll("#days .row.day:not(.kop)").length,
          nachten:document.querySelectorAll("#nights .row.night:not(.kop)").length,
          nachtLeeg:(document.getElementById("nights")?.textContent||"").includes("Geen nachtdata beschikbaar"),
          nachtRijen:[...document.querySelectorAll("#nights .row.night:not(.kop)")].map((r,index)=>({
            index,
            d:r.dataset&&r.dataset.d!==undefined?r.dataset.d:null,
            naam:(r.querySelector(".dname")?.textContent||"").trim(),
            advies:(r.querySelector(".nachtadvies")?.textContent||"").trim(),
            venster:(r.querySelector(".nachtvenster")?.textContent||"").trim(),
            tekst:(r.textContent||"").trim(),
            hidden:!!r.hidden
          })),
          dailyTime:typeof S!=="undefined"&&S.d&&S.d.daily&&Array.isArray(S.d.daily.time)?S.d.daily.time.slice(0,7):[],
          currentTime:typeof S!=="undefined"&&S.d&&S.d.current?S.d.current.time||"":"",
          stamp:document.getElementById("stamp")?.textContent||"",
          overflow:Math.max(document.documentElement.scrollWidth,document.body.scrollWidth)-document.documentElement.clientWidth,
          titel:document.title,
          bronLinks:[...document.querySelectorAll('a[href*="open-meteo"],a[href*="knmi"]')].length,
          temperatuur:Number((document.getElementById("t")?.textContent||"").replace(",",".")),
          wind:(document.getElementById("wind")?.textContent||""),
          luchtdruk:document.getElementById("pres")?.textContent||"",
          uv:Number((document.getElementById("uv")?.textContent||"").replace(",",".")),
          thema:document.documentElement.getAttribute("data-thema")||"",
          klok:document.getElementById("plaatstijd")?.textContent||"",
          actueleLokaleTijd:typeof weatherNowActueleLokaleTijd==="function"?weatherNowActueleLokaleTijd():"",
          zon:document.getElementById("suntimes")?.textContent||"",
          drukLabel:[...document.querySelectorAll(".eyebrow")].find(e=>(e.textContent||"").includes("Luchtdruk"))?.textContent?.trim()||"",
          appTekst:document.getElementById("app")?.textContent||"",
          rijen:[...document.querySelectorAll("#days .row.day:not(.kop)")].map(rij=>{
            const hoofd=rij.querySelector(".drain")?.cloneNode(true),small=hoofd?.querySelector("small");
            const hoeveelheid=(small?.textContent||"").trim();if(small)small.remove();
            return {
              min:rij.querySelector(".dmin")?.textContent||"",
              max:rij.querySelector(".dmax")?.textContent||"",
              wind:rij.querySelector(".dwind")?.textContent||"",
              neerslagHoofd:(hoofd?.textContent||"").trim(),neerslagHoeveelheid:hoeveelheid,
              neerslagAria:rij.querySelector(".drain")?.getAttribute("aria-label")||""
            };
          })
        }));
        uit.wind=zichtbaarGetal(uit.wind);uit.luchtdruk=zichtbaarGetal(uit.luchtdruk);uit.uv=Number.isFinite(uit.uv)?uit.uv:null;
        uit.rijen=uit.rijen.map(r=>({...r,min:zichtbaarGetal(r.min),max:zichtbaarGetal(r.max),wind:zichtbaarGetal(r.wind)}));
        assert.equal(uit.sha,verwacht,`${scherm.naam}/${locatie.naam}: verkeerde build ${uit.sha}`);
        if(locatie.plaatsnaamVrij)assert(String(uit.label||"").trim(),`${scherm.naam}/${locatie.naam}: opgeloste plaatsidentiteit is leeg`);
        else assert.equal(uit.label,locatie.naam,`${scherm.naam}/${locatie.naam}: plaatsidentiteit werd ${uit.label}`);
        assert.equal(uit.query,uit.label,`${scherm.naam}/${locatie.naam}: zoekveld en opgeloste plaatsidentiteit verschillen (${uit.query} / ${uit.label})`);
        assert(bron.timezone&&typeof bron.timezone==="string",`${scherm.naam}/${locatie.naam}: provider gaf geen tijdzone`);
        assert.equal(uit.timezone,bron.timezone,`${scherm.naam}/${locatie.naam}: UI-tijdzone ${uit.timezone} wijkt af van bron ${bron.timezone}`);
        if(locatie.tz)assert.equal(bron.timezone,locatie.tz,`${scherm.naam}/${locatie.naam}: provider-tijdzone werd ${bron.timezone}, verwacht ${locatie.tz}`);
        assert.equal(uit.dagen,7,`${scherm.naam}/${locatie.naam}: geen zeven dagen`);
        assert(locatie.pool?(uit.nachten>0||uit.nachtLeeg):uit.nachten>0,`${scherm.naam}/${locatie.naam}: Nachtzicht heeft geen eerlijke staat`);
        const onjuisteToekomst=uit.nachtRijen.slice(1).filter(r=>/\b(?:was|waren)\b/i.test(r.tekst));
        assert.equal(onjuisteToekomst.length,0,`${scherm.naam}/${locatie.naam}: toekomstige Nachtzicht-rij gebruikt verleden tijd; fout=${JSON.stringify(onjuisteToekomst)}; alleRijen=${JSON.stringify(uit.nachtRijen)}; actueleLokaleTijd=${uit.actueleLokaleTijd}; currentTime=${uit.currentTime}; dailyTime=${JSON.stringify(uit.dailyTime)}`);
        assert(/^Gegevens opgehaald om \d{2}:\d{2} · /.test(uit.stamp),`${scherm.naam}/${locatie.naam}: ongeldige datastempel`);
        assert(uit.overflow<=1,`${scherm.naam}/${locatie.naam}: ${uit.overflow}px horizontale overflow`);
        assert(uit.titel.startsWith(uit.label+" · "),`${scherm.naam}/${locatie.naam}: titel en opgeloste plaats verschillen (${uit.titel} / ${uit.label})`);
        assert(uit.bronLinks>=1,`${scherm.naam}/${locatie.naam}: bronvermelding ontbreekt`);
        assert.equal(uit.drukLabel,"Luchtdruk op zeeniveau",`${scherm.naam}/${locatie.naam}: druksoort is niet ondubbelzinnig gelabeld`);
        assert(!/(?:^|[^\d])-?1\s+graden\b/i.test(uit.appTekst),`${scherm.naam}/${locatie.naam}: enkelvoudtemperatuur gebruikt 'graden'`);
        for(const [i,r] of uit.rijen.entries())assert(String(r.neerslagHoofd||r.neerslagHoeveelheid||r.neerslagAria).trim(),`${scherm.naam}/${locatie.naam}: dagrij ${i+1} heeft leeg neerslagveld`);
        /* De providerresponse blijft exact zoals ontvangen. Alleen de horizon
           voor de resterende huidige dag volgt dezelfde actuele lokale klok
           als de pagina; temperatuur, wind, pressure_msl, UV, thema en bronvelden
           blijven rechtstreeks tegen de ongewijzigde live response gecontroleerd. */
        const bronUit=verifieerBronwaarheid(bron,uit,`${scherm.naam}/${locatie.naam}`,uit.actueleLokaleTijd);
        const klokVerwacht=new Intl.DateTimeFormat("nl-NL",{timeZone:bron.timezone,hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).format(new Date());
        assert(klokVerschil(uit.klok,klokVerwacht)<=1,`${scherm.naam}/${locatie.naam}: lokale klok ${uit.klok} wijkt af van ${bron.timezone} (${klokVerwacht})`);
        assert.deepEqual(pageErrors,[],`${scherm.naam}/${locatie.naam}: pageerrors ${pageErrors.join(" | ")}`);
        console.log(`BRONWAARHEID OK ${scherm.naam.padEnd(7)} ${locatie.naam}: temperatuur, wind, pressure_msl, UV, druksoort, neerslagvelden, Nachtzicht-tijdsvorm, lokale tijd, zon en ${bronUit.dagen} dagrijen; overflow ${uit.overflow}px.`);
        await page.close();
      }
      await context.close();
    }
    console.log(`PRODUCTIE-BROWSERMONITOR GESLAAGD: ${verwacht}; ${locaties.length} locaties × mobiel/desktop met live bronvergelijking.`);
  }finally{await browser.close();}
})().catch(e=>{console.error(e&&e.stack||e);process.exit(1);});
