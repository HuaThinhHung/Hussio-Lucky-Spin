import { luckyError } from "@/lib/lucky-types";
import { guardPublicPost, jsonResponse, readJsonBody, stringField } from "@/server/http";
import { validateLuckyCode } from "@/server/spin";

// POST /api/lucky/validate  { code }
export async function POST(request: Request) {
  const blocked = await guardPublicPost(request, "validate");
  if (blocked) return blocked;

  const body = await readJsonBody(request);
  const code = stringField(body, "code", 40);
  if (!code) return jsonResponse(luckyError("VALIDATION"), 400);

  try {
    const result = await validateLuckyCode({ code });
    return jsonResponse(result, result.ok ? 200 : 422);
  } catch (error) {
    console.error("[api/lucky/validate]", error);
    return jsonResponse(luckyError("SERVER_ERROR"), 500);
  }
}
