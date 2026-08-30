import worker from "../../api/waarschuwingen.mjs";
import { metEdgeCache } from "../../lib/cloudflare-edge-cache.mjs";

export async function onRequest(context) {
  return metEdgeCache(context, "waarschuwingen", () => worker.fetch(context.request));
}
