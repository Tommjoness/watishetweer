import fs from 'node:fs';

const lees=p=>fs.readFileSync(p,'utf8');
const schrijf=(p,s)=>fs.writeFileSync(p,s,'utf8');
function vervang(s,zoek,nieuw,label){
  if(!s.includes(zoek)) throw new Error('Niet gevonden: '+label);
  return s.replace(zoek,nieuw);
}
function vervangRegex(s,re,nieuw,label){
  if(!re.test(s)) throw new Error('Niet gevonden: '+label);
  re.lastIndex=0;
  return s.replace(re,nieuw);
}

let index=lees('index.html');
let engine=lees('interpretatie-engine.js');
let build=lees('build-weather.js');
let tests=lees('prelaunch-regressions.test.js');

// 1. Briefing: actuele temperatuur niet herhalen; alleen context die niet al in de hero staat.
index=vervangRegex(index,
/  let zin2;[\s\S]*?\n  \/\/ wind/,
`  let zin2="";
  const nachtZin=tmin===null?"":" Vannacht koelt het af naar <b>"+tmin+" graden</b>.";
  if(huidige===null){
    if(tv!==null&&top!==null){
      zin2=dagAanduiding(h.time[top],true)+" wordt het maximaal <b>"+Math.round(tv)
        +" graden</b>, met het warmste moment rond "+hhmm(h.time[top])+"."+nachtZin;
    }else if(tmin!==null){
      zin2="Vannacht wordt ongeveer <b>"+tmin+" graden</b> verwacht.";
    }
  }else if(top!==null&&top>i&&tv>huidige+0.5){
    zin2=dagAanduiding(h.time[top],true)+" wordt het maximaal <b>"+Math.round(tv)
        +" graden</b>, met het warmste moment rond "+hhmm(h.time[top])+"."+nachtZin;
  }else if(dagPiek&&dagPiek.t<c.time&&Math.round(dagPiek.v)>nutemp){
    zin2=dagAanduiding(dagPiek.t,true)+" was het rond "+hhmm(dagPiek.t)+" het warmst met <b>"+Math.round(dagPiek.v)+" graden</b>."+nachtZin;
  }else if(tmin!==null&&tmin<nutemp-1){
    zin2="Vannacht koelt het af naar <b>"+tmin+" graden</b>.";
  }else if(tmin!==null){
    zin2="Vannacht blijft de temperatuur ongeveer gelijk.";
  }

  // wind`, 'temperatuurblok briefing');

// 2. Briefing: gewone 4 Bft-piek niet als hoofdnieuws presenteren; richting/trend blijft beschikbaar.
index=vervangRegex(index,
/  let zin3;[\s\S]*?\n  \/\* De interpretatielaag vervangt uitsluitend de neerslagzin\./,
`  let zin3="";
  if(wmax!==null&&wi!==null){
    const bm=bft(wmax);
    const rNu=eindigGetal(c.wind_direction_10m),rPiek=eindigGetal(h.wind_direction_10m&&h.wind_direction_10m[wi]);
    const richtingNu=kompas(rNu),richtingPiek=kompas(rPiek);
    const hoek=rNu===null||rPiek===null?null:Math.abs(((rPiek-rNu+540)%360)-180);
    const draait=hoek!==null&&hoek>45;
    const draaiTekst=draait&&richtingPiek?" en draait naar het "+richtingPiek:"";
    if(richtingNu) zin3="De wind komt uit het "+richtingNu+draaiTekst+".";
    const opvallendeWind=bm>=5||(gmax!==null&&gmax>=60);
    if(opvallendeWind){
      const moment=wi>i+1
        ? dagAanduiding(h.time[wi],true)+" rond "+hhmm(h.time[wi])
        : "De komende 24 uur";
      zin3+=(zin3?" ":"")+moment+" is de wind op zijn sterkst met <b>"+bm+" Bft</b> ("+BFTNAAM[bm]+")";
      zin3+=gmax!==null&&gmax>=60&&gi!==null?"; "+dagAanduiding(h.time[gi],true)+" in het uur "+weatherNowUurvak(h.time[gi])+" kunnen windstoten tot "+Math.round(gmax)+" km/u voorkomen.":".";
    }
  }

  /* De interpretatielaag vervangt uitsluitend de neerslagzin.`, 'windblok briefing');

// 3. De twee neerslagtegels benoemen hun tijdvak direct en gebruiken consumententaal.
index=index.replaceAll('Neerslag recent','Afgelopen 15 minuten').replaceAll('Neerslagkans binnenkort','Komend uur');
engine=engine.replaceAll('Neerslag recent','Afgelopen 15 minuten').replaceAll('Neerslagkans binnenkort','Komend uur');
engine=vervang(engine,'else if(kort.droog) set("pop","Geen");','else if(kort.droog) set("pop","Droog");','droog komend uur');
engine=vervang(engine,'set("prec",recent===null?"–":recent<=INTERPRETATIE_CONFIG.spoorMm?"Geen":(recent<0.1?"<0,1":nl(recent))+"<s>mm</s>");','set("prec",recent===null?"–":recent<=INTERPRETATIE_CONFIG.spoorMm?"Droog":(recent<0.1?"<0,1":nl(recent))+"<s>mm</s>");','droog recente neerslag');
engine=vervangRegex(engine,
/      const dag=S\.d\.daily\|\|\{\},idx=dag\.time\?dag\.time\.indexOf\(plaatsVandaag\(\)\):-1;\n      const dagsom=idx>=0&&dag\.precipitation_sum\?veldGetal\("precipitation",dag\.precipitation_sum\[idx\]\):null;\n      zetTekst\("precsub",recent===null[\s\S]*?\+dagHoeveelheidZin\(dagsom\)\);/,
`      zetTekst("precsub",recent===null
        ? "Recente neerslag is niet beschikbaar."
        : recent<=INTERPRETATIE_CONFIG.spoorMm
          ? "Geen neerslag gemodelleerd in de afgelopen "+intervalMin+" minuten."
          : "Modelwaarde over de afgelopen "+intervalMin+" minuten.");`, 'recente neerslag subtekst');

// 4. Technische kwartieruitleg is beschikbaar, maar niet langer prominent.
index=vervang(index,
'<p class="hint" id="nchint">Modelverwachting per kwartier. De bronresolutie verschilt per regio; buiten gebieden met echte 15-minutenmodeldata kan Open-Meteo uurdata interpoleren.</p>',
'<p class="hint" id="nchint">Kwartierverwachting op basis van weermodellen.</p>\n    <details class="data-uitleg"><summary>Over deze gegevens</summary><p>De bronresolutie verschilt per regio. Buiten gebieden met echte 15-minutenmodeldata kan Open-Meteo uurdata interpoleren.</p></details>',
'kwartieruitleg');
index=vervang(index,'#dagenhint{margin-top:8px}',`#dagenhint{margin-top:8px}
  .data-uitleg{font-size:11.5px;color:var(--ink-45);margin:-4px 0 12px}
  .data-uitleg summary{display:inline;cursor:pointer;color:var(--ink-45);box-shadow:inset 0 -1px 0 var(--rule)}
  .data-uitleg summary:hover{color:var(--ink)}
  .data-uitleg p{margin:7px 0 0;max-width:70ch}`, 'stijl data-uitleg');

// 5. Weektabel: mobiel geen smalle, afbrekende detailtekst; iets meer ruimte voor kans.
index=index.replaceAll('.drain small{display:block}', '.drain small{display:none}');
index=index.replaceAll('grid-template-columns:40px 22px 56px 1fr 1fr 48px','grid-template-columns:40px 22px 52px 1fr 1fr 64px');
index=index.replaceAll('grid-template-columns:40px 22px 1fr 1fr 48px','grid-template-columns:40px 22px 1fr 1fr 62px');

// 6. Minder technische monospace in consumenteninformatie; cijfers blijven tabulair.
index=index.replaceAll('.dmin,.dmax{font-family:var(--mono);', '.dmin,.dmax{font-family:var(--sans);');
index=index.replaceAll('.dwind{font-family:var(--mono);', '.dwind{font-family:var(--sans);');
index=index.replaceAll('.drain{font-family:var(--mono);', '.drain{font-family:var(--sans);');
index=index.replaceAll('.score{font-family:var(--mono);', '.score{font-family:var(--sans);');
index=index.replaceAll('h2 .r{font-family:var(--mono);', 'h2 .r{font-family:var(--sans);');

// 7. Nachtzicht: afgeronde score + duiding, kortere termen en compactere maantijden.
index=index.replaceAll('venster="gunstigste modelvenster van "+TT[bstart].slice(11,16)+" tot "+eind;', 'venster="Beste periode "+TT[bstart].slice(11,16)+"–"+eind;');
index=index.replaceAll('"Geen gunstig modelvenster: te veel maanlicht"','"Geen goed zichtvenster door maanlicht"');
index=index.replaceAll('"Geen gunstig modelvenster: te bewolkt"','"Geen goed zichtvenster door bewolking"');
index=index.replaceAll('"Geen gunstig modelvenster: te bewolkt en te veel maanlicht"','"Geen goed zichtvenster door bewolking en maanlicht"');
index=index.replaceAll('maanTekst="maanopkomst "+naarLokaal(mt.op)+" \\u00b7 maanondergang "+naarLokaal(mt.onder);','maanTekst="maan op "+naarLokaal(mt.op)+" \\u00b7 onder "+naarLokaal(mt.onder);');
index=index.replaceAll('maanTekst="maanopkomst "+naarLokaal(mt.op);','maanTekst="maan op "+naarLokaal(mt.op);');
index=index.replaceAll('maanTekst="maanondergang "+naarLokaal(mt.onder);','maanTekst="maan onder "+naarLokaal(mt.onder);');
index=vervang(index,
'      <div class="dname">${lbl}</div>\n      <div class="score" style="color:${kleur}">${nl(sc)}</div>',
'      <div class="dname">${lbl}</div>\n      <div class="score" style="color:${kleur}" title="Modelscore ${nl(sc)} van 10">${Math.round(sc)}/10</div>',
'nacht scoreweergave');
index=vervang(index,
'      <div class="nmeta wide">${venster}${maanTekst',
'      <div class="nmeta wide">${sc>=8.5?"Uitstekend":sc>=7?"Goed":sc>=5?"Redelijk":sc>=3.5?"Matig":"Ongunstig"} · ${venster}${maanTekst',
'nacht kwalitatieve duiding');
index=index.replaceAll('<div class="score">Modelscore 0-10</div>','<div class="score">Score</div>');
index=index.replaceAll('<div class="nmeta wide">Modelvenster (bewolking en maan)</div>','<div class="nmeta wide">Beste zichtperiode</div>');

// 8. Footer: attributie blijft zichtbaar; technische coordinaten staan ingeklapt.
index=vervang(index,
`    <footer>
      <span class="bron"><b>Weer en plaatszoeken</b> <a href="https://open-meteo.com" target="_blank" rel="noopener">Open-Meteo</a> · <b>Luchtkwaliteit en pollen</b> Open-Meteo / CAMS</span>
      <span class="bron"><b>Waarschuwingen</b> <a href="https://meteoalarm.org" target="_blank" rel="noopener">MeteoAlarm</a> / <a href="https://www.weather.gov" target="_blank" rel="noopener">National Weather Service</a> · <b>Plaatsnamen</b> BigDataCloud / <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">© OpenStreetMap-bijdragers</a> (fallback)</span>
      <span class="mono bron" id="coords"></span>
      <span class="bron"><a href="privacy.html">Privacy &amp; gegevens</a> · Geen account, advertentietracking of analytics.</span>
    </footer>`,
`    <footer>
      <span class="bron"><b>Bronnen</b> <a href="https://open-meteo.com" target="_blank" rel="noopener">Open-Meteo</a> / CAMS · <a href="https://meteoalarm.org" target="_blank" rel="noopener">MeteoAlarm</a> · <a href="https://www.weather.gov" target="_blank" rel="noopener">National Weather Service</a> · BigDataCloud / <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">© OpenStreetMap-bijdragers</a></span>
      <span class="bron"><a href="privacy.html">Privacy &amp; gegevens</a></span>
      <details class="bron footer-details"><summary>Technische locatiegegevens</summary><span id="coords"></span></details>
    </footer>`,
'compacte footer');
index=vervang(index,'  footer .mono{font-size:11.5px}',`  footer .mono{font-size:11.5px}
  footer details summary{cursor:pointer;display:inline;color:var(--ink-45)}
  footer details #coords{display:block;margin-top:3px;font-family:var(--sans);font-variant-numeric:tabular-nums}`, 'footer details stijl');

// 9. Grafiek: de waarde bij de rode nu-lijn is de actuele temperatuur, niet het uurmodelpunt.
index=vervang(index,
'  const Tgeldig=T.filter(v=>v!=null&&isFinite(v));',
'  const actueleGrafiekTemp=S.dag==null?eindigGetal(S.d.current&&S.d.current.temperature_2m):null;\n  const Tgeldig=T.filter(v=>v!=null&&isFinite(v));\n  if(actueleGrafiekTemp!==null) Tgeldig.push(actueleGrafiekTemp);',
'grafiekschaal actuele temperatuur');
index=vervang(index,'  let nu="",nuX=null;','  let nu="",nuX=null,nuTemp=null;','nu temp state');
index=vervang(index,
'      const xn=x(nuIdx); nuX=xn;\n      nu=`<line x1="${xn}" y1="${by-2}" x2="${xn}" y2="${pb+6}" stroke="${CARMINE}" stroke-width="1"/>\n          <text x="${xn+4}" y="${by+bh+13}" fill="${CARMINE}" font-family="DM Mono,monospace" font-size="${F.nu}">nu</text>`;',
'      const xn=x(nuIdx); nuX=xn; nuTemp=eindigGetal(S.d.current&&S.d.current.temperature_2m);\n      const nuStip=nuTemp===null?"":`<circle cx="${xn}" cy="${y(nuTemp)}" r="3" fill="${CARMINE}"/>`;\n      nu=`<line x1="${xn}" y1="${by-2}" x2="${xn}" y2="${pb+6}" stroke="${CARMINE}" stroke-width="1"/>${nuStip}\n          <text x="${xn+4}" y="${by+bh+13}" fill="${CARMINE}" font-family="DM Mono,monospace" font-size="${F.nu}">nu</text>`;',
'nu-lijn actuele stip');
index=vervangRegex(index,
/    const i=k\.i, v=T\[i\], bw=labelBreed\(v\);\n    let cx=x\(i\);/,
`    const i=k.i;
    const v=k.rang===4&&nuTemp!==null?nuTemp:T[i];
    const bw=labelBreed(v);
    let cx=k.rang===4&&nuX!==null?nuX:x(i);`,
'actueel temperatuurlabel');

// Buildinvariant volgt de nieuwe consumententekst.
build=build.replaceAll('"Neerslagkans binnenkort"','"Komend uur"');

// Permanente regressies voor precies deze UX-afspraken.
const marker='ok(index.includes("privacy.html")&&fs.existsSync(path.join(R,"privacy.html")),"privacy-informatie is direct bereikbaar");';
const nieuwTests=`${marker}
ok(!index.includes("Nu is het ")+!index.includes("De actuele temperatuur is niet beschikbaar.")>0,"briefing herhaalt de actuele temperatuur niet");
ok(index.includes("const opvallendeWind=bm>=5")&&index.includes("gmax!==null&&gmax>=60"),"gewone windpiek tot 4 Bft krijgt geen hoofdrol in briefing");
ok(index.includes("Afgelopen 15 minuten")&&index.includes("Komend uur")&&engine.includes('set(\\"pop\\",\\"Droog\\")'),"neerslagtegels gebruiken directe tijdvakken en consumententaal");
ok(index.includes("Kwartierverwachting op basis van weermodellen.")&&index.includes("<summary>Over deze gegevens</summary>"),"technische kwartieruitleg is ingeklapt beschikbaar");
ok(index.includes("${Math.round(sc)}/10")&&index.includes("Beste periode ")&&index.includes("Beste zichtperiode"),"nachtzicht toont afgeronde score en kortere consumententaal");
ok(index.includes("Technische locatiegegevens")&&index.includes("footer-details")&&!index.includes("Geen account, advertentietracking of analytics."),"footer houdt techniek uit de hoofdweergave");
ok(index.includes("nuTemp=eindigGetal(S.d.current&&S.d.current.temperature_2m)")&&index.includes("k.rang===4&&nuTemp!==null?nuTemp:T[i]"),"nu-label in grafiek gebruikt actuele temperatuur");`;
tests=vervang(tests,marker,nieuwTests,'UX-regressies invoegen');

schrijf('index.html',index);
schrijf('interpretatie-engine.js',engine);
schrijf('build-weather.js',build);
schrijf('prelaunch-regressions.test.js',tests);
console.log('UX-polishmigratie toegepast.');
