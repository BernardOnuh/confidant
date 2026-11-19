import { oneRound } from "@/src/api.mjs";
import { respond } from "@/lib/route";

export const dynamic = "force-dynamic";
export const GET = async (req, { params }) => respond(async () => oneRound((await params).id));
