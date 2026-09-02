"use strict";
const assert=require("assert");
const {chromium,webkit}=require("playwright");

const ROOT="https://43694eef.watishetweer.pages.dev";
const SHA="8d0069cff6c2e86f63d7d6df1139bfa48db850ce";
const locaties=[
  {naam:"Amsterdam",land:"NL",lat:52.3676,lon:4.9041},
  {naam:"Kansas City",land:"US",lat:39.0997,lon:-94.5786,nws:true},
  {naam:"Dubai",land:"AE",lat:25.2048,lon:55.2708},
  {naam:"Kathmandu",land:"NP",lat:27.7172,lon:85.3240},
  {naam:"Longyearbyen",land:"SJ",lat:78.2232,lon:15.6469},
  {naam:"Ushuaia",land:"AR",lat:-54.8019,lon:-68.3030},
  {naam:"Zuidpool",land:"AQ",lat:-90,lon:0,plaatsnaamVrij:true}
];

function norm(s){return String(s||"").replace(/\s+/g," ").trim();}
function getal(v){return v!==null&&v!==undefined&&v!==""&&Number.isFinite(Number(v))?Number(v):null;}

async function controleer(browserType,browserNaam){
  const browser=await browserType.launch({headless:true});
  try{
    const context=await browser.newContext({viewport:{width:390,height:844},locale:"nl-NL",serviceWorkers:"block"});
    for(const locatie of locaties){
      const page=await context.newPage(),errors=[];
      page.on("pageerror",e=>errors.push(String(e)));
      const qs=new URLSearchParams({lat:String(locatie.lat),lon:String(locatie.lon),plaats:locatie.naam,land:locatie.land});
      const response=await page.goto(ROOT+"/?"+qs,{waitUntil:"domcontentloaded",timeout:35000});
      assert(response&&response.ok(),`${browserNaam}/${locatie.naam}: homepage HTTP ${response&&response.status()}`);
      await page.waitForSelector("#app",{state:"visible",timeout:30000});
      await page.waitForFunction(()=>document.querySelectorAll("#days .row.day:not(.kop)").length===7,null,{timeout:30000});
      await page.waitForTimeout(500);

      const basis=await page.evaluate(()=>{
        const rows=[...document.querySelectorAll("#days .row.day:not(.kop)")];
        const today=rows.find(r=>/Vandaag/i.test(r.querySelector(".dname")?.textContent||""))||rows[0];
        const described=today?.getAttribute("aria-describedby")||"";
        const descIds=described.split(/\s+/).filter(Boolean);
        const descText=descIds.map(id=>document.getElementById(id)?.textContent||"").join(" ");
        const h=S&&S.d&&S.d.hourly||{},i=Number.isInteger(S&&S.i0)?S.i0:-1;
        const dp=i>=0&&Array.isArray(h.dew_point_2m)?h.dew_point_2m[i]:null;
        return {
          sha:document.querySelector('meta[name="weather-build-sha"]')?.content||"",
          plaats:document.getElementById("place")?.getAttribute("aria-label")||"",
          rows:rows.length,
          todayLabel:today?.getAttribute("aria-label"),
          todayDescribedBy:described,
          todayDesc:normText(descText),
          todayText:normText(today?.textContent),
          todayName:normText(today?.querySelector(".dname")?.textContent),
          min:normText(today?.querySelector(".dmin")?.textContent),
          max:normText(today?.querySelector(".dmax")?.textContent),
          wind:normText(today?.querySelector(".dwind")?.textContent),
          rain:normText(today?.querySelector(".drain")?.textContent),
          visibleNote:normText(document.getElementById("final-today-window-note")?.textContent),
          pressureDetails:!!document.getElementById("wiw-more-measurements"),
          pressure:normText(document.getElementById("pres")?.textContent),
          pressureSub:normText(document.getElementById("pressub")?.textContent),
          pressureMeaning:normText(document.querySelector(".wiw-pressure-meaning")?.textContent),
          humidity:normText(document.getElementById("humsub")?.textContent),
          temperature:S&&S.d&&S.d.current?S.d.current.temperature_2m:null,
          rh:S&&S.d&&S.d.current?S.d.current.relative_humidity_2m:null,
          dewPoint:dp,
          warningText:normText(document.getElementById("waarschuwingen")?.textContent),
          warningCards:[...document.querySelectorAll("#waarschuwingen .waarsch")].map(card=>({
            title:normText(card.querySelector("h3")?.textContent),
            hasDetails:!!card.querySelector("details.waarsch-details"),
            officialLang:card.querySelector(".final-warning-official-text")?.getAttribute("lang")||"",
            officialTitleLang:card.querySelector(".final-warning-official-meta span")?.getAttribute("lang")||"",
            looseDirectText:[...card.children].filter(el=>el.tagName==="P"&&!el.classList.contains("final-warning-explanation")&&!el.classList.contains("waarsch-meta")).map(el=>normText(el.textContent)).join(" ")
          })),
          overflow:Math.max(document.documentElement.scrollWidth,document.body.scrollWidth)-document.documentElement.clientWidth
        };
        function normText(v){return String(v||"").replace(/\s+/g," ").trim();}
      });

      assert.equal(basis.sha,SHA,`${browserNaam}/${locatie.naam}: verkeerde preview-SHA ${basis.sha}`);
      assert.equal(basis.rows,7,`${browserNaam}/${locatie.naam}: geen zeven dagrijen`);
      if(!locatie.plaatsnaamVrij)assert.equal(basis.plaats,locatie.naam,`${browserNaam}/${locatie.naam}: plaatsidentiteit ${basis.plaats}`);
      else assert(norm(basis.plaats),`${browserNaam}/${locatie.naam}: poolplaatsidentiteit leeg`);
      assert.equal(basis.todayName,"Vandaag",`${browserNaam}/${locatie.naam}: huidige lokale dag heet niet Vandaag`);
      assert.equal(basis.todayLabel,null,`${browserNaam}/${locatie.naam}: Today-rij heeft nog een vervangend aria-label`);
      assert(/final-today-row-description/.test(basis.todayDescribedBy),`${browserNaam}/${locatie.naam}: Today mist aria-describedby`);
      assert(/Minimum en maximum gelden voor de volledige kalenderdag\./.test(basis.todayDesc),`${browserNaam}/${locatie.naam}: Today-beschrijving mist kalenderdagcontext (${basis.todayDesc})`);
      assert(/Vandaag: neerslag geldt vanaf nu; minimum en maximum gelden voor de volledige dag\./.test(basis.visibleNote),`${browserNaam}/${locatie.naam}: zichtbare Today-uitleg ontbreekt`);
      for(const [veld,waarde] of [["minimum",basis.min],["maximum",basis.max],["wind",basis.wind],["neerslag",basis.rain]])assert(norm(waarde),`${browserNaam}/${locatie.naam}: Today mist ${veld}`);
      if(/\d+\s*%/.test(basis.rain)&&/\d+(?:[.,]\d+)?\s*mm/i.test(basis.rain)){
        assert(/\d+ procent; .*millimeter/.test(basis.todayDesc),`${browserNaam}/${locatie.naam}: kans en hoeveelheid niet gescheiden uitgesproken (${basis.todayDesc})`);
      }
      assert(basis.pressureDetails,`${browserNaam}/${locatie.naam}: Meer meetgegevens ontbreekt`);
      assert(/\d/.test(basis.pressure)&&/hPa/i.test(basis.pressure),`${browserNaam}/${locatie.naam}: luchtdruk/hPa ontbreekt (${basis.pressure})`);
      assert(/drie uur|afgelopen drie uur|stabiel/i.test(basis.pressureSub),`${browserNaam}/${locatie.naam}: drie-uursdrukontwikkeling ontbreekt (${basis.pressureSub})`);
      assert(/zeeniveau/i.test(basis.pressureMeaning),`${browserNaam}/${locatie.naam}: zeeniveaubetekenis ontbreekt`);
      assert(basis.overflow<=2,`${browserNaam}/${locatie.naam}: ${basis.overflow}px horizontale overflow`);

      const t=getal(basis.temperature),rh=getal(basis.rh),dp=getal(basis.dewPoint),hum=basis.humidity;
      if(t!==null&&rh!==null&&dp!==null&&t<=8&&rh>=75&&dp>-15){
        assert(/Hoge relatieve luchtvochtigheid; koude lucht bevat weinig waterdamp\./.test(hum),`${browserNaam}/${locatie.naam}: koude hoge RH onjuist uitgelegd (${hum}; T=${t}, RH=${rh}, DP=${dp})`);
      }
      if(locatie.naam==="Dubai"&&dp!==null&&dp>=21)assert(/benauwde lucht/i.test(hum),`${browserNaam}/Dubai: hoog dauwpunt niet benauwd (${hum}; DP=${dp})`);
      if(locatie.naam==="Zuidpool"&&dp!==null&&dp<-15)assert(/extreem droge lucht/i.test(hum),`${browserNaam}/Zuidpool: extreem lage absolute vochtigheid niet benoemd (${hum}; DP=${dp})`);

      await page.waitForFunction(()=>{
        const t=(document.getElementById("waarschuwingen")?.textContent||"").trim();
        return t&&!/Officiële weerwaarschuwingen controleren/i.test(t);
      },null,{timeout:15000});
      const warnings=await page.evaluate(()=>({
        text:(document.getElementById("waarschuwingen")?.textContent||"").replace(/\s+/g," ").trim(),
        cards:[...document.querySelectorAll("#waarschuwingen .waarsch")].map(card=>({
          title:(card.querySelector("h3")?.textContent||"").trim(),
          hasDetails:!!card.querySelector("details.waarsch-details"),
          officialLang:card.querySelector(".final-warning-official-text")?.getAttribute("lang")||"",
          officialTitleLang:card.querySelector(".final-warning-official-meta span")?.getAttribute("lang")||"",
          loose:[...card.children].filter(el=>el.tagName==="P"&&!el.classList.contains("final-warning-explanation")&&!el.classList.contains("waarsch-meta")).map(el=>(el.textContent||"").trim()).join(" ")
        }))
      }));
      assert(warnings.text&&!/controleren…|controleren; dit kan even duren/i.test(warnings.text),`${browserNaam}/${locatie.naam}: waarschuwingstatus eindigt niet terminaal (${warnings.text})`);
      if(locatie.nws)for(const card of warnings.cards){
        assert(card.hasDetails,`${browserNaam}/Kansas City: NWS-kaart mist ingeklapte officiële tekst`);
        assert.equal(card.officialLang,"en",`${browserNaam}/Kansas City: officiële NWS-tekst mist lang=en`);
        assert.equal(card.officialTitleLang,"en",`${browserNaam}/Kansas City: officiële titel mist lang=en`);
        assert(!card.loose,`${browserNaam}/Kansas City: lange officiële Engelse tekst staat los in hoofdweergave`);
      }

      const rows=page.locator("#days .row.day:not(.kop)");
      await rows.nth(1).click();await page.waitForTimeout(200);
      assert.equal(await rows.nth(1).getAttribute("aria-pressed"),"true",`${browserNaam}/${locatie.naam}: dagselectie mist aria-pressed=true`);
      assert(norm(await page.locator("#chartlab").innerText()),`${browserNaam}/${locatie.naam}: grafieklabel leeg na dagselectie`);

      assert.deepEqual(errors,[],`${browserNaam}/${locatie.naam}: runtimefouten ${errors.join(" | ")}`);
      console.log(`TARGET OK ${browserNaam.padEnd(8)} ${locatie.naam}: Today/a11y, druk, vochtigheid, warning-terminal, dagselectie, overflow.`);
      await page.close();
    }
    await context.close();
  }finally{await browser.close();}
}

(async()=>{
  await controleer(chromium,"Chromium");
  await controleer(webkit,"WebKit");
  console.log(`TARGETED QA GESLAAGD: ${locaties.length} locaties × Chromium/WebKit op preview ${SHA}.`);
})().catch(e=>{console.error(e&&e.stack||e);process.exit(1);});
