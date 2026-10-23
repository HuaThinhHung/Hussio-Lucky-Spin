import type { Prisma } from "@/generated/prisma/client";
import type { Channel, LuckyCodeStatus } from "@/generated/prisma/enums";
import { CHANNEL_LABELS, CODE_STATUS_LABELS } from "@/lib/constants";
import { getAdminSession } from "@/server/auth/session";
import { db } from "@/server/db";
import { logAudit } from "@/server/audit";

const MAX_ROWS = 20_000;

/** Prevents CSV/formula injection when the file is opened in Excel / Sheets. */
function csvCell(value: string | number | null | undefined): string {
  let text = value === null || value === undefined ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

// GET /admin/codes/export?status=&channel=  (admin session required)
export async function GET(request: Request) {
  const admin = await getAdminSession();
  if (!admin) return new Response("Unauthorized", { status: 401 });

  const url = new URL(request.url);
  const status = (Object.keys(CODE_STATUS_LABELS) as LuckyCodeStatus[]).find((s) => s === url.searchParams.get("status"));
  const channel = (Object.keys(CHANNEL_LABELS) as Channel[]).find((c) => c === url.searchParams.get("channel"));
  const where: Prisma.LuckyCodeWhereInput = { ...(status ? { status } : {}), ...(channel ? { channel } : {}) };

  const codes = await db.luckyCode.findMany({
    where,
    orderBy: { issuedAt: "desc" },
    take: MAX_ROWS,
    include: { spin: { select: { prize: { select: { name: true } } } } },
  });

  const header = ["code", "channel", "order_reference", "customer_name", "phone_last3", "order_value", "status", "issued_at", "expires_at", "used_at", "prize"];
  const lines = codes.map((code) =>
    [
      code.code,
      code.channel,
      code.orderReference,
      code.customerName,
      code.phoneHint,
      code.orderValue,
      code.status,
      code.issuedAt.toISOString(),
      code.expiresAt?.toISOString(),
      code.usedAt?.toISOString(),
      code.spin?.prize.name,
    ]
      .map(csvCell)
      .join(","),
  );

  await logAudit({ adminUserId: admin.id, action: "code.export", entityType: "LuckyCode", details: { rows: codes.length } });

  return new Response(`﻿${header.join(",")}\n${lines.join("\n")}\n`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="hussio-lucky-codes-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
