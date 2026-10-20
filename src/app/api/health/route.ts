/** Liveness check used to confirm a deployment is serving requests. */
export function GET(): Response {
  return Response.json(
    { status: "ok" },
    { headers: { "Cache-Control": "no-store" } },
  );
}
