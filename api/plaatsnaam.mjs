import legacyHandler from "../lib/plaatsnaam.cjs";

export const config = { useWebApi: true };

export default async function handler(request) {
  const url = new URL(request.url);
  const query = Object.fromEntries(url.searchParams.entries());
  let statusCode = 200;
  let body = null;
  const headers = new Headers();
  const response = {
    setHeader(name, value) {
      headers.set(name, String(value));
    },
    status(code) {
      statusCode = Number(code);
      return response;
    },
    json(value) {
      body = value;
      return response;
    }
  };

  await legacyHandler({ query }, response);
  return Response.json(body, { status: statusCode, headers });
}
