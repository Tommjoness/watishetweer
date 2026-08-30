import worker from "../../api/neerslag.mjs";
import { metEdgeCache } from "../../lib/cloudflare-edge-cache.mjs";

export async function onRequest(context) {
  return metEdgeCache(context, "neerslag", () => worker.fetch(context.request));
}
