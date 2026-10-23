import "server-only";
import { assertNoUserErrors, shopifyGraphql, type UserError } from "@/server/shopify/client";

// Admin GraphQL (2026-10): unique, single-use discount codes for wheel vouchers.
// Vouchers are for the NEXT order; combinations are configured per campaign.

const DISCOUNT_CODE_BASIC_CREATE = `#graphql
  mutation HussioLuckySpinVoucherCreate($basicCodeDiscount: DiscountCodeBasicInput!) {
    discountCodeBasicCreate(basicCodeDiscount: $basicCodeDiscount) {
      codeDiscountNode { id }
      userErrors { field code message }
    }
  }
`;

const DISCOUNT_CODE_FREE_SHIPPING_CREATE = `#graphql
  mutation HussioLuckySpinFreeshipCreate($freeShippingCodeDiscount: DiscountCodeFreeShippingInput!) {
    discountCodeFreeShippingCreate(freeShippingCodeDiscount: $freeShippingCodeDiscount) {
      codeDiscountNode { id }
      userErrors { field code message }
    }
  }
`;

const DISCOUNT_CODE_DEACTIVATE = `#graphql
  mutation HussioLuckySpinVoucherDeactivate($id: ID!) {
    discountCodeDeactivate(id: $id) {
      codeDiscountNode { id }
      userErrors { field code message }
    }
  }
`;

export type DiscountRequest = {
  code: string;
  title: string;
  kind: "VOUCHER" | "FREE_SHIPPING";
  /** VND amount off (VOUCHER only). */
  amount: number;
  minimumSubtotal: number | null;
  startsAt: Date;
  endsAt: Date;
  combinesWith: {
    orderDiscounts: boolean;
    productDiscounts: boolean;
    shippingDiscounts: boolean;
  };
};

type CreatePayload = { codeDiscountNode: { id: string } | null; userErrors: UserError[] };

/** Builds the mutation variables (exported for tests). */
export function buildDiscountVariables(request: DiscountRequest): Record<string, unknown> {
  const common = {
    title: request.title,
    code: request.code,
    startsAt: request.startsAt.toISOString(),
    endsAt: request.endsAt.toISOString(),
    context: { all: "ALL" },
    usageLimit: 1,
    appliesOncePerCustomer: true,
    combinesWith: request.combinesWith,
    ...(request.minimumSubtotal
      ? { minimumRequirement: { subtotal: { greaterThanOrEqualToSubtotal: String(request.minimumSubtotal) } } }
      : {}),
  };

  if (request.kind === "FREE_SHIPPING") {
    return { freeShippingCodeDiscount: { ...common, destination: { all: true } } };
  }
  return {
    basicCodeDiscount: {
      ...common,
      customerGets: {
        value: { discountAmount: { amount: String(request.amount), appliesOnEachItem: false } },
        items: { all: true },
      },
    },
  };
}

/** Creates the discount on Shopify and returns its DiscountCodeNode GID. */
export async function createShopifyDiscount(request: DiscountRequest): Promise<string> {
  const variables = buildDiscountVariables(request);
  if (request.kind === "FREE_SHIPPING") {
    const data = await shopifyGraphql<{ discountCodeFreeShippingCreate: CreatePayload }>(
      DISCOUNT_CODE_FREE_SHIPPING_CREATE,
      variables,
    );
    const payload = data.discountCodeFreeShippingCreate;
    assertNoUserErrors(payload.userErrors, "discountCodeFreeShippingCreate");
    if (!payload.codeDiscountNode) throw new Error("discountCodeFreeShippingCreate returned no node");
    return payload.codeDiscountNode.id;
  }

  const data = await shopifyGraphql<{ discountCodeBasicCreate: CreatePayload }>(
    DISCOUNT_CODE_BASIC_CREATE,
    variables,
  );
  const payload = data.discountCodeBasicCreate;
  assertNoUserErrors(payload.userErrors, "discountCodeBasicCreate");
  if (!payload.codeDiscountNode) throw new Error("discountCodeBasicCreate returned no node");
  return payload.codeDiscountNode.id;
}

export async function deactivateShopifyDiscount(discountId: string): Promise<void> {
  const data = await shopifyGraphql<{ discountCodeDeactivate: CreatePayload }>(DISCOUNT_CODE_DEACTIVATE, {
    id: discountId,
  });
  assertNoUserErrors(data.discountCodeDeactivate.userErrors, "discountCodeDeactivate");
}
