import worker from "../../api/plaatsnaam.mjs";
import { metEdgeCache } from "../../lib/cloudflare-edge-cache.mjs";

export async function onRequest(context) {
  return metEdgeCache(context, "plaatsnaam", (_requestId, query) => worker.fetch(context.request, query));
}
