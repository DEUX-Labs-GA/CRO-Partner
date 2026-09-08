export const CRO_PARTNER_EVENT_NAMES = Object.freeze([
  "product_viewed",
  "product_added_to_cart",
  "checkout_started",
  "checkout_completed",
]);

export const CRO_PARTNER_EVENT_SCHEMA_VERSION = "1.0";

export function normalizeShopifyEvent(event, options = {}) {
  const location = event?.context?.document?.location;
  const documentContext = event?.context?.document;
  const commerce = readCommerceContext(event);

  return {
    schemaVersion: CRO_PARTNER_EVENT_SCHEMA_VERSION,
    source: "shopify_web_pixel",
    sourceId: options.sourceId ?? "cro-partner",
    eventId: event?.id ?? null,
    eventName: event?.name ?? null,
    occurredAt: event?.timestamp ?? null,
    sequence: event?.seq ?? null,
    clientId: event?.clientId ?? null,
    page: {
      url: location?.href ?? null,
      path: location?.pathname ?? null,
      referrer: documentContext?.referrer ?? null,
      title: documentContext?.title ?? null,
    },
    commerce,
  };
}

function readCommerceContext(event) {
  const eventName = event?.name;

  if (eventName === "product_viewed") {
    return readProductViewed(event?.data);
  }

  if (eventName === "product_added_to_cart") {
    return readProductAddedToCart(event?.data);
  }

  if (eventName === "checkout_started" || eventName === "checkout_completed") {
    return readCheckout(event?.data?.checkout);
  }

  return emptyCommerceContext();
}

function readProductViewed(data) {
  const variant = data?.productVariant;

  return {
    ...emptyCommerceContext(),
    productId: variant?.product?.id ?? null,
    variantId: variant?.id ?? null,
    sku: variant?.sku ?? null,
    quantity: 1,
    value: toNumber(variant?.price?.amount),
    currency: variant?.price?.currencyCode ?? null,
  };
}

function readProductAddedToCart(data) {
  const cartLine = data?.cartLine;
  const variant = cartLine?.merchandise;
  const totalAmount = cartLine?.cost?.totalAmount;

  return {
    ...emptyCommerceContext(),
    productId: variant?.product?.id ?? null,
    variantId: variant?.id ?? null,
    sku: variant?.sku ?? null,
    quantity: toNumber(cartLine?.quantity),
    value: toNumber(totalAmount?.amount ?? variant?.price?.amount),
    currency:
      totalAmount?.currencyCode ?? variant?.price?.currencyCode ?? null,
  };
}

function readCheckout(checkout) {
  const totalPrice = checkout?.totalPrice;

  return {
    ...emptyCommerceContext(),
    checkoutToken: checkout?.token ?? null,
    orderId: checkout?.order?.id ?? null,
    quantity: Array.isArray(checkout?.lineItems)
      ? checkout.lineItems.reduce(
          (total, lineItem) => total + (toNumber(lineItem?.quantity) ?? 0),
          0,
        )
      : null,
    value: toNumber(totalPrice?.amount),
    currency: totalPrice?.currencyCode ?? null,
  };
}

function emptyCommerceContext() {
  return {
    productId: null,
    variantId: null,
    sku: null,
    quantity: null,
    value: null,
    currency: null,
    checkoutToken: null,
    orderId: null,
  };
}

function toNumber(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}
