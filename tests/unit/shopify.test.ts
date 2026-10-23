import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { buildDiscountVariables } from "@/server/shopify/discounts";
import { decideEligibility, isCodOrder, orderSubtotal, verifyShopifyHmac, type ShopifyOrderPayload } from "@/server/shopify/webhooks";

const SECRET = "webhook-secret";
const sign = (body: string) => createHmac("sha256", SECRET).update(body).digest("base64");

describe("webhook HMAC", () => {
  const body = JSON.stringify({ id: 1, name: "#1001" });

  it("accepts a correct signature", () => {
    expect(verifyShopifyHmac(body, sign(body), SECRET)).toBe(true);
  });

  it("rejects tampered bodies, wrong secrets and missing headers", () => {
    expect(verifyShopifyHmac(`${body} `, sign(body), SECRET)).toBe(false);
    expect(verifyShopifyHmac(body, sign(body), "other-secret")).toBe(false);
    expect(verifyShopifyHmac(body, null, SECRET)).toBe(false);
    expect(verifyShopifyHmac(body, "not-base64!!", SECRET)).toBe(false);
  });
});

describe("website order eligibility", () => {
  const campaign = {
    minimumOrderValue: 1_300_000,
    codEligibilityMode: "CONFIRMED_ORDER" as const,
    startsAt: new Date("2026-11-01T00:00:00+07:00"),
    ordersEndAt: new Date("2026-11-30T23:59:59+07:00"),
    endsAt: new Date("2026-12-07T23:59:59+07:00"),
    currency: "VND",
  };
  const base: ShopifyOrderPayload = {
    id: 1,
    name: "#1001",
    created_at: "2026-11-11T10:00:00+07:00",
    currency: "VND",
    subtotal_price: "1300000",
    financial_status: "paid",
    payment_gateway_names: ["VNPAY"],
    confirmed: true,
  };

  it("prepaid PAID order >= 1.300.000 gets an ACTIVE code", () => {
    expect(decideEligibility(base, campaign)).toEqual({ action: "issue", status: "ACTIVE" });
  });

  it("1.299.000 is not eligible; shipping is not counted (subtotal only)", () => {
    const order = { ...base, subtotal_price: "1299000", total_price: "1329000" } as ShopifyOrderPayload;
    expect(decideEligibility(order, campaign).action).toBe("ignore");
    expect(orderSubtotal(order)).toBe(1_299_000);
  });

  it("uses the subtotal after edits/refunds when available", () => {
    expect(orderSubtotal({ ...base, subtotal_price: "1500000", current_subtotal_price: "1200000" })).toBe(1_200_000);
  });

  it("prepaid but not yet paid waits for orders/paid", () => {
    expect(decideEligibility({ ...base, financial_status: "pending" }, campaign).action).toBe("wait");
  });

  it("COD follows codEligibilityMode", () => {
    const cod = { ...base, financial_status: "pending", payment_gateway_names: ["Cash on Delivery (COD)"] };
    expect(isCodOrder(cod)).toBe(true);
    expect(decideEligibility(cod, campaign)).toEqual({ action: "issue", status: "ACTIVE" });
    expect(decideEligibility(cod, { ...campaign, codEligibilityMode: "PAID" }).action).toBe("wait");
    expect(decideEligibility({ ...cod, financial_status: "paid" }, { ...campaign, codEligibilityMode: "PAID" })).toEqual({
      action: "issue",
      status: "ACTIVE",
    });
    expect(decideEligibility(cod, { ...campaign, codEligibilityMode: "MANUAL_APPROVAL" })).toEqual({
      action: "issue",
      status: "PENDING",
    });
  });

  it("ignores cancelled orders and orders outside the order window", () => {
    expect(decideEligibility({ ...base, cancelled_at: "2026-11-12T00:00:00Z" }, campaign).action).toBe("ignore");
    expect(decideEligibility({ ...base, created_at: "2026-10-30T10:00:00+07:00" }, campaign).action).toBe("ignore");
    expect(decideEligibility({ ...base, created_at: "2026-12-02T10:00:00+07:00" }, campaign).action).toBe("ignore");
  });
});

describe("Shopify discount payloads", () => {
  const common = {
    code: "HUSSIO-WHEEL-ABC234",
    title: "HUSSIO Lucky Spin – Voucher 100K",
    startsAt: new Date("2026-11-11T00:00:00Z"),
    endsAt: new Date("2026-12-11T00:00:00Z"),
    combinesWith: { orderDiscounts: false, productDiscounts: false, shippingDiscounts: true },
  };

  it("builds a single-use fixed-amount code with minimum subtotal", () => {
    const vars = buildDiscountVariables({ ...common, kind: "VOUCHER", amount: 100_000, minimumSubtotal: 899_000 }) as {
      basicCodeDiscount: Record<string, unknown>;
    };
    expect(vars.basicCodeDiscount).toMatchObject({
      code: "HUSSIO-WHEEL-ABC234",
      usageLimit: 1,
      appliesOncePerCustomer: true,
      context: { all: "ALL" },
      customerGets: { value: { discountAmount: { amount: "100000", appliesOnEachItem: false } }, items: { all: true } },
      minimumRequirement: { subtotal: { greaterThanOrEqualToSubtotal: "899000" } },
      combinesWith: common.combinesWith,
    });
  });

  it("builds a free-shipping code for all destinations", () => {
    const vars = buildDiscountVariables({ ...common, kind: "FREE_SHIPPING", amount: 0, minimumSubtotal: null }) as {
      freeShippingCodeDiscount: Record<string, unknown>;
    };
    expect(vars.freeShippingCodeDiscount).toMatchObject({ destination: { all: true }, usageLimit: 1 });
    expect(vars.freeShippingCodeDiscount).not.toHaveProperty("minimumRequirement");
  });
});
