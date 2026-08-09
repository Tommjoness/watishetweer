export function GET(request) {
  const url = new URL(request.url);
  return Response.json({
    ok: true,
    runtime: "web-handler",
    echo: url.searchParams.get("echo") || null
  });
}
