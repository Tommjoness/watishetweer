import worker from "../../api/waarschuwingen.mjs";
import { metEdgeCache } from "../../lib/cloudflare-edge-cache.mjs";

export async function onRequest(context) {
  return metEdgeCache(context, "waarschuwingen", (_requestId, query) => worker.fetch(context.request, context.env, context, query));
}
