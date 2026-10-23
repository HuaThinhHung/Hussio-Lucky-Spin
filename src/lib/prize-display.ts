// Human-readable prize texts shared by server views and admin pages.
import type { PrizeType } from "@/generated/prisma/enums";
import { formatVnd, formatVndShort } from "@/lib/format";

type PrizeLike = {
  name: string;
  type: PrizeType;
  voucherValue: number | null;
  voucherMinSpend?: number | null;
};

/** Result headline: "VOUCHER 100.000Đ", "FREESHIP ĐƠN TIẾP THEO", "01 ÁO POLO HUSSIO". */
export function prizeHeadline(prize: PrizeLike): string {
  switch (prize.type) {
    case "VOUCHER":
      return `VOUCHER ${formatVnd(prize.voucherValue ?? 0).toLocaleUpperCase("vi")}`;
    case "FREE_SHIPPING":
      return "FREESHIP ĐƠN TIẾP THEO";
    case "PRODUCT_POOL":
    default:
      return `01 ${prize.name.toLocaleUpperCase("vi")}`;
  }
}

/** Short description for the prize showcase section. */
export function prizeDescription(prize: PrizeLike): string {
  const minSpend = prize.voucherMinSpend ? ` cho đơn từ ${formatVndShort(prize.voucherMinSpend)}` : "";
  switch (prize.type) {
    case "VOUCHER":
      return `Giảm ${formatVnd(prize.voucherValue ?? 0)}${minSpend} — dùng cho đơn hàng tiếp theo.`;
    case "FREE_SHIPPING":
      return `Miễn phí vận chuyển${minSpend} cho đơn hàng tiếp theo.`;
    case "PRODUCT_POOL":
    default:
      return "Quà sản phẩm HUSSIO. Mẫu, màu và size xác nhận theo tồn kho quà tặng.";
  }
}
