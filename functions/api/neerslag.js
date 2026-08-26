import worker from "../../api/neerslag.mjs";

export async function onRequest(context) {
  return worker.fetch(context.request);
}
