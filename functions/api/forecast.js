import worker from "../../api/forecast.mjs";
import { metEdgeCache } from "../../lib/cloudflare-edge-cache.mjs";

export async function onRequest(context) {
  return metEdgeCache(context, "forecast", () => worker.fetch(context.request, context.env));
}
