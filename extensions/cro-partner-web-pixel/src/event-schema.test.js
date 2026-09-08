import { describe, expect, it } from "vitest";
import {
  CRO_PARTNER_EVENT_NAMES,
  normalizeShopifyEvent,
} from "./event-schema";

const baseEvent = {
  id: "evt-1",
  timestamp: "2026-09-08T01:30:00.000Z",
  seq: 7,
  clientId: "client-1",
  context: {
    document: {
      location: {
        href: "https://example.myshopify.com/products/example",
        pathname: "/products/example",
      },
      referrer: "https://example.myshopify.com/collections/all",
      title: "Example product",
    },
  },
};

describe("CRO Partner Shopify event schema", () => {
  it("subscribes only to the four MVP events", () => {
    expect(CRO_PARTNER_EVENT_NAMES).toEqual([
      "product_viewed",
      "product_added_to_cart",
      "checkout_started",
      "checkout_completed",
    ]);
  });

  it("normalizes a product view without customer PII", () => {
    const payload = normalizeShopifyEvent(
      {
        ...baseEvent,
        name: "product_viewed",
        data: {
          productVariant: {
            id: "gid://shopify/ProductVariant/2",
            sku: "SKU-2",
            price: { amount: 25.5, currencyCode: "USD" },
            product: { id: "gid://shopify/Product/1" },
          },
        },
      },
      { sourceId: "test-store" },
    );

    expect(payload).toMatchObject({
      schemaVersion: "1.0",
      source: "shopify_web_pixel",
      sourceId: "test-store",
      eventId: "evt-1",
      eventName: "product_viewed",
      clientId: "client-1",
      page: { path: "/products/example" },
      commerce: {
        productId: "gid://shopify/Product/1",
        variantId: "gid://shopify/ProductVariant/2",
        sku: "SKU-2",
        quantity: 1,
        value: 25.5,
        currency: "USD",
      },
    });
    expect(JSON.stringify(payload)).not.toContain("email");
  });

  it("normalizes an add-to-cart event", () => {
    const payload = normalizeShopifyEvent({
      ...baseEvent,
      name: "product_added_to_cart",
      data: {
        cartLine: {
          quantity: 2,
          cost: { totalAmount: { amount: 40, currencyCode: "USD" } },
          merchandise: {
            id: "gid://shopify/ProductVariant/2",
            sku: "SKU-2",
            product: { id: "gid://shopify/Product/1" },
          },
        },
      },
    });

    expect(payload.commerce).toMatchObject({
      productId: "gid://shopify/Product/1",
      variantId: "gid://shopify/ProductVariant/2",
      quantity: 2,
      value: 40,
      currency: "USD",
    });
  });

  it.each(["checkout_started", "checkout_completed"])(
    "normalizes %s without copying buyer identity fields",
    (eventName) => {
      const payload = normalizeShopifyEvent({
        ...baseEvent,
        name: eventName,
        data: {
          checkout: {
            token: "checkout-token",
            email: "do-not-copy@example.com",
            totalPrice: { amount: 75, currencyCode: "USD" },
            lineItems: [{ quantity: 1 }, { quantity: 2 }],
            order: { id: "gid://shopify/Order/3" },
          },
        },
      });

      expect(payload.commerce).toMatchObject({
        checkoutToken: "checkout-token",
        orderId: "gid://shopify/Order/3",
        quantity: 3,
        value: 75,
        currency: "USD",
      });
      expect(JSON.stringify(payload)).not.toContain("do-not-copy@example.com");
    },
  );

  it("returns a stable nullable shape for incomplete Shopify payloads", () => {
    const payload = normalizeShopifyEvent({ name: "product_viewed" });

    expect(payload).toEqual({
      schemaVersion: "1.0",
      source: "shopify_web_pixel",
      sourceId: "cro-partner",
      eventId: null,
      eventName: "product_viewed",
      occurredAt: null,
      sequence: null,
      clientId: null,
      page: {
        url: null,
        path: null,
        referrer: null,
        title: null,
      },
      commerce: {
        productId: null,
        variantId: null,
        sku: null,
        quantity: 1,
        value: null,
        currency: null,
        checkoutToken: null,
        orderId: null,
      },
    });
  });
});
