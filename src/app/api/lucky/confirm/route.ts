import { luckyError } from "@/lib/lucky-types";
import { guardPublicPost, jsonResponse, readJsonBody, stringField } from "@/server/http";
import { sanitizeText } from "@/server/security/request";
import { confirmProductReward } from "@/server/spin";

// POST /api/lucky/confirm  { code, size, note? }  — product prizes only.
export async function POST(request: Request) {
  const blocked = await guardPublicPost(request, "confirm");
  if (blocked) return blocked;

  const body = await readJsonBody(request);
  const code = stringField(body, "code", 40);
  const size = stringField(body, "size", 8);
  const note = sanitizeText(stringField(body, "note", 300), 300);
  if (!code || !size) return jsonResponse(luckyError("VALIDATION"), 400);

  try {
    const result = await confirmProductReward({ code, size, note });
    return jsonResponse(result, result.ok ? 200 : 422);
  } catch (error) {
    console.error("[api/lucky/confirm]", error);
    return jsonResponse(luckyError("SERVER_ERROR"), 500);
  }
}
