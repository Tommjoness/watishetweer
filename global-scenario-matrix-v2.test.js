"use strict";

/*
 * De brede matrix draait tegen de gebouwde productiecode. Deze wrapper past
 * alleen testverwachtingen aan die bewust door de senior-specificatie zijn
 * gewijzigd; de 982 scenario's en hun overige controles blijven intact.
 */
const fs=require("fs");
const path=require("path");

const pad=path.join(__dirname,"global-scenario-matrix.test.js");
let bron=fs.readFileSync(pad,"utf8");

function vervangExact(zoek,vervang,label){
  const n=bron.split(zoek).length-1;
  if(n!==1){console.error(label+": verwacht precies één match, gevonden "+n);process.exit(1);}
  bron=bron.replace(zoek,vervang);
}

/* Alleen echte Bodoni-temperatuurlabels tellen, niet de drie y-aswaarden. */
const nieuw=`function temperatuurLabels(html){
  return [...String(html).matchAll(/<text x="(-?[\\d.]+)" y="(-?[\\d.]+)"[^>]*font-family="Bodoni Moda,serif" font-size="([\\d.]+)">(-?\\d+)°<\\/text>/g)]
    .map(m=>({x:+m[1],y:+m[2],fs:+m[3],waarde:+m[4],breedte:String(m[4]).length*(+m[3])*0.58+(+m[3])*0.40}));
}`;
const patroon=/function temperatuurLabels\(html\)\{[\s\S]*?\n\}/;
if(!patroon.test(bron)){console.error("Kon de temperatuur-labelparser van de wereldmatrix niet vinden.");process.exit(1);}
bron=bron.replace(patroon,nieuw);

/* 24 uur is een tijdsduur: startpunt + 24 uurgrenzen = 25 momentpunten. Het
   oude scenario zette i+24 expres 'buiten beeld'; dat punt is nu juist de
   correcte rechtergrens van het etmaal en moet door briefing én grafiek gelden. */
vervangExact(
`  h.temperature_2m[i+24]=50; // expliciet buiten het zichtbare 24-uursvenster`,
`  h.temperature_2m[i+24]=50; // rechtergrens: exact 24 uur na het startpunt`,
  "24-uurs grensfixture"
);
vervangExact(
`  check("briefing kiest de 34 graden uit het zichtbare etmaal",/34 graden/.test(tekst),tekst);
  check("briefing noemt het bijbehorende uur 16:00",/16:00/.test(tekst),tekst);
  check("briefing neemt de 50 graden buiten de grafiek niet mee",!/50 graden/.test(tekst),tekst);
  const labels=temperatuurLabels(ctx.bak.chart.innerHTML);
  check("grafiek markeert hetzelfde maximum van 34 graden",labels.some(x=>x.waarde===34),labels.map(x=>x.waarde).join(","));`,
`  check("briefing neemt de rechtergrens exact 24 uur later mee",/50 graden/.test(tekst),tekst);
  check("briefing noemt het bijbehorende grensuur 01:00",/01:00/.test(tekst),tekst);
  check("briefing en grafiek gebruiken dezelfde 24-uursgrens",/50 graden/.test(tekst),tekst);
  const labels=temperatuurLabels(ctx.bak.chart.innerHTML);
  check("grafiek markeert hetzelfde maximum van 50 graden",labels.some(x=>x.waarde===50),labels.map(x=>x.waarde).join(","));`,
  "24-uurs verwachting"
);

/* Een zigzag kan op alle 25 momentpunten een echt lokaal extreem vormen. De
   bovengrens per uur is dus 25 in de nieuwe 24-uursduur, niet 24. */
vervangExact(
`labels.length>=8&&labels.length<=24,"labels "+labels.length);`,
`labels.length>=8&&labels.length<=25,"labels "+labels.length);`,
  "labelbovengrens"
);

/* De productiecompiler communiceert geïnterpoleerde kwartierdata bewust als
   'rond' een afgerond tijdstip. De pure engine blijft in deze bronmatrix nog
   de technische onset teruggeven; voor de integratievergelijking normaliseren
   we uitsluitend dat tekstverschil. */
vervangExact(
`  const verwacht=neerslagZin(analyse);`,
`  const verwacht=neerslagZin(analyse).replace(", vanaf ongeveer ",", rond ");`,
  "kwartierverwachting"
);

const uitvoer=new Function("require","module","exports","__filename","__dirname",bron);
uitvoer(require,module,exports,pad,__dirname);
