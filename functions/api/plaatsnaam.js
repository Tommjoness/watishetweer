import worker from "../../api/plaatsnaam.mjs";

export async function onRequest(context) {
  return worker.fetch(context.request);
}
