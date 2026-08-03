"use strict";

/*
 * Voert de brede wereldmatrix uit tegen de gebouwde productiecode. De eerste
 * versie telde per ongeluk ook de drie gradenlabels van de y-as mee als
 * temperatuurcijfers op de curve. Hier wordt uitsluitend die testparser
 * aangescherpt; alle 972 inhoudelijke scenario's blijven identiek.
 */
const fs=require("fs");
const path=require("path");

const pad=path.join(__dirname,"global-scenario-matrix.test.js");
let bron=fs.readFileSync(pad,"utf8");
const nieuw=`function temperatuurLabels(html){
  return [...String(html).matchAll(/<text x="(-?[\\d.]+)" y="(-?[\\d.]+)"[^>]*font-family="Bodoni Moda,serif" font-size="([\\d.]+)">(-?\\d+)°<\\/text>/g)]
    .map(m=>({x:+m[1],y:+m[2],fs:+m[3],waarde:+m[4],breedte:String(m[4]).length*(+m[3])*0.58+(+m[3])*0.40}));
}`;
const patroon=/function temperatuurLabels\(html\)\{[\s\S]*?\n\}/;
if(!patroon.test(bron)){
  console.error("Kon de temperatuur-labelparser van de wereldmatrix niet vinden.");
  process.exit(1);
}
bron=bron.replace(patroon,nieuw);

const uitvoer=new Function("require","module","exports","__filename","__dirname",bron);
uitvoer(require,module,exports,pad,__dirname);
