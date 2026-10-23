import type { Metadata } from "next";
import { Card, EmptyState, inputClass, PageHeader, StatCard, tableClass, tdClass, thClass } from "@/components/admin/ui";
import { ANALYTICS_EVENTS, CHANNEL_LABELS } from "@/lib/constants";
import { formatPercent } from "@/lib/format";
import { getAnalytics, getPrizeDistribution } from "@/server/admin/reports";
import { requireAdmin } from "@/server/auth/session";
import { getPublicCampaign } from "@/server/campaign";
import { db } from "@/server/db";

export const metadata: Metadata = { title: "Analytics" };

const RANGES = [7, 30, 90] as const;
const EVENT_LABELS: Record<(typeof ANALYTICS_EVENTS)[number], string> = {
  code_issued: "Mã phát ra",
  code_validated: "Nhập mã hợp lệ",
  spin_started: "Bắt đầu quay",
  spin_completed: "Quay xong",
  prize_won: "Trúng quà",
  voucher_copied: "Copy voucher",
  shop_now_clicked: "Bấm mua sắm",
};

export default async function AnalyticsPage({ searchParams }: PageProps<"/admin/analytics">) {
  await requireAdmin();
  const params = await searchParams;
  const days = RANGES.find((range) => String(range) === params.days) ?? 30;
  const campaigns = await db.campaign.findMany({ orderBy: { createdAt: "desc" }, select: { id: true, name: true } });
  const selected = campaigns.find((c) => c.id === params.campaign) ?? (await getPublicCampaign());
  if (!selected) return <EmptyState>Chưa có chương trình.</EmptyState>;

  const [analytics, distribution] = await Promise.all([getAnalytics(selected.id, days), getPrizeDistribution(selected.id)]);
  const { totals } = analytics;
  const validateToSpin = totals.code_validated ? totals.spin_completed / totals.code_validated : 0;
  const issuedToSpin = totals.code_issued ? totals.spin_completed / totals.code_issued : 0;
  const maxDaily = Math.max(1, ...analytics.daily.map((row) => row.counts.spin_completed ?? 0));

  return (
    <>
      <PageHeader title="Analytics" description="Sự kiện lưu trực tiếp trong database (không phụ thuộc GA4)." />

      <form className="mb-6 grid gap-2 sm:grid-cols-[2fr_1fr_auto]">
        <select name="campaign" defaultValue={selected.id} aria-label="Chương trình" className={inputClass}>
          {campaigns.map((campaign) => (
            <option key={campaign.id} value={campaign.id}>
              {campaign.name}
            </option>
          ))}
        </select>
        <select name="days" defaultValue={String(days)} aria-label="Khoảng thời gian" className={inputClass}>
          {RANGES.map((range) => (
            <option key={range} value={range}>
              {range} ngày gần nhất
            </option>
          ))}
        </select>
        <button type="submit" className="h-10 rounded-lg bg-navy px-4 text-sm font-semibold text-ivory">
          Xem
        </button>
      </form>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
        {ANALYTICS_EVENTS.map((name) => (
          <StatCard key={name} label={EVENT_LABELS[name]} value={(totals[name] ?? 0).toLocaleString("vi-VN")} hint={name} />
        ))}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Mã phát → quay" value={formatPercent(issuedToSpin)} />
        <StatCard label="Nhập mã → quay" value={formatPercent(validateToSpin)} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card title="Theo kênh">
          <table className={tableClass}>
            <thead>
              <tr>
                <th className={thClass}>Kênh</th>
                <th className={thClass}>Mã phát</th>
                <th className={thClass}>Đã quay</th>
                <th className={thClass}>Tỷ lệ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-navy/5">
              {(Object.keys(analytics.byChannel) as (keyof typeof analytics.byChannel)[]).map((channel) => {
                const row = analytics.byChannel[channel];
                return (
                  <tr key={channel}>
                    <td className={tdClass}>{CHANNEL_LABELS[channel]}</td>
                    <td className={tdClass}>{row.issued}</td>
                    <td className={tdClass}>{row.spun}</td>
                    <td className={tdClass}>{formatPercent(row.issued ? row.spun / row.issued : 0)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>

        <Card title="Theo giải thưởng (toàn chương trình)">
          <table className={tableClass}>
            <thead>
              <tr>
                <th className={thClass}>Giải</th>
                <th className={thClass}>Cấu hình</th>
                <th className={thClass}>Thực tế</th>
                <th className={thClass}>Số lượt</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-navy/5">
              {distribution.map((row) => (
                <tr key={row.prizeId}>
                  <td className={tdClass}>{row.name}</td>
                  <td className={tdClass}>{formatPercent(row.configuredShare)}</td>
                  <td className={tdClass}>{formatPercent(row.actualShare)}</td>
                  <td className={tdClass}>{row.won}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>

      <Card title="Theo ngày" className="mt-6">
        {analytics.daily.length === 0 ? (
          <p className="text-sm text-navy/60">Chưa có dữ liệu trong khoảng thời gian này.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className={tableClass}>
              <thead>
                <tr>
                  <th className={thClass}>Ngày</th>
                  {ANALYTICS_EVENTS.map((name) => (
                    <th key={name} className={thClass}>
                      {EVENT_LABELS[name]}
                    </th>
                  ))}
                  <th className={thClass}>Lượt quay</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-navy/5">
                {analytics.daily.map((row) => (
                  <tr key={row.day}>
                    <td className={tdClass}>{row.day.split("-").reverse().join("/")}</td>
                    {ANALYTICS_EVENTS.map((name) => (
                      <td key={name} className={tdClass}>
                        {row.counts[name] ?? 0}
                      </td>
                    ))}
                    <td className={`${tdClass} w-40`}>
                      <div className="h-2 rounded-full bg-navy/10">
                        <div className="h-2 rounded-full bg-gold" style={{ width: `${Math.round(((row.counts.spin_completed ?? 0) / maxDaily) * 100)}%` }} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
