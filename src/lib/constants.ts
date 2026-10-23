// Shared constants (safe for both server and client bundles).
import type { Channel, GiftCategory, LuckyCodeStatus, PrizeType, WinnerStatus } from "@/generated/prisma/enums";

export const BRAND = {
  name: "HUSSIO",
  programName: "HUSSIO LUCKY SPIN",
  programSubtitle: "VÒNG QUAY MAY MẮN BLACK FRIDAY 2026",
  campaignBadge: "BLACK FRIDAY 2026",
  siteHost: "quay.hussio-vn.com",
  siteUrl: "https://quay.hussio-vn.com",
} as const;

export const DEFAULT_SHOP_URL = "https://hussio.com";

export const SIZE_OPTIONS = ["M", "L", "XL", "XXL"] as const;
export type SizeOption = (typeof SIZE_OPTIONS)[number];

/** Wrong phone attempts before a code is temporarily locked. */
export const MAX_FAILED_PHONE_ATTEMPTS = 5;
export const CODE_LOCK_MINUTES = 30;

export const RECENT_WINNERS_LIMIT = 12;

export const CHANNEL_LABELS: Record<Channel, string> = {
  SHOPIFY_WEB: "Website",
  FACEBOOK: "Facebook",
  STORE: "Cửa hàng",
};

export const CODE_STATUS_LABELS: Record<LuckyCodeStatus, string> = {
  PENDING: "Chờ duyệt",
  ACTIVE: "Chưa quay",
  USED: "Đã quay",
  CANCELLED: "Đã huỷ",
  EXPIRED: "Hết hạn",
};

export const WINNER_STATUS_LABELS: Record<WinnerStatus, string> = {
  WON: "Đã trúng",
  CONFIRMED: "Đã xác nhận",
  FULFILLED: "Đã trao quà",
  VOID: "Đã huỷ",
};

export const PRIZE_TYPE_LABELS: Record<PrizeType, string> = {
  VOUCHER: "Voucher",
  FREE_SHIPPING: "Freeship",
  PRODUCT_POOL: "Quà sản phẩm",
};

export const GIFT_CATEGORY_LABELS: Record<GiftCategory, string> = {
  POLO: "Áo Polo",
  TSHIRT: "Áo thun",
  SHIRT: "Sơ mi",
  JACKET: "Áo khoác",
  PANTS: "Quần dài",
  OTHER: "Khác",
};

/** Analytics events stored in the database (no GA4 dependency). */
export const ANALYTICS_EVENTS = [
  "code_issued",
  "code_validated",
  "spin_started",
  "spin_completed",
  "prize_won",
  "voucher_copied",
  "shop_now_clicked",
] as const;
export type AnalyticsEventName = (typeof ANALYTICS_EVENTS)[number];

/** Events the browser is allowed to send to /api/events. */
export const CLIENT_ANALYTICS_EVENTS = ["voucher_copied", "shop_now_clicked"] as const;
export type ClientAnalyticsEventName = (typeof CLIENT_ANALYTICS_EVENTS)[number];

export const DEFAULT_TERMS = [
  "Áp dụng cho đơn hàng HUSSIO có giá trị từ 1.300.000đ.",
  "Mỗi đơn đủ điều kiện nhận 01 mã Lucky Spin.",
  "Mỗi mã chỉ được sử dụng một lần.",
  "Mã không được chuyển đổi thành tiền mặt.",
  "Quà sản phẩm phụ thuộc vào tồn kho, màu và kích thước thực tế.",
  "Voucher áp dụng cho đơn hàng tiếp theo theo điều kiện hiển thị trên voucher.",
  "Đơn hàng bị huỷ hoặc hoàn toàn bộ có thể làm mất hiệu lực phần thưởng.",
  "HUSSIO có quyền từ chối mã có dấu hiệu gian lận.",
  "Chương trình kết thúc khi hết thời gian hoặc hết quỹ quà.",
].join("\n");

/** Facebook / Zalo customer-service message (section 46 of the brief). */
export function buildCustomerMessage(luckyCode: string, siteUrl: string = BRAND.siteUrl): string {
  return [
    "Cảm ơn bạn đã mua sắm tại HUSSIO 🎁",
    "",
    "Đơn hàng của bạn đã đủ điều kiện tham gia HUSSIO Lucky Spin.",
    "",
    "Mã quay của bạn:",
    luckyCode,
    "",
    "Truy cập:",
    siteUrl,
    "",
    "Nhập mã cùng số điện thoại mua hàng để quay và nhận quà.",
    "",
    "Mỗi mã chỉ được sử dụng 01 lần.",
    "",
    "Chúc bạn may mắn! ✨",
  ].join("\n");
}
