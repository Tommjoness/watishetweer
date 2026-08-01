const fs=require("fs");

function read(path){ return fs.readFileSync(path,"utf8"); }
function write(path,content){ fs.writeFileSync(path,content,"utf8"); }
function replaceOne(source, search, replacement, label){
  const matches=typeof search==="string"
    ? source.split(search).length-1
    : (source.match(search)||[]).length;
  if(matches!==1) throw new Error(label+": verwacht 1 match, gevonden "+matches);
  return source.replace(search,replacement);
}

/* 1. Centrale neerslagtaal en gedeelde compacte weergave */
{
  const path="interpretatie-engine.js";
  let s=read(path);
  s=replaceOne(s,
    /function neerslagZin\(analyse\)\{[\s\S]*?\n\}\n\nfunction modeCode/,
`function neerslagKorteWeergave(analyse){
  const a=analyse||{};
  if(!a.genoeg) return {hoofd:"–",detail:"",droog:false};
  const kans=a.kans===null?null:Math.round(Math.max(0,Math.min(100,a.kans)));
  if(a.status==="GEEN_KANS") return {hoofd:"Droog",detail:"",droog:true};
  if(a.status==="ZEER_KLEINE_KANS") return {hoofd:kans===null?"Zeer klein":kans+"%",detail:"zeer kleine kans",droog:false};
  if(a.status==="KLEINE_KANS") return {hoofd:kans===null?"Kleine kans":kans+"%",detail:"kleine kans",droog:false};
  if(a.status==="MOGELIJKE_NEERSLAG") return {hoofd:kans===null?"Mogelijk":kans+"%",detail:"hooguit enkele druppels",droog:false};
  if(a.status==="GROTE_KANS_ZONDER_HOEVEELHEID") return {hoofd:kans===null?"Grote kans":kans+"%",detail:"hooguit enkele druppels",droog:false};
  if(a.status==="SPOORHOEVEELHEID") return {hoofd:kans&&kans>0?kans+"%":"Druppels",detail:hoeveelheidTekst(a.hoeveelheid),droog:false};
  return {
    hoofd:kans===null?"Neerslag":kans+"%",
    detail:getal(a.hoeveelheid)>0?hoeveelheidTekst(a.hoeveelheid):"",
    droog:false
  };
}

function dagHoeveelheidZin(mm){
  const v=getal(mm);
  if(v===null) return "De totale neerslagverwachting voor vandaag is niet beschikbaar.";
  if(v<=INTERPRETATIE_CONFIG.spoorMm) return "Voor vandaag wordt geen neerslag verwacht.";
  if(v<INTERPRETATIE_CONFIG.meetbaarMm) return "Voor vandaag worden hooguit enkele druppels verwacht.";
  return "Voor vandaag wordt "+hoeveelheidTekst(v)+" neerslag verwacht.";
}

function neerslagZin(analyse){
  const a=analyse||{};
  const venster=vensterNaam(a.duurMin||120);
  if(!a.genoeg){
    return "Voor "+venster+" ontbreken voldoende consistente gegevens voor een betrouwbare inschatting.";
  }
  const kans=a.kans===null?null:Math.round(Math.max(0,Math.min(100,a.kans)));
  const kansTussen=kans===null?"":" (maximaal "+kans+"%)";
  if(a.status==="GEEN_KANS"){
    return "Voor "+venster+" wordt geen neerslag verwacht.";
  }
  if(a.status==="ZEER_KLEINE_KANS"){
    return "De kans op neerslag in "+venster+" is zeer klein"+kansTussen+".";
  }
  if(a.status==="KLEINE_KANS"){
    return "Er is een kleine kans op neerslag in "+venster+kansTussen+". De meeste berekeningen blijven droog.";
  }
  if(a.status==="MOGELIJKE_NEERSLAG"){
    return "Neerslag is mogelijk in "+venster+kansTussen+", maar waarschijnlijk gaat het om hooguit enkele druppels.";
  }
  if(a.status==="GROTE_KANS_ZONDER_HOEVEELHEID"){
    return "De kans op neerslag in "+venster+" is groot"+kansTussen+", maar waarschijnlijk gaat het om hooguit enkele druppels.";
  }
  if(a.status==="SPOORHOEVEELHEID"){
    return "In "+venster+" zijn hooguit enkele druppels mogelijk. Verwachte hoeveelheid: "+hoeveelheidTekst(a.hoeveelheid)+".";
  }
  if(a.status==="NEERSLAG_NU"){
    const totaal=getal(a.hoeveelheid)>=INTERPRETATIE_CONFIG.spoorMm
      ?" Verwachte hoeveelheid in "+venster+": "+hoeveelheidTekst(a.hoeveelheid)+".":"";
    return "Volgens het weermodel valt er nu "+a.soort+"."+totaal+(kans===null?"":" Maximale kans: "+kans+"%.");
  }
  const start=a.eersteTijd?", vanaf ongeveer "+a.eersteTijd:"";
  return "In "+venster+" wordt "+a.soort+" verwacht"+start+". Verwachte hoeveelheid: "
    +hoeveelheidTekst(a.hoeveelheid)+"."+(kans===null?"":" Maximale kans: "+kans+"%.");
}

function modeCode`,
    "centrale neerslagpresentatie"
  );

  s=replaceOne(s,
`  analyseerDagData,
  neerslagZin,
  statusRang`,
`  analyseerDagData,
  neerslagKorteWeergave,
  dagHoeveelheidZin,
  neerslagZin,
  statusRang`,
    "exports neerslagpresentatie"
  );

  s=replaceOne(s,
`      const uur=analyse(60);
      if(uur.genoeg){
        set("pop",(uur.kans===null?"–":uur.kans)+"<s>%</s>");
        zetTekst("popsub",neerslagZin(uur));
      }else{
        set("pop","–");
        zetTekst("popsub",neerslagZin(uur));
      }`,
`      const uur=analyse(60),kort=neerslagKorteWeergave(uur);
      if(!uur.genoeg) set("pop","–");
      else if(kort.droog) set("pop","Geen");
      else if(uur.kans!==null) set("pop",uur.kans+"<s>%</s>");
      else set("pop",kort.hoofd);
      zetTekst("popsub",neerslagZin(uur));`,
    "kans-tegel zonder droge nul"
  );

  s=replaceOne(s,
`      set("prec",recent===null?"–":(recent>0&&recent<0.1?"<0,1":nl(recent))+"<s>mm</s>");
      const dag=S.d.daily||{},idx=dag.time?dag.time.indexOf(plaatsVandaag()):-1;
      const dagsom=idx>=0&&dag.precipitation_sum?getal(dag.precipitation_sum[idx]):null;
      zetTekst("precsub",recent===null
        ? "Recente neerslag is niet beschikbaar."
        : "Modelwaarde over de afgelopen "+intervalMin+" minuten. Voor vandaag wordt "+hoeveelheidTekst(dagsom)+" verwacht.");`,
`      set("prec",recent===null?"–":recent<=INTERPRETATIE_CONFIG.spoorMm?"Geen":(recent<0.1?"<0,1":nl(recent))+"<s>mm</s>");
      const dag=S.d.daily||{},idx=dag.time?dag.time.indexOf(plaatsVandaag()):-1;
      const dagsom=idx>=0&&dag.precipitation_sum?getal(dag.precipitation_sum[idx]):null;
      zetTekst("precsub",recent===null
        ? "Recente neerslag is niet beschikbaar."
        : (recent<=INTERPRETATIE_CONFIG.spoorMm
          ? "Geen neerslag gemeten in de afgelopen "+intervalMin+" minuten. "
          : "Modelwaarde over de afgelopen "+intervalMin+" minuten. ")+dagHoeveelheidZin(dagsom));`,
    "recente neerslag zonder droge nul"
  );

  s=replaceOne(s,
`        if(kans){
          kans.innerHTML=(a.genoeg&&a.kans!==null?a.kans:"–")+"%"
            +(a.genoeg?"<small>"+hoeveelheidTekst(a.hoeveelheid)+"</small>":"");
          kans.title=a.genoeg&&a.kansTijdvak
            ? "Hoogste resterende kans in het uur "+a.kansTijdvak.begin+"–"+a.kansTijdvak.eind
            : "Geen betrouwbare kans beschikbaar";
        }`,
`        if(kans){
          const kort=neerslagKorteWeergave(a);
          if(!a.genoeg){
            kans.innerHTML="–";
            kans.title="Geen betrouwbare kans beschikbaar";
          }else if(kort.droog){
            kans.innerHTML="Droog";
            kans.title="Geen neerslag verwacht";
          }else{
            kans.innerHTML=kort.hoofd+(kort.detail?"<small>"+kort.detail+"</small>":"");
            kans.title=a.kansTijdvak
              ? "Hoogste resterende kans in het uur "+a.kansTijdvak.begin+"–"+a.kansTijdvak.eind
              : neerslagZin(a);
          }
        }`,
    "dagtabel zonder droge nul"
  );
  write(path,s);
}

/* 2. Grafiek: harde informatielimiet en nooit geforceerd overlappen */
{
  const path="index.html";
  let s=read(path);
  s=replaceOne(s,
    "  const kandidaten=kandidatenRuw.filter((k,pos)=>{",
    "  let kandidaten=kandidatenRuw.filter((k,pos)=>{",
    "kandidaten veranderbaar"
  );
  s=replaceOne(s,
`  });

  const labelBreed=v=>String(Math.round(v)).length*F.temp*0.58+F.temp*0.40;`,
`  });
  /* Informatiedichtheid volgt de beschikbare schermruimte. Op een telefoon zijn
     vijf temperatuurcijfers binnen 24 uur het maximum; bij langere bereiken
     wordt dat nog lager. Een label dat te dicht bij een belangrijker label ligt
     vervalt. De curve en tooltip blijven alle uurwaarden bevatten. */
  const maximumLabels=M?(n<=24?5:n<=48?4:3):(n<=24?9:n<=48?8:7);
  const minimumAfstand=M?(n<=24?48:n<=48?62:78):42;
  const gekozen=[];
  for(const k of kandidaten){
    if(gekozen.length>=maximumLabels) break;
    const teDicht=gekozen.some(g=>Math.abs(g.i-k.i)*cw<minimumAfstand);
    if(teDicht) continue;
    gekozen.push(k);
  }
  kandidaten=gekozen;

  const labelBreed=v=>String(Math.round(v)).length*F.temp*0.58+F.temp*0.40;`,
    "grafiek informatielimiet"
  );
  s=replaceOne(s,
    "  const MAXLAAG=5;   // meer dan genoeg lagen om zelfs een dichte 3-uursreeks te schikken",
    "  const MAXLAAG=M?2:3; // beperkte lagen: liever één cijfer minder dan een visuele stapel",
    "grafieklagen beperken"
  );
  s=replaceOne(s,
    /      else\{\n        \/\/ zelfs na eviction geen laag vrij \(zeldzaam\): forceer de\n        \/\/ dichtstbijzijnde plek, zodat het label nooit stilzwijgend verdwijnt\n        cy = eersteBoven \? y\(v\)-\(M\?13:14\) : y\(v\)\+\(M\?18:20\);\n        cy = Math\.min\(Math\.max\(cy,by\+bh\+6\+F\.temp\), pb-3\);\n      \}/,
`      else{
        // Geen veilige plek betekent geen label. De volledige waarde blijft
        // beschikbaar via de curve en tooltip; leesbaarheid gaat hier voor.
        return;
      }`,
    "geen geforceerde labelbotsing"
  );
  write(path,s);
}

/* 3. Tooltip: droge nul wordt taal, geen kaal percentage */
{
  const path="build-weather.js";
  let s=read(path);
  s=replaceOne(s,
`  '+rij(heel(G.P&&G.P[i])?"kans "+weatherNowUurvak(G.TI[i]):"neerslagkans",(heel(G.P&&G.P[i])?G.P[i]:"–")+"%",TEAL)',`,
`  '+rij(heel(G.P&&G.P[i])&&G.P[i]>0?"kans "+weatherNowUurvak(G.TI[i]):"neerslag",heel(G.P&&G.P[i])&&G.P[i]>0?G.P[i]+"%":"geen neerslag verwacht",TEAL)',`,
    "tooltip zonder 0%"
  );
  s=replaceOne(s,
`if(!html.includes("weatherNowUurvak")) throw new Error("Exact tooltip-tijdvak ontbreekt.");`,
`if(!html.includes("weatherNowUurvak")) throw new Error("Exact tooltip-tijdvak ontbreekt.");
if(!html.includes('"geen neerslag verwacht"')) throw new Error("Droge tooltip gebruikt nog een nulpercentage.");
if(!html.includes('kort.droog')) throw new Error("Droge neerslagweergaven zijn niet centraal afgevangen.");
if(!html.includes('maximumLabels=M?')) throw new Error("Harde limiet voor temperatuurlabels ontbreekt.");`,
    "buildbewaking droge presentatie"
  );
  write(path,s);
}

/* 4. Gerichte regressietests voor alle statustakken en mobiele stresscurves */
{
  const path="interpretatie-engine.test.js";
  let s=read(path);
  s=replaceOne(s,
`  neerslagZin,
  hoeveelheidTekst,
  statusRang`,
`  neerslagZin,
  neerslagKorteWeergave,
  dagHoeveelheidZin,
  hoeveelheidTekst,
  statusRang`,
    "testimports presentatie"
  );
  s=replaceOne(s,
`  assert.equal(neerslagZin(a),
    "De komende twee uur is de kans op neerslag zeer klein. Maximale kans: 4%. Verwachte hoeveelheid: 0,0 mm.");`,
`  assert.equal(neerslagZin(a),
    "De kans op neerslag in de komende twee uur is zeer klein (maximaal 4%).");`,
    "verwachting kleine kans"
  );
  s=replaceOne(s,
`test("0% en 0,0 mm wordt verwachting, geen garantie",()=>{
  const d=basis({kans:Array(9).fill(0)});
  const zin=neerslagZin(analyseerNeerslagData(d,120));
  assert(/wordt geen neerslag verwacht/.test(zin));
  assert(!/blijft.*droog/i.test(zin));
});`,
`test("droge verwachting noemt nergens 0% of 0,0 mm",()=>{
  for(const duur of [60,120,180,360]){
    const d=basis({kans:Array(9).fill(0)});
    const a=analyseerNeerslagData(d,duur);
    const zin=neerslagZin(a),kort=neerslagKorteWeergave(a);
    assert(/wordt geen neerslag verwacht/.test(zin),zin);
    assert(!/0%|0,0 mm/.test(zin+" "+kort.hoofd+" "+kort.detail),zin);
    assert.equal(kort.hoofd,"Droog");
  }
});`,
    "droge verwachtingstest"
  );
  s=replaceOne(s,
`if(process.exitCode){`,
`test("alle kans-zonder-hoeveelheidstakken leggen het signaal uit zonder 0,0 mm",()=>{
  const kansen=[1,19,20,39,40,69,70,100];
  for(const kans of kansen){
    const d=basis();
    d.hourly.precipitation_probability[3]=kans;
    d.hourly.precipitation_probability[4]=kans;
    const a=analyseerNeerslagData(d,120),zin=neerslagZin(a);
    assert(!/0,0 mm/.test(zin),kans+"%: "+zin);
    assert(!/Maximale kans: 0%/.test(zin),kans+"%: "+zin);
  }
});

test("daghoeveelheid gebruikt taal in plaats van droge nul",()=>{
  assert.equal(dagHoeveelheidZin(0),"Voor vandaag wordt geen neerslag verwacht.");
  assert.equal(dagHoeveelheidZin(0.04),"Voor vandaag worden hooguit enkele druppels verwacht.");
  assert(!/0,0 mm/.test(dagHoeveelheidZin(0)));
});

if(process.exitCode){`,
    "matrix regressietests"
  );
  write(path,s);
}

{
  const path="run.js";
  let s=read(path);
  s=replaceOne(s,
`/* 7d. labels boven de dagbalk mogen nooit buiten de tekening vallen */`,
`/* 7c2. Ook een extreem onrustige temperatuurreeks blijft op mobiel rustig. */
groep("Harde limiet temperatuurlabels");
for(const bereik of [24,48,168]){
  const {api,bak}=laadKern(390);
  const d=bouw({temp:(u,dag)=>12+((u+dag*3)%2?9:-5)+(u%5===0?4:0)});
  Object.assign(api.S,{d:d,op:Date.now(),lat:52.35,lon:5.26,label:"T",dag:null,bereik:bereik});
  api.S.i0=d.hourly.time.findIndex(t=>t.slice(0,13)===d.current.time.slice(0,13));
  api.etmaal(api.S.i0,bereik);
  const labels=[...bak.chart.innerHTML.matchAll(/<text x="([\\d.]+)" y="([\\d.]+)" text-anchor="middle" fill="[^"]+"[^>]*font-family="Bodoni Moda,serif" font-size="[\\d.]+">(-?\\d+)°<\\/text>/g)]
    .map(m=>({x:+m[1],y:+m[2],v:+m[3]})).sort((a,b)=>a.x-b.x);
  const limiet=bereik<=24?5:bereik<=48?4:3;
  check(bereik+" uur mobiel: niet meer dan "+limiet+" temperatuurcijfers",
    labels.length<=limiet,labels.length+" labels: "+labels.map(x=>x.v).join(","));
  let teDicht=0;
  for(let i=1;i<labels.length;i++) if(labels[i].x-labels[i-1].x<42) teDicht++;
  check(bereik+" uur mobiel: temperatuurcijfers staan niet opeengepakt",
    teDicht===0,teDicht+" te kleine afstanden");
}

/* 7d. labels boven de dagbalk mogen nooit buiten de tekening vallen */`,
    "mobiele grafiekstresstest"
  );
  write(path,s);
}

console.log("WeatherNow-correcties toegepast.");
