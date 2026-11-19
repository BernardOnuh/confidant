import { advicePreview } from "@/src/api.mjs";
import { clientIp, respond } from "@/lib/route";

export const dynamic = "force-dynamic";
export const GET = req => respond(() => advicePreview(new URL(req.url).searchParams, clientIp(req)));
