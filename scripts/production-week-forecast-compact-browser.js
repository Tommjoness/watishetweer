"use strict";

const assert=require("assert");
const {chromium}=require("playwright");

const ROOT=String(process.env.PRODUCTION_ROOT||"https://watishetweer.nl").replace(/\/$/,"");
const verwacht=String(process.env.EXPECTED_SHA||"").trim();
if(!/^[0-9a-f]{7,40}$/i.test(verwacht))throw new Error("EXPECTED_SHA ontbreekt of is ongeldig.");

const locatie={naam:"Malargüe",land:"AR",lat:-35.478,lon:-69.585};
const schermen=[{naam:"desktop",width:1440,height:1000},{naam:"mobiel",width:390,height:844}];

(async()=>{
  const browser=await chromium.launch({headless:true});
  try{
    for(const scherm of schermen){
      const context=await browser.newContext({viewport:{width:scherm.width,height:scherm.height},serviceWorkers:"block",locale:"nl-NL"});
      const page=await context.newPage(),errors=[];
      page.on("pageerror",e=>errors.push(String(e)));
      const params=new URLSearchParams({lat:String(locatie.lat),lon:String(locatie.lon),plaats:locatie.naam,land:locatie.land});
      const response=await page.goto(ROOT+"/?"+params,{waitUntil:"domcontentloaded",timeout:30000});
      assert(response&&response.ok(),`${scherm.naam}: homepage HTTP ${response&&response.status()}`);
      await page.waitForSelector("#app",{state:"visible",timeout:25000});
      await page.waitForFunction(()=>document.querySelectorAll("#days .row.day:not(.kop)").length===7,null,{timeout:25000});
      const uit=await page.evaluate(()=>{
        const rijen=[...document.querySelectorAll("#days .row.day:not(.kop)")];
        const beschreven=rijen.map(r=>{
          const ids=String(r.getAttribute("aria-describedby")||"").split(/\s+/).filter(Boolean);
          return {i:r.dataset.i||"",ids,ontbrekend:ids.filter(id=>!document.getElementById(id))};
        }).filter(r=>r.ids.length);
        return {
          sha:document.querySelector('meta[name="weather-build-sha"]')?.content||"",
          marker:typeof WeatherNowWeekForecastCompact20260829!=="undefined",
          notities:document.querySelectorAll("#days .dag-neerslagnotitie").length,
          uitleg:!!document.getElementById("dagenneerslaguitleg"),
          beschreven,
          dagen:rijen.length,
          drains:rijen.map(r=>r.querySelector(".drain")).map(el=>(el?.innerText||"").replace(/\s+/g," ").trim()),
          tekst:(document.getElementById("days")?.innerText||"").replace(/\s+/g," ")
        };
      });
      assert.equal(uit.sha,verwacht,`${scherm.naam}: verkeerde productiebuild ${uit.sha}`);
      assert(uit.marker,`${scherm.naam}: compacte weekowner is niet actief`);
      assert.equal(uit.dagen,7,`${scherm.naam}: weekverwachting heeft niet zeven dagen`);
      assert.equal(uit.notities,0,`${scherm.naam}: lange dagnotities staan nog live`);
      assert.equal(uit.uitleg,false,`${scherm.naam}: losse weekuitleg staat nog live`);

      const beschrevenIds=uit.beschreven.flatMap(r=>r.ids);
      const ontbrekend=uit.beschreven.flatMap(r=>r.ontbrekend);
      assert(!beschrevenIds.some(id=>/^dag-neerslagnotitie-/i.test(id)),`${scherm.naam}: verwijderde dagnotitie blijft via aria-describedby gekoppeld`);
      assert.deepEqual(ontbrekend,[],`${scherm.naam}: aria-describedby verwijst naar ontbrekende elementen: ${ontbrekend.join(", ")}`);
      assert(beschrevenIds.includes("final-today-row-description"),`${scherm.naam}: Vandaag mist de aanvullende toegankelijke beschrijving`);
      assert.equal(uit.beschreven.filter(r=>r.ids.includes("final-today-row-description")).length,1,`${scherm.naam}: Vandaag-beschrijving moet exact aan één dagrij gekoppeld zijn`);

      assert.equal(uit.drains.length,7,`${scherm.naam}: Neerslag-kolom is onvolledig`);
      assert(uit.drains.every(Boolean),`${scherm.naam}: een Neerslag-cel is leeg`);
      for(const verboden of ["hoogste neerslagkans in één uur","berekende dagsom","verschillende modelwaarden","één op één samen te vallen"]){
        assert(!uit.tekst.toLowerCase().includes(verboden),`${scherm.naam}: lange uitleg staat nog live: ${verboden}`);
      }
      assert.deepEqual(errors,[],`${scherm.naam}: pageerrors ${errors.join(" | ")}`);
      console.log(`COMPACT WEEK OK ${scherm.naam}: ${uit.dagen} dagen, 0 lange notities, geldige Vandaag-beschrijving en Neerslag-kolom intact.`);
      await context.close();
    }
  }finally{await browser.close();}
})().catch(e=>{console.error(e&&e.stack||e);process.exit(1);});
