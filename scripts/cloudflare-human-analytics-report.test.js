"use strict";

const assert=require("node:assert/strict");
const {
  DOMAIN,tokenKandidaten,venstersUitOmgeving,periode,bouwQuery,graphql,haalVenster,rapportMarkdown
}=require("./cloudflare-human-analytics-report.js");

(async()=>{
  assert.equal(DOMAIN,"watishetweer.nl");

  assert.deepEqual(
    tokenKandidaten({CLOUDFLARE_ANALYTICS_API_TOKEN:" ana ",CLOUDFLARE_DEPLOY_API_TOKEN:" dep "}),
    [{bron:"dedicated-analytics",token:"ana"},{bron:"deploy-fallback",token:"dep"}]
  );
  assert.deepEqual(
    tokenKandidaten({CLOUDFLARE_ANALYTICS_API_TOKEN:"same",CLOUDFLARE_DEPLOY_API_TOKEN:"same"}),
    [{bron:"dedicated-analytics",token:"same"}]
  );

  assert.deepEqual(venstersUitOmgeving(""),[1,7,30]);
  assert.deepEqual(venstersUitOmgeving("30,1,7,7"),[1,7,30]);
  assert.throws(()=>venstersUitOmgeving("0,7"),/tussen 1 en 30/);

  const vast=new Date("2026-09-16T16:00:00.000Z");
  assert.deepEqual(periode(1,vast),{
    start:"2026-09-15T16:00:00.000Z",
    einde:"2026-09-16T16:00:00.000Z"
  });

  const accountId="0123456789abcdef0123456789abcdef";
  const query=bouwQuery({
    accountId,
    start:"2026-09-15T16:00:00.000Z",
    einde:"2026-09-16T16:00:00.000Z"
  });
  assert.match(query,/rumPageloadEventsAdaptiveGroups/);
  assert.match(query,/requestHost:\"watishetweer\.nl\"/);
  assert.match(query,/\{bot:0\}/);
  assert.match(query,/\{bot:1\}/);
  assert.doesNotMatch(query,/PostHog|Plausible/i);

  let verstuurdeQuery="";
  const fetchOk=async(_url,options)=>{
    verstuurdeQuery=JSON.parse(options.body).query;
    return {
      ok:true,
      status:200,
      async text(){
        return JSON.stringify({
          data:{viewer:{accounts:[{
            allTraffic:[{count:12,sum:{visits:7},avg:{sampleInterval:1}}],
            humanTraffic:[{count:10,sum:{visits:6},avg:{sampleInterval:1}}],
            botTraffic:[{count:2,sum:{visits:1},avg:{sampleInterval:1}}]
          }]}},
          errors:null
        });
      }
    };
  };

  const venster=await haalVenster({accountId,token:"secret",dagen:1,nu:vast,fetchImpl:fetchOk});
  assert.match(verstuurdeQuery,/bot:0/);
  assert.deepEqual(venster.human,{pageviews:10,visits:6,sampleInterval:1});
  assert.deepEqual(venster.bots,{pageviews:2,visits:1,sampleInterval:1});
  assert.equal(venster.botPageviewShare,2/12);

  await assert.rejects(
    ()=>graphql({token:"never-log-this",query:"query X{}",fetchImpl:async()=>({
      ok:true,status:200,async text(){return JSON.stringify({errors:[{message:"field bot is unavailable"}]});}
    })}),
    error=>{
      assert.match(error.message,/field bot is unavailable/);
      assert.doesNotMatch(error.message,/never-log-this/);
      return true;
    }
  );

  const md=rapportMarkdown({
    bron:"Cloudflare Web Analytics RUM",
    host:"watishetweer.nl",
    botFilter:"bot: 0",
    gegenereerd:vast.toISOString(),
    vensters:[venster]
  },"dedicated-analytics");
  assert.match(md,/Menselijke visits/);
  assert.match(md,/Bot-pageviews uitgesloten/);
  assert.match(md,/geen unieke personen/i);
  assert.match(md,/`bot: 0`/);

  console.log("cloudflare-human-analytics-report.test.js: ok");
})().catch(error=>{
  console.error(error&&error.stack||error);
  process.exit(1);
});
