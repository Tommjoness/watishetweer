"use strict";

const {haalLki}=require("./luchtmeetnet-lki.cjs");

async function handler(req,res){
  res.setHeader("Cache-Control","s-maxage=300, stale-while-revalidate=300");
  const q=req.query||{};
  const resultaat=await haalLki({lat:q.lat,lon:q.lon,land:q.land});
  return res.status(200).json(resultaat);
}

module.exports=handler;
