"use strict";
/* Log uitsluitend gecategoriseerde en gevalideerde codes. Nooit originele
   foutberichten, URL's, headers, IP's, body of tokens naar de CI-log. */
function foutKenmerken(fout){
  const wachtrij=[fout],bezocht=new Set(),codes=[];
  for(let i=0;i<wachtrij.length&&i<12;i++){
    const e=wachtrij[i];
    if(!e||typeof e!=="object"||bezocht.has(e))continue;
    bezocht.add(e);
    if(typeof e.code==="string"&&/^[A-Z][A-Z0-9_]{1,63}$/.test(e.code)&&!codes.includes(e.code))codes.push(e.code);
    if(e.cause)wachtrij.push(e.cause);
    if(Array.isArray(e.errors))wachtrij.push(...e.errors.slice(0,4));
  }
  const http=Number.isInteger(fout&&fout.httpStatus)&&fout.httpStatus>=100&&fout.httpStatus<=599?fout.httpStatus:null;
  const naam=String(fout&&fout.name||"");
  let soort="onbekend";
  if(http!==null)soort="http";
  else if(codes.some(c=>["ENOTFOUND","EAI_AGAIN","EAI_FAIL"].includes(c)))soort="dns";
  else if(codes.some(c=>["ETIMEDOUT","UND_ERR_CONNECT_TIMEOUT","UND_ERR_HEADERS_TIMEOUT","UND_ERR_BODY_TIMEOUT"].includes(c))||naam==="TimeoutError"||naam==="AbortError")soort="timeout";
  else if(codes.some(c=>/^(ERR_TLS_|ERR_SSL_|CERT_|DEPTH_ZERO_SELF_SIGNED_CERT|SELF_SIGNED_CERT_IN_CHAIN)/.test(c)))soort="tls";
  else if(codes.some(c=>/^(ECONN|ENET|EHOST|EPIPE|UND_ERR_SOCKET)/.test(c)))soort="tcp";
  else if(codes.includes("ONVOLLEDIGE_BRON"))soort="brondata";
  else if(naam==="SyntaxError")soort="json";
  else if(naam==="TypeError")soort="netwerk-onbekend";
  return {soort,http,codes:codes.slice(0,5)};
}
function veiligLabel(x){return String(x||"").replace(/[^\p{L}\p{N} _-]/gu,"").slice(0,48)||"-";}
function bronPogingLog({locatie,provider,poging,duurMs,fout}){
  const d=fout?foutKenmerken(fout):{soort:"-",http:null,codes:[]};
  return [
    "BRONPOGING", "tijd="+new Date().toISOString(),
    "locatie="+veiligLabel(locatie), "provider="+veiligLabel(provider),
    "poging="+Number(poging),"duur_ms="+Math.max(0,Math.round(duurMs)),
    "uitkomst="+(fout?"fout":"succes"),
    "soort="+d.soort,"http_status="+(d.http===null?"-":d.http),
    "oorzaakcodes="+(d.codes.join(",")||"-")
  ].join(" ");
}
function korteFout(fout){
  const d=foutKenmerken(fout);
  return "soort="+d.soort+", http="+(d.http===null?"-":d.http)+", oorzaakcodes="+(d.codes.join(",")||"-");
}
module.exports={foutKenmerken,bronPogingLog,korteFout};
