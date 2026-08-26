import worker from "../../api/waarschuwingen.mjs";

export async function onRequest(context) {
  return worker.fetch(context.request);
}
