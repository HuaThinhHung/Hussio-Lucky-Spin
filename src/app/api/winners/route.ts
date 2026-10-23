import { jsonResponse } from "@/server/http";
import { getRecentWinners } from "@/server/winners";

// GET /api/winners — anonymised public feed (no phone, email, order or address).
export async function GET() {
  try {
    const winners = await getRecentWinners();
    return jsonResponse({ winners }, 200, { "Cache-Control": "public, max-age=0, s-maxage=15, stale-while-revalidate=30" });
  } catch (error) {
    console.error("[api/winners]", error);
    return jsonResponse({ winners: [] }, 500);
  }
}
