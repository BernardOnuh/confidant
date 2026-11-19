import { startTry } from "@/src/api.mjs";
import { clientIp } from "@/lib/route";

export const dynamic = "force-dynamic";
// Eight models answer, some buy from Telegraph, then the truth is fetched: this can take a minute or two.
export const maxDuration = 300;

// Streams the question as it runs: one JSON event per line, as each model answers, buys and is graded.
export async function POST(req) {
  const text = await req.text();
  if (text.length > 4000) return Response.json({ error: "body too large" }, { status: 413 });
  let body;
  try { body = JSON.parse(text || "{}"); } catch { return Response.json({ error: "send JSON" }, { status: 400 }); }
  try {
    const r = await startTry(body, clientIp(req));
    if (r.error) return Response.json(r.error[1], { status: r.error[0], headers: { "Cache-Control": "no-store" } });
    return new Response(r.stream, { headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store", "X-Accel-Buffering": "no" } });
  } catch (e) {
    console.error(e);
    return Response.json({ error: e.message }, { status: 500 });
  }
}
