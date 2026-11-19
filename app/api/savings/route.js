import { getSavings } from "@/src/api.mjs";
import { respond } from "@/lib/route";

export const dynamic = "force-dynamic";
export const GET = () => respond(getSavings);
