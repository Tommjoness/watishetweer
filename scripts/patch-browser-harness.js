"use strict";
const fs=require("fs"),path=require("path");
const p=path.resolve(__dirname,"..","browser-playwright.test.js");
let s=fs.readFileSync(p,"utf8");
function exact(oud,nieuw,label){
  const n=s.split(oud).length-1;
  if(n!==1)throw new Error(label+": verwacht precies één match, gevonden "+n);
  s=s.replace(oud,nieuw);
}
exact(
  'const f=path.join(__dirname,"public",p.replace(/^//,""));',
  'const rel=p.startsWith("/")?p.slice(1):p;const f=path.join(__dirname,"public",rel);',
  "Playwright-padregel"
);
exact(
  'if(fs.existsSync(f)&&fs.statSync(f).isFile()){res.writeHead(200);fs.createReadStream(f).pipe(res);}',
  'if(fs.existsSync(f)&&fs.statSync(f).isFile()){const ext=path.extname(f).toLowerCase(),types={".js":"application/javascript; charset=utf-8",".json":"application/json; charset=utf-8",".woff2":"font/woff2",".png":"image/png"};res.writeHead(200,{"content-type":types[ext]||"application/octet-stream"});fs.createReadStream(f).pipe(res);}',
  "Playwright MIME-types"
);
fs.writeFileSync(p,s,"utf8");
console.log("Playwright-testharnas hersteld: veilige paden en correcte MIME-types.");
