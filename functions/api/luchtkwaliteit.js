import worker from "../../api/luchtkwaliteit.mjs";

export async function onRequest(context){
  return worker.fetch(context.request);
}
