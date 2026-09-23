import worker from "../../api/luchtkwaliteit.mjs";
import { metEdgeCache } from "../../lib/cloudflare-edge-cache.mjs";

export async function onRequest(context) {
  return metEdgeCache(context, "luchtkwaliteit", () => worker.fetch(context.request));
}
