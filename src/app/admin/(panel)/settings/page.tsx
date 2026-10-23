import type { Metadata } from "next";
import {
  changePasswordAction,
  createAdminUserAction,
  testShopifyAction,
  toggleAdminUserAction,
} from "@/app/admin/_actions/settings";
import ActionForm from "@/components/admin/ActionForm";
import CopyButton from "@/components/admin/CopyButton";
import SubmitButton from "@/components/admin/SubmitButton";
import { Badge, Card, Field, inputClass, PageHeader, tableClass, tdClass, thClass } from "@/components/admin/ui";
import { formatDateTime } from "@/lib/format";
import { requireAdmin } from "@/server/auth/session";
import { db } from "@/server/db";
import { getShopifyConfig, shopifyAuthMode } from "@/server/shopify/client";
import { HANDLED_TOPICS } from "@/server/shopify/webhooks";

export const metadata: Metadata = { title: "Cài đặt" };

const AUTH_MODE_LABELS = {
  static_token: "Admin API access token (tĩnh)",
  client_credentials: "Client credentials (Dev Dashboard app, token tự làm mới 24h)",
  not_configured: "Chưa cấu hình — MOCK mode",
} as const;

export default async function SettingsPage() {
  const admin = await requireAdmin();
  const isAdmin = admin.role === "ADMIN";
  const config = getShopifyConfig();
  const authMode = shopifyAuthMode(config);
  const appUrl = (process.env.APP_URL ?? "").replace(/\/$/, "");
  const webhookUrl = `${appUrl || "https://quay.hussio-vn.com"}/api/webhooks/shopify`;
  const [users, recentWebhooks, recentAudit] = await Promise.all([
    isAdmin ? db.adminUser.findMany({ orderBy: { createdAt: "asc" } }) : Promise.resolve([]),
    isAdmin ? db.webhookEvent.findMany({ orderBy: { receivedAt: "desc" }, take: 10 }) : Promise.resolve([]),
    isAdmin
      ? db.adminAuditLog.findMany({ orderBy: { createdAt: "desc" }, take: 15, include: { adminUser: { select: { email: true } } } })
      : Promise.resolve([]),
  ]);

  return (
    <>
      <PageHeader title="Cài đặt" description="Tài khoản quản trị, kết nối Shopify, webhook và nhật ký thao tác." />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Đổi mật khẩu">
          <ActionForm action={changePasswordAction} resetOnSuccess className="space-y-3">
            <Field label="Mật khẩu hiện tại" htmlFor="currentPassword">
              <input id="currentPassword" name="currentPassword" type="password" autoComplete="current-password" required className={inputClass} />
            </Field>
            <Field label="Mật khẩu mới (tối thiểu 10 ký tự)" htmlFor="newPassword">
              <input id="newPassword" name="newPassword" type="password" autoComplete="new-password" minLength={10} required className={inputClass} />
            </Field>
            <SubmitButton>Đổi mật khẩu</SubmitButton>
          </ActionForm>
        </Card>

        {isAdmin ? (
          <Card title="Kết nối Shopify">
            <dl className="space-y-2 text-sm">
              <div className="flex flex-wrap justify-between gap-2">
                <dt className="text-navy/60">Store</dt>
                <dd className="font-mono">{config.shopDomain || "—"}</dd>
              </div>
              <div className="flex flex-wrap justify-between gap-2">
                <dt className="text-navy/60">API version</dt>
                <dd className="font-mono">{config.apiVersion}</dd>
              </div>
              <div className="flex flex-wrap justify-between gap-2">
                <dt className="text-navy/60">Xác thực</dt>
                <dd>
                  <Badge tone={authMode === "not_configured" ? "warning" : "success"}>{AUTH_MODE_LABELS[authMode]}</Badge>
                </dd>
              </div>
              <div className="flex flex-wrap justify-between gap-2">
                <dt className="text-navy/60">Webhook secret</dt>
                <dd>{config.webhookSecret ? <Badge tone="success">Đã cấu hình</Badge> : <Badge tone="warning">Chưa có</Badge>}</dd>
              </div>
              <div className="flex flex-wrap justify-between gap-2">
                <dt className="text-navy/60">Gắn tag + metafield vào đơn</dt>
                <dd>{config.writeOrderTags ? "Bật" : "Tắt"}</dd>
              </div>
            </dl>
            <div className="mt-4 rounded-xl bg-navy/[0.04] p-3 text-xs">
              <p className="font-semibold text-navy/80">Webhook URL (JSON, API {config.apiVersion})</p>
              <p className="mt-1 break-all font-mono">{webhookUrl}</p>
              <p className="mt-2 text-navy/60">Topics: {HANDLED_TOPICS.join(", ")}</p>
              <div className="mt-2">
                <CopyButton text={webhookUrl} label="Copy URL" />
              </div>
            </div>
            <ActionForm action={testShopifyAction} className="mt-4">
              <SubmitButton variant="secondary" pendingLabel="Đang kiểm tra…">
                Kiểm tra kết nối (chỉ đọc)
              </SubmitButton>
            </ActionForm>
            <p className="mt-3 text-xs text-navy/55">
              Thông tin đăng nhập Shopify đặt trong biến môi trường (Vercel), không lưu trong database và không gửi ra trình duyệt.
            </p>
          </Card>
        ) : null}
      </div>

      {isAdmin ? (
        <>
          <Card title="Tài khoản quản trị" className="mt-6">
            <div className="overflow-x-auto">
              <table className={tableClass}>
                <thead>
                  <tr>
                    <th className={thClass}>Email</th>
                    <th className={thClass}>Tên</th>
                    <th className={thClass}>Quyền</th>
                    <th className={thClass}>Đăng nhập gần nhất</th>
                    <th className={thClass}>Trạng thái</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-navy/5">
                  {users.map((user) => (
                    <tr key={user.id}>
                      <td className={tdClass}>{user.email}</td>
                      <td className={tdClass}>{user.name}</td>
                      <td className={tdClass}>{user.role}</td>
                      <td className={tdClass}>{user.lastLoginAt ? formatDateTime(user.lastLoginAt) : "—"}</td>
                      <td className={tdClass}>
                        {user.id === admin.id ? (
                          <Badge tone="gold">Bạn</Badge>
                        ) : (
                          <ActionForm action={toggleAdminUserAction} quietSuccess>
                            <input type="hidden" name="id" value={user.id} />
                            <SubmitButton size="sm" variant={user.active ? "danger" : "secondary"}>
                              {user.active ? "Khoá" : "Mở khoá"}
                            </SubmitButton>
                          </ActionForm>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <ActionForm action={createAdminUserAction} resetOnSuccess className="mt-6 grid gap-3 border-t border-navy/10 pt-5 sm:grid-cols-2 lg:grid-cols-5 lg:items-end">
              <Field label="Email" htmlFor="new-email">
                <input id="new-email" name="email" type="email" required className={inputClass} />
              </Field>
              <Field label="Tên" htmlFor="new-name">
                <input id="new-name" name="name" required className={inputClass} />
              </Field>
              <Field label="Quyền" htmlFor="new-role">
                <select id="new-role" name="role" defaultValue="STAFF" className={inputClass}>
                  <option value="STAFF">STAFF — tạo mã, trao quà</option>
                  <option value="ADMIN">ADMIN — toàn quyền</option>
                </select>
              </Field>
              <Field label="Mật khẩu tạm" htmlFor="new-password">
                <input id="new-password" name="password" type="password" minLength={10} autoComplete="new-password" required className={inputClass} />
              </Field>
              <SubmitButton>Thêm tài khoản</SubmitButton>
            </ActionForm>
          </Card>

          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <Card title="Webhook gần đây">
              {recentWebhooks.length === 0 ? (
                <p className="text-sm text-navy/60">Chưa nhận webhook nào.</p>
              ) : (
                <ul className="space-y-2 text-xs">
                  {recentWebhooks.map((event) => (
                    <li key={event.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-navy/5 pb-2">
                      <span className="font-mono">{event.topic}</span>
                      <Badge tone={event.status === "FAILED" ? "danger" : event.status === "PROCESSED" ? "success" : "neutral"}>{event.status}</Badge>
                      <span className="w-full text-navy/55">
                        {formatDateTime(event.receivedAt)} · {event.note ?? ""}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
            <Card title="Nhật ký thao tác (audit log)">
              <ul className="space-y-2 text-xs">
                {recentAudit.map((entry) => (
                  <li key={entry.id} className="border-b border-navy/5 pb-2">
                    <span className="font-mono font-semibold">{entry.action}</span> · {entry.adminUser?.email ?? "system"}
                    <span className="block text-navy/55">{formatDateTime(entry.createdAt)}</span>
                  </li>
                ))}
              </ul>
            </Card>
          </div>
        </>
      ) : null}
    </>
  );
}
