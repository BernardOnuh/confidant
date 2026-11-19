import { listRounds } from "@/src/api.mjs";
import { respond } from "@/lib/route";

export const dynamic = "force-dynamic";
export const GET = req => respond(() => listRounds(new URL(req.url).searchParams.get("limit")));
