import { NextResponse } from "next/server";
import { withX402 } from "@x402/next";
import { advice } from "@/src/api.mjs";
import { adviceRoute, payTo, resourceServer } from "@/lib/x402";

export const dynamic = "force-dynamic";

// GET /api/advice?model=…&topic=…  Paid per call over x402 (see /api/advice/preview for a free, limited version).
async function handler(req) {
  try {
    const [status, body] = await advice(new URL(req.url).searchParams);
    return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

const paid = payTo ? withX402(handler, adviceRoute, resourceServer) : null;
export const GET = req => paid ? paid(req) : NextResponse.json({ error: "the paid API is not set up: set PAY_TO or EVM_PRIVATE_KEY" }, { status: 503 });
