import { tryQuestion } from "@/src/api.mjs";
import { clientIp, respond } from "@/lib/route";

export const dynamic = "force-dynamic";
// Eight models answer, some buy from Telegraph, then the truth is fetched: this can take a minute or two.
export const maxDuration = 300;

export async function POST(req) {
  const text = await req.text();
  if (text.length > 4000) return Response.json({ error: "body too large" }, { status: 413 });
  let body;
  try { body = JSON.parse(text || "{}"); } catch { return Response.json({ error: "send JSON" }, { status: 400 }); }
  return respond(() => tryQuestion(body, clientIp(req)));
}
