// Turns a [status, body] pair from src/api.mjs into a JSON response that is never cached.
export async function respond(work) {
  try {
    const [status, body] = await work();
    return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    console.error(e);
    return Response.json({ error: e.message }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}

// The visitor's address as the host's proxy reports it.
export const clientIp = req => (req.headers.get("x-real-ip") || req.headers.get("x-forwarded-for") || "local").split(",")[0].trim();
