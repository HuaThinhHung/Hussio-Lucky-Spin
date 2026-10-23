import { luckyError } from "@/lib/lucky-types";
import { guardPublicPost, jsonResponse, readJsonBody, stringField } from "@/server/http";
import { performSpin } from "@/server/spin";

// POST /api/lucky/spin  { code, consentFullName? }
// The prize is decided here (server-side, crypto RNG). The response only tells
// the wheel which segment to stop on.
export async function POST(request: Request) {
  const blocked = await guardPublicPost(request, "spin");
  if (blocked) return blocked;

  const body = await readJsonBody(request);
  const code = stringField(body, "code", 40);
  if (!code) return jsonResponse(luckyError("VALIDATION"), 400);

  try {
    const result = await performSpin({ code, consentFullName: body?.consentFullName === true });
    return jsonResponse(result, result.ok ? 200 : 422);
  } catch (error) {
    console.error("[api/lucky/spin]", error);
    return jsonResponse(luckyError("SERVER_ERROR"), 500);
  }
}
