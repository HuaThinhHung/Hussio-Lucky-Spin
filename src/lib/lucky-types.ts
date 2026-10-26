// Public API contracts between the customer UI and the server.
// Client-safe: no server imports here.
import type { PrizeType, VoucherStatus, WinnerStatus } from "@/generated/prisma/enums";

export type LuckyErrorCode =
  | "VALIDATION"
  | "INVALID_CODE"
  | "PHONE_MISMATCH"
  | "USED"
  | "EXPIRED"
  | "CANCELLED"
  | "PENDING_APPROVAL"
  | "LOCKED"
  | "CAMPAIGN_NOT_STARTED"
  | "CAMPAIGN_PAUSED"
  | "CAMPAIGN_ENDED"
  | "NO_PRIZES"
  | "NOT_PRODUCT_PRIZE"
  | "REWARD_LOCKED"
  | "SIZE_UNAVAILABLE"
  | "ORDER_SHIPPED"
  | "RATE_LIMITED"
  | "NETWORK"
  | "SERVER_ERROR";

export const LUCKY_ERROR_MESSAGES: Record<LuckyErrorCode, string> = {
  VALIDATION: "Vui lòng nhập đúng mã quay được HUSSIO cấp.",
  INVALID_CODE: "Mã Lucky Spin không hợp lệ.",
  PHONE_MISMATCH: "Số điện thoại chưa khớp với mã Lucky Spin.",
  USED: "Mã này đã được sử dụng.",
  EXPIRED: "Mã quay đã hết hạn.",
  CANCELLED: "Mã quay đã bị huỷ do đơn hàng không còn hợp lệ. Vui lòng liên hệ HUSSIO.",
  PENDING_APPROVAL: "Mã quay đang chờ HUSSIO xác nhận đơn hàng. Vui lòng thử lại sau.",
  LOCKED: "Mã tạm khoá do nhập sai nhiều lần. Vui lòng thử lại sau 30 phút hoặc liên hệ HUSSIO.",
  CAMPAIGN_NOT_STARTED: "Chương trình chưa bắt đầu. Vui lòng quay lại sau.",
  CAMPAIGN_PAUSED: "Chương trình đang tạm dừng. Vui lòng quay lại sau.",
  CAMPAIGN_ENDED: "Chương trình đã kết thúc.",
  NO_PRIZES: "Quỹ quà hiện đã hết. Vui lòng liên hệ HUSSIO.",
  NOT_PRODUCT_PRIZE: "Phần thưởng này không cần chọn kích thước.",
  REWARD_LOCKED: "Phần thưởng đã được HUSSIO xử lý, không thể thay đổi thông tin.",
  SIZE_UNAVAILABLE: "Size này hiện đã hết trong kho quà. Vui lòng chọn size khác.",
  ORDER_SHIPPED: "Đơn hàng đã được giao cho đơn vị vận chuyển. Vui lòng nhắn HUSSIO để được hỗ trợ.",
  RATE_LIMITED: "Bạn thao tác quá nhanh. Vui lòng thử lại sau ít phút.",
  NETWORK: "Không thể kết nối. Vui lòng thử lại.",
  SERVER_ERROR: "Có lỗi xảy ra. Vui lòng thử lại hoặc liên hệ HUSSIO.",
};

export type LuckyError = { ok: false; error: LuckyErrorCode; message: string };

export function luckyError(error: LuckyErrorCode): LuckyError {
  return { ok: false, error, message: LUCKY_ERROR_MESSAGES[error] };
}

export type VoucherView = {
  code: string;
  type: Extract<PrizeType, "VOUCHER" | "FREE_SHIPPING">;
  value: number;
  minimumSpend: number | null;
  expiresAt: string;
  status: VoucherStatus;
};

export type ProductRewardView = {
  /** Sizes the customer may pick (only in-stock sizes when stock-by-size is known). */
  sizeOptions: string[];
  /** True when gift items carry sizes, so options reflect real stock. */
  sizeStockKnown: boolean;
  sizePreference: string | null;
  customerConfirmed: boolean;
};

export type SpinResultView = {
  spinId: string;
  prizeId: string;
  prizeName: string;
  /** e.g. "VOUCHER 100.000Đ" or "01 ÁO POLO HUSSIO" */
  prizeHeadline: string;
  prizeType: PrizeType;
  segmentIndex: number;
  segmentCount: number;
  spunAt: string;
  rewardStatus: WinnerStatus;
  rewardStatusLabel: string;
  voucher: VoucherView | null;
  product: ProductRewardView | null;
  /** Website flow: the Shopify order the spin belongs to, e.g. "#1284". */
  orderName?: string;
  /** Website flow: the exact item reserved for the order. */
  gift?: WebGiftView | null;
};

export type WebGiftView = {
  name: string;
  size: string;
  color: string;
  sku: string;
  /** False when the order had already shipped: CS sends the gift separately. */
  packWithOrder: boolean;
};

/** One gift on the website wheel, as listed in the Sheet (WEB_GIFT_LIMITS order). */
export type CatalogGift = {
  id: string;
  name: string;
  /** "top" = áo/polo/khoác/sơ mi, "pants" = quần, "any" = no size needed. */
  group: "top" | "pants" | "any";
  /** Sizes with stock left right now. */
  sizes: string[];
  available: boolean;
};

export type CatalogResponse =
  | { ok: true; open: boolean; contactUrl: string; gifts: CatalogGift[] }
  | LuckyError;

export type ValidateResponse =
  | {
      ok: true;
      state: "READY";
      customerName: string;
      spinsAvailable: number;
      expiresAt: string | null;
      askNameConsent: boolean;
    }
  | { ok: true; state: "ALREADY_SPUN"; result: SpinResultView }
  | LuckyError;

export type SpinResponse =
  | { ok: true; repeated: boolean; result: SpinResultView }
  | LuckyError;

export type ConfirmRewardResponse = { ok: true; result: SpinResultView } | LuckyError;

export type WheelSegmentView = {
  sizeLabel?: string;
  disabled?: boolean;
  id: string;
  name: string;
  label: string;
  caption: string | null;
  type: PrizeType;
};

export type PublicWinner = {
  id: string;
  displayName: string;
  city: string | null;
  prizeName: string;
  prizeType: PrizeType;
  createdAt: string;
};

export type PrizeShowcaseItem = {
  id: string;
  name: string;
  type: PrizeType;
  description: string;
  available: boolean;
};
