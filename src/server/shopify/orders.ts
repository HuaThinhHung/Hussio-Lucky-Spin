import "server-only";
import { assertNoUserErrors, shopifyGraphql, type UserError } from "@/server/shopify/client";

// Optional order annotation (SHOPIFY_WRITE_ORDER_TAGS=true): lets CS / warehouse
// see the Lucky Spin code directly on the Shopify order.

const ORDER_TAGS_ADD = `#graphql
  mutation HussioLuckySpinTagOrder($id: ID!, $tags: [String!]!) {
    tagsAdd(id: $id, tags: $tags) {
      node { id }
      userErrors { field message }
    }
  }
`;

const ORDER_METAFIELDS_SET = `#graphql
  mutation HussioLuckySpinOrderMetafield($metafields: [MetafieldsSetInput!]!) {
    metafieldsSet(metafields: $metafields) {
      metafields { id }
      userErrors { field message }
    }
  }
`;

export const ORDER_TAG = "hussio-lucky-spin";
export const ORDER_METAFIELD = { namespace: "hussio", key: "lucky_code" } as const;

export async function annotateShopifyOrder(orderGid: string, luckyCode: string): Promise<void> {
  const tagged = await shopifyGraphql<{ tagsAdd: { userErrors: UserError[] } }>(ORDER_TAGS_ADD, {
    id: orderGid,
    tags: [ORDER_TAG],
  });
  assertNoUserErrors(tagged.tagsAdd.userErrors, "tagsAdd");

  const metafield = await shopifyGraphql<{ metafieldsSet: { userErrors: UserError[] } }>(ORDER_METAFIELDS_SET, {
    metafields: [
      {
        ownerId: orderGid,
        namespace: ORDER_METAFIELD.namespace,
        key: ORDER_METAFIELD.key,
        type: "single_line_text_field",
        value: luckyCode,
      },
    ],
  });
  assertNoUserErrors(metafield.metafieldsSet.userErrors, "metafieldsSet");
}
