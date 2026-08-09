"use strict";
const fs=require("fs"),path=require("path");
const p=path.resolve(__dirname,"..","index.html");
let s=fs.readFileSync(p,"utf8");
function exact(oud,nieuw,label){const n=s.split(oud).length-1;if(n!==1)throw new Error(label+": verwacht één match, gevonden "+n);s=s.replace(oud,nieuw);}

/* Een externe abort moet ook de timeoutboekhouding direct opruimen. Dit is
   zichtbaar bij snelle hertekeningen/locatiewissels en voorkomt dat kortlevende
   timeout-handles zich opstapelen terwijl een oude fetch al ongeldig is. */
exact(
`  const controller=new AbortController(),extern=opt.signal||null;
  const onAbort=()=>controller.abort();
  if(extern){if(extern.aborted)controller.abort();else extern.addEventListener("abort",onAbort,{once:true});}
  const timer=setTimeout(()=>controller.abort(),Number.isFinite(opt.timeoutMs)?opt.timeoutMs:10000);`,
`  const controller=new AbortController(),extern=opt.signal||null;
  let timer=null;
  const onAbort=()=>{if(timer!==null){clearTimeout(timer);timer=null;}controller.abort();};
  if(extern){if(extern.aborted)controller.abort();else extern.addEventListener("abort",onAbort,{once:true});}
  timer=setTimeout(()=>controller.abort(),Number.isFinite(opt.timeoutMs)?opt.timeoutMs:10000);`,
"abort ruimt timeout op");
exact('    clearTimeout(timer);','    if(timer!==null) clearTimeout(timer);',"timeout cleanup");

/* Waarschuwingen hebben dezelfde generatiebescherming als voorheen, maar oude
   netwerkrequests worden nu ook werkelijk geannuleerd. */
exact(
'let laadTeller=0,waarschuwingTeller=0,actieveWeerController=null,actieveLuchtController=null;',
'let laadTeller=0,waarschuwingTeller=0,actieveWeerController=null,actieveLuchtController=null,actieveWaarschuwingController=null;',
"waarschuwingcontroller state");
exact(
`async function waarschuwingen(){
  const mijnBeurt=++waarschuwingTeller;
  const lat=S.lat,lon=S.lon;`,
`async function waarschuwingen(){
  const mijnBeurt=++waarschuwingTeller;
  if(actieveWaarschuwingController) actieveWaarschuwingController.abort();
  const waarschuwingController=new AbortController();
  actieveWaarschuwingController=waarschuwingController;
  const lat=S.lat,lon=S.lon;`,
"waarschuwing abort start");
exact(
'    const d=await j("/api/waarschuwingen?lat="+lat+"&lon="+lon);',
'    const d=await j("/api/waarschuwingen?lat="+lat+"&lon="+lon,{timeoutMs:7000,signal:waarschuwingController.signal});',
"waarschuwing fetch signal");

/* Op een 24-uurs desktopkolom past '2,4 mm' nipt. Het label behoudt daarom de
   eenheid zolang vrijwel de hele kolombreedte beschikbaar is; op mobiel/week
   blijft de bestaande fallback naar alleen het cijfer of niets intact. */
exact('const tekst = breed(vol)<=cw*0.92 ? vol : breed(kaal)<=cw*0.92 ? kaal : null;',
'const tekst = breed(vol)<=cw*0.98 ? vol : breed(kaal)<=cw*0.92 ? kaal : null;',
"mm label met eenheid");

fs.writeFileSync(p,s,"utf8");
console.log("Runtime-hardening toegepast: aborts, waarschuwingrequest en mm-label.");
