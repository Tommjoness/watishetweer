import worker from "../../api/neerslag.mjs";
import { metEdgeCache } from "../../lib/cloudflare-edge-cache.mjs";

export async function onRequest(context) {
  return metEdgeCache(context, "neerslag", (_requestId, query) => worker.fetch(context.request, context.env, query));
}
