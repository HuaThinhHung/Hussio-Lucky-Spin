import { randomUUID } from "node:crypto";
import { getAdminSession } from "@/server/auth/session";
import { getIssuingCampaign } from "@/server/campaign";
import { db } from "@/server/db";
import { generateLuckyCode } from "@/lib/codes";
import { jsonResponse, readJsonBody, stringField } from "@/server/http";
import { isSameOriginRequest } from "@/server/security/request";

export async function GET() {
  if (!await getAdminSession()) return jsonResponse({ error: "Cần đăng nhập" }, 401);
  const campaign = await getIssuingCampaign();
  const codes = campaign ? await db.luckyCode.findMany({ where: { campaignId: campaign.id }, orderBy: { createdAt: "desc" }, take: 2000,
    select: { id: true, code: true, status: true, orderReference: true, usedAt: true, source: true, spin: { select: { prize: { select: { name: true } } } } } }) : [];
  return jsonResponse({ codes });
}
export async function POST(request: Request) {
  const admin = await getAdminSession();
  if (!admin) return jsonResponse({ error: "Cần đăng nhập" }, 401);
  if (!isSameOriginRequest(request.headers)) return jsonResponse({ error: "Yêu cầu không hợp lệ" }, 403);
  const body = await readJsonBody(request);
  const campaign = await getIssuingCampaign();
  if (!campaign) return jsonResponse({ error: "Chưa có chương trình" }, 400);
  if (body?.action === "batch") {
    await db.$transaction(async tx => {
      await tx.$queryRaw`SELECT "id" FROM "Campaign" WHERE "id" = ${campaign.id} FOR UPDATE`;
      const count = await tx.luckyCode.count({ where: { campaignId: campaign.id, source: "simple_batch" } });
      const remaining = Math.max(0, 500 - count);
      if (remaining) await tx.luckyCode.createMany({ data: Array.from({ length: remaining }, () => ({
        code: generateLuckyCode(), campaignId: campaign.id, channel: "STORE" as const, orderReference: `RESERVED-${randomUUID()}`,
        customerName: "Khách HUSSIO", phoneHash: "", orderValue: 0, status: "PENDING" as const,
        source: "simple_batch", createdById: admin.id,
      })) });
    });
  } else if (body?.action === "issue") {
    const id = stringField(body, "id");
    const order = stringField(body, "order").trim().toUpperCase();
    if (!order) return jsonResponse({ error: "Nhập mã đơn hàng để cấp mã" }, 400);
    try {
      const result = await db.luckyCode.updateMany({ where: { id, campaignId: campaign.id, status: "PENDING", source: "simple_batch" }, data: {
        status: "ACTIVE", orderReference: order, issuedAt: new Date(),
        expiresAt: new Date(Math.min(Date.now() + campaign.codeValidityDays * 86400000, campaign.endsAt?.getTime() ?? Infinity)),
      } });
      if (!result.count) return jsonResponse({ error: "Mã đã được cấp hoặc không hợp lệ" }, 409);
    } catch { return jsonResponse({ error: "Đơn hàng này đã có mã hoặc chưa thể cấp mã. Hãy kiểm tra lại." }, 409); }
  } else return jsonResponse({ error: "Thao tác không hợp lệ" }, 400);
  return jsonResponse({ ok: true });
}
