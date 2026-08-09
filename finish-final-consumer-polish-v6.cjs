"use strict";
const fs=require("fs"),path=require("path");
const rp=f=>path.join(__dirname,f);
function lees(f){return fs.readFileSync(rp(f),"utf8");}
function schrijf(f,s){fs.writeFileSync(rp(f),s);}
function exact(s,oud,nieuw,label){const n=s.split(oud).length-1;if(n!==1)throw new Error(label+": verwacht 1 match, kreeg "+n);return s.replace(oud,nieuw);}
function lijn(s,zoek,nieuw){const a=s.split("\n"),i=a.findIndex(x=>x.includes(zoek));if(i<0)throw new Error("regel niet gevonden: "+zoek);a[i]=nieuw;return a.join("\n");}

let html=lees("index.html");
html=exact(html,'.nachtmaan{margin-top:2px;color:var(--ink-25)}','.nachtmaan{margin-top:2px;color:var(--ink-25);white-space:nowrap}',"nachtmaan bij elkaar houden");
schrijf("index.html",html);

let s=lees("run.js");

// Zonsinformatie: dag is een eigen kop, de drie waarden staan eronder.
s=exact(s,
`  check("na zonsondergang toont de 24-uursgrafiek de volgende daglichtperiode",\n    /morgen · zonsopkomst 05:55/.test(bak.suntimes.innerHTML)\n      &&/zonsondergang 21:30/.test(bak.suntimes.innerHTML),bak.suntimes.innerHTML);`,
`  check("na zonsondergang toont de 24-uursgrafiek de volgende daglichtperiode",\n    /class="zondag">Morgen<\\/span>/.test(bak.suntimes.innerHTML)\n      &&/Zonsopkomst 05:55/.test(bak.suntimes.innerHTML)\n      &&/Zonsondergang 21:30/.test(bak.suntimes.innerHTML),bak.suntimes.innerHTML);`,"avond-zonhiërarchie");
s=exact(s,
`  check("de daglichtregel zegt overdag expliciet vandaag",\n    /vandaag · zonsopkomst/.test(bak.suntimes.innerHTML),bak.suntimes.innerHTML);`,
`  check("de daglichtregel zegt overdag expliciet vandaag",\n    /class="zondag">Vandaag<\\/span>/.test(bak.suntimes.innerHTML)\n      &&/Zonsopkomst/.test(bak.suntimes.innerHTML),bak.suntimes.innerHTML);`,"overdag-zonhiërarchie");
s=s.replace('/zonsopkomst \\d\\d:\\d\\d/.test(regels[0])','/zonsopkomst \\d\\d:\\d\\d/i.test(regels[0])');
s=s.replace('/zonsondergang \\d\\d:\\d\\d/.test(regels[1])','/zonsondergang \\d\\d:\\d\\d/i.test(regels[1])');
s=s.replace('check("label \'onder 21:37\' staat op de bron",/>onder 21:37</.test(svg));','check("label \'zon onder 21:37\' staat op de bron",/>zon onder 21:37</.test(svg));');
s=s.replace('check("3. sunrise 05:54 eindigt niet om 05:00 of 06:00",/>op 05:54</.test(svg));','check("3. sunrise 05:54 eindigt niet om 05:00 of 06:00",/>zon op 05:54</.test(svg));');

// Nachtzicht: dezelfde inhoud, nieuwe rustigere nested structuur en hoofdletter Maan.
s=s.replace('/maan op|maan onder/.test(bak.nights.innerHTML)','/maan op|maan onder/i.test(bak.nights.innerHTML)');
s=s.replace(/\/maan op \\d\\d:\\d\\d\|maan onder \\d\\d:\\d\\d\/\.test\(rh\[0\]\[2\]\)&&\/maan op \\d\\d:\\d\\d\|maan onder \\d\\d:\\d\\d\/\.test\(rb\[0\]\[2\]\)/g,'/maan op \\d\\d:\\d\\d|maan onder \\d\\d:\\d\\d/i.test(rh[0][2])&&/maan op \\d\\d:\\d\\d|maan onder \\d\\d:\\d\\d/i.test(rb[0][2])');
s=s.replace('/<span class="maangroep"><span class="maanbij"/.test(html) && !/·\\s*<span class="maanbij"/.test(html)','/<span class="nachtmaan"><span class="maanbij"/.test(html) && !/·\\s*<span class="maanbij"/.test(html)');
s=s.replace('nachtrijen.every(r=>/maan op \\d\\d:\\d\\d|maan onder \\d\\d:\\d\\d/.test(r.replace(/<[^>]+>/g,""))))','nachtrijen.every(r=>/maan op \\d\\d:\\d\\d|maan onder \\d\\d:\\d\\d/i.test(r.replace(/<[^>]+>/g,""))))');
s=s.replace('/\\.maangroep\\{white-space:nowrap\\}/.test(bronL) && /class="maangroep"><span class="maanbij"/.test(bronL)','/\\.nachtmaan\\{[^}]*white-space:nowrap/.test(bronL) && /class="nachtmaan"><span class="maanbij"/.test(bronL)');
const oudNachtParser=`    (bak.nights.innerHTML.match(/class="nmeta wide">([^<]*)</g)||[])\n      .map(m=>m.replace(/^class="nmeta wide">/,"").replace(/<$/,""))\n      .map(r=>norm(r).split("\\u00b7").slice(1).join("\\u00b7").trim())\n      .filter(r=>r&&!/^Modelvenster/.test(r))   // de kolomkop is geen nachtregel\n      .forEach(r=>regels.push([naam,r]));`;
const nieuwNachtParser=`    [...bak.nights.innerHTML.matchAll(/<span class="nachtadvies">([^<]+)<\\/span>/g)]\n      .map(m=>norm(m[1]).split("\\u00b7").slice(1).join("\\u00b7").trim())\n      .filter(Boolean)\n      .forEach(r=>regels.push([naam,r]));`;
s=exact(s,oudNachtParser,nieuwNachtParser,"nachtvenster-parser");

// Het actuele datapunt is nu één rode tekst in plaats van een tweede Bodoni-label.
const oudActueel=`    const {labs}=labelsVoor(reeks,{klokUur:8});\n    check("5. het actuele punt (index 8, geen raster/extreem) krijgt een label puur op basis van zijn prioriteit",\n      labs.some(l=>l.i===8), labs.map(l=>l.i+":"+l.v).join(","));`;
const nieuwActueel=`    const {labs,svg}=labelsVoor(reeks,{klokUur:8});\n    check("5. het actuele punt krijgt precies één expliciet rood nu-label in plaats van een tweede modeluurlabel",\n      !labs.some(l=>l.i===8) && />nu -?\\d+°<\\/text>/.test(svg),\n      labs.map(l=>l.i+":"+l.v).join(",")+" | "+(svg.match(/>nu [^<]+<\\/text>/)||["geen nu-label"])[0]);`;
s=exact(s,oudActueel,nieuwActueel,"actuele labelprioriteit");

const oudDubbel=`    const perIndex=new Map(indices.map((idx,k)=>[idx,labels[k]]));\n    const voor=perIndex.get(0),na=perIndex.get(1),xn=lijn?+lijn[1]:NaN;\n    const rand=(l,kant)=>l.x+kant*(String(l.waarde).length*l.fs*.58+l.fs*.40)/2;\n    check("21° en 19° rond de nu-lijn blijven allebei zichtbaar",!!voor&&!!na,\n      "indices "+indices.join(", ")+"; waarden "+labels.map(l=>l.waarde).join(", "));\n    if(voor&&na&&lijn){\n      const vrijVanLijn=l=>rand(l,1)<xn-1||rand(l,-1)>xn+1;\n      const horizontaal=Math.min(rand(voor,1),rand(na,1))-Math.max(rand(voor,-1),rand(na,-1));\n      const verticaal=Math.abs(voor.y-na.y);\n      check("21° en 19° vallen niet over de nu-lijn",vrijVanLijn(voor)&&vrijVanLijn(na),\n        "lijn "+xn.toFixed(1)+", vakken "+rand(voor,-1).toFixed(1)+"–"+rand(voor,1).toFixed(1)\n        +" en "+rand(na,-1).toFixed(1)+"–"+rand(na,1).toFixed(1));\n      check("21° en 19° botsen ook onderling niet",\n        horizontaal<=-4||verticaal>=Math.max(voor.fs,na.fs)+3,\n        "horizontale overlap "+horizontaal.toFixed(1)+", verticale afstand "+verticaal.toFixed(1));\n      check("geen temperatuurcijfer schuift in de ruimte van de y-as",\n        labels.every(l=>rand(l,-1)>=32),\n        labels.filter(l=>rand(l,-1)<32).map(l=>l.waarde+"° begint op "+rand(l,-1).toFixed(1)).join(", "));\n    }`;
const nieuwDubbel=`    const rand=(l,kant)=>l.x+kant*(String(l.waarde).length*l.fs*.58+l.fs*.40)/2;\n    const nabijeIndices=indices.filter(idx=>idx===0||idx===1);\n    check("rond de nu-lijn staat alleen de actuele temperatuur en geen concurrerend modeluurlabel",\n      />nu 21°<\\/text>/.test(h)&&nabijeIndices.length===0,\n      "indices "+indices.join(", ")+"; nu="+(h.match(/>nu [^<]+<\\/text>/)||["ontbreekt"])[0]);\n    check("de overblijvende temperatuurcijfers blijven uit de ruimte van de y-as",\n      labels.every(l=>rand(l,-1)>=32),\n      labels.filter(l=>rand(l,-1)<32).map(l=>l.waarde+"° begint op "+rand(l,-1).toFixed(1)).join(", "));`;
s=exact(s,oudDubbel,nieuwDubbel,"nu-burencontract");

// Nu-lijnbron en hint zijn dynamischer/korter geworden.
s=s.replace('/fill="\\$\\{CARMINE\\}"[^>]*>nu<\\/text>/.test(bronN)','/const nuLabel=nuTemp===null\\?"nu":"nu "\\+Math\\.round\\(nuTemp\\)\\+"°"/.test(bronN) && /fill="\\$\\{CARMINE\\}"/.test(bronN)');
s=s.replace('/fill="\\$\\{CARMINE\\}"[^>]*>nu<\\/text>/.test(bronP)','/const nuLabel=nuTemp===null\\?"nu":"nu "\\+Math\\.round\\(nuTemp\\)\\+"°"/.test(bronP) && /fill="\\$\\{CARMINE\\}"/.test(bronP)');
s=s.replace('bak.chart.innerHTML.length>0 && /vinger/i.test(bak.charthint.textContent)','bak.chart.innerHTML.length>0 && bak.charthint.textContent==="Houd de grafiek vast voor details."');
s=s.replace('bak.charthint.textContent==="Houd je vinger op de grafiek voor meer informatie"','bak.charthint.textContent==="Houd de grafiek vast voor details."');

// Kleurcontract: centrale tokens blijven, maar normale secties zijn bewust neutraal.
s=exact(s,
`    && /--accent-night:#142C4C/.test(bronK3)\n    && /--accent-sun:#F2CE63/.test(bronK3));`,
`    && /--accent-night:#142C4C/.test(bronK3)\n    && /--accent-sun:var\\(--rule\\)/.test(bronK3));`,"centrale accenttokens");
s=exact(s,
`  check("#142C4C en #F2CE63 komen ieder precies één keer als hardcoded hex voor (alleen in de tokendefinitie)",\n    (bronK3.match(/#142C4C/g)||[]).length===1 && (bronK3.match(/#F2CE63/g)||[]).length===1);`,
`  check("nachtkleur blijft centraal en het oude felle UV-geel is volledig verwijderd",\n    (bronK3.match(/#142C4C/g)||[]).length===1 && (bronK3.match(/#F2CE63/g)||[]).length===0\n      && /--teal:#65716C/.test(bronK3) && /--teal:#A7AEAB/.test(bronK3));`,"hardcoded accentkleuren");
s=exact(s,
`  check("#aq behoudt alleen zijn dunne accentlijn (border-top), geen background meer",\n    /#aq\\{border-top:2px solid var\\(--accent-info\\)\\}/.test(bronK3)\n    && !/#aq\\{[^}]*background/.test(bronK3));`,
`  check("#aq gebruikt alleen een dunne neutrale scheidingslijn, geen background",\n    /#aq\\{border-top:1px solid var\\(--rule\\)\\}/.test(bronK3)\n    && !/#aq\\{[^}]*background/.test(bronK3));`,"AQ kleurcontract");
s=s.replace('!/\\.dashrow-aq/.test(bronD2) && /#aq\\{border-top:2px solid var\\(--accent-info\\)\\}/.test(bronD2)','!/\\.dashrow-aq/.test(bronD2) && /#aq\\{border-top:1px solid var\\(--rule\\)\\}/.test(bronD2)');
s=s.replace('bronH.indexOf("#nights{border-top:2px solid var(--accent-night)}")>=0\n    && bronH.indexOf("#nights{border-top:2px solid var(--accent-night)}")','bronH.indexOf("#nights{border-top:1px solid var(--rule)}")>=0\n    && bronH.indexOf("#nights{border-top:1px solid var(--rule)}")');
s=s.replace('bronH.indexOf("#aq{border-top:2px solid var(--accent-info)}")>=0','bronH.indexOf("#aq{border-top:1px solid var(--rule)}")>=0');
s=s.replace('bronH.indexOf("#aq{border-top:2px solid var(--accent-info)}")\n      < bronH.indexOf("@media(min-width:900px) and (max-width:1099px)")','bronH.indexOf("#aq{border-top:1px solid var(--rule)}")\n      < bronH.indexOf("@media(min-width:900px) and (max-width:1099px)")');
s=exact(s,
`  check("6. de kleurregels gebruiken de centrale accenttokens, geen losse hex/rgba, en geen surface-tints meer",\n    /var\\(--accent-night\\)/.test(bronH)\n    && /var\\(--accent-info\\)/.test(bronH) && /var\\(--accent-sun\\)/.test(bronH)\n    && !/var\\(--surface-/.test(bronH));`,
`  check("6. normale secties gebruiken het centrale neutrale regeltoken, zonder surface-tints of losse kleurvlakken",\n    /#nights\\{border-top:1px solid var\\(--rule\\)\\}/.test(bronH)\n    && /#aq\\{border-top:1px solid var\\(--rule\\)\\}/.test(bronH)\n    && /\\.stat\\.breed\\{border-top:1px solid var\\(--rule\\)\\}/.test(bronH)\n    && !/var\\(--surface-/.test(bronH));`,"neutrale kleurregels");
s=exact(s,
`    check("2. #nights heeft geen background meer, alleen nog de dunne accentlijn",\n      /#nights\\{border-top:2px solid var\\(--accent-night\\)\\}/.test(bronP)\n      && !/#nights\\{[^}]*background/.test(bronP));\n    check("4. de accentlijn staat buiten desktop-only mediaqueries",\n      bronP.indexOf("#nights{border-top:2px solid var(--accent-night)}")\n        < bronP.indexOf("@media(min-width:900px) and (max-width:1099px)"));`,
`    check("2. #nights heeft geen background meer, alleen nog een dunne neutrale scheidingslijn",\n      /#nights\\{border-top:1px solid var\\(--rule\\)\\}/.test(bronP)\n      && !/#nights\\{[^}]*background/.test(bronP));\n    check("4. de neutrale scheidingslijn staat buiten desktop-only mediaqueries",\n      bronP.indexOf("#nights{border-top:1px solid var(--rule)}")\n        < bronP.indexOf("@media(min-width:900px) and (max-width:1099px)"));`,"nachtlijn v69");

schrijf("run.js",s);
console.log("Brede UX-contracten bijgewerkt en nachtmaan bij elkaar gehouden.");
