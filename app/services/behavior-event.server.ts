import prisma from "../db.server";

const SUPPORTED_EVENTS = new Set([
  "product_viewed",
  "product_added_to_cart",
  "checkout_started",
  "checkout_completed",
]);

const MAX_EVENT_ID_LENGTH = 255;
const MAX_CLIENT_ID_LENGTH = 255;
const MAX_SOURCE_ID_LENGTH = 100;
const MAX_SHOP_LENGTH = 255;
const MAX_URL_LENGTH = 2048;
const MAX_TEXT_LENGTH = 500;
const MAX_IDENTIFIER_LENGTH = 255;

type IncomingBehaviorEvent = {
  schemaVersion?: unknown;
  source?: unknown;
  sourceId?: unknown;
  eventId?: unknown;
  eventName?: unknown;
  occurredAt?: unknown;
  sequence?: unknown;
  clientId?: unknown;
  shop?: unknown;
  page?: {
    url?: unknown;
    path?: unknown;
    referrer?: unknown;
    title?: unknown;
  };
  commerce?: {
    productId?: unknown;
    variantId?: unknown;
    sku?: unknown;
    quantity?: unknown;
    value?: unknown;
    currency?: unknown;
    checkoutToken?: unknown;
    orderId?: unknown;
  };
};

export function validateBehaviorEvent(input: IncomingBehaviorEvent) {
  if (!input || typeof input !== "object") {
    throw new Error("Invalid payload.");
  }

  if (
    typeof input.shop !== "string" ||
    input.shop.length < 1 ||
    input.shop.length > MAX_SHOP_LENGTH ||
    !input.shop.endsWith(".myshopify.com")
  ) {
    throw new Error("Invalid shop.");
  }

  if (
    typeof input.eventId !== "string" ||
    input.eventId.length < 1 ||
    input.eventId.length > MAX_EVENT_ID_LENGTH
  ) {
    throw new Error("Invalid eventId.");
  }

  if (
    typeof input.eventName !== "string" ||
    !SUPPORTED_EVENTS.has(input.eventName)
  ) {
    throw new Error("Unsupported eventName.");
  }

  if (input.schemaVersion !== "1.0") {
    throw new Error("Unsupported schemaVersion.");
  }

  if (input.source !== "shopify_web_pixel") {
    throw new Error("Invalid event source.");
  }

  const occurredAt =
    typeof input.occurredAt === "string"
      ? new Date(input.occurredAt)
      : null;

  if (!occurredAt || Number.isNaN(occurredAt.getTime())) {
    throw new Error("Invalid occurredAt.");
  }

  return {
    shop: input.shop,
    eventId: input.eventId,
    eventName: input.eventName,
    schemaVersion: "1.0",
    source: "shopify_web_pixel",
    sourceId: asString(input.sourceId, MAX_SOURCE_ID_LENGTH),
    occurredAt,
    sequence: asInteger(input.sequence),
    clientId: asString(input.clientId, MAX_CLIENT_ID_LENGTH),
    pageUrl: asString(input.page?.url, MAX_URL_LENGTH),
    pagePath: asString(input.page?.path, MAX_URL_LENGTH),
    pageReferrer: asString(input.page?.referrer, MAX_URL_LENGTH),
    pageTitle: asString(input.page?.title, MAX_TEXT_LENGTH),
    productId: asString(input.commerce?.productId, MAX_IDENTIFIER_LENGTH),
    variantId: asString(input.commerce?.variantId, MAX_IDENTIFIER_LENGTH),
    sku: asString(input.commerce?.sku, MAX_IDENTIFIER_LENGTH),
    quantity: asNumber(input.commerce?.quantity),
    value: asNumber(input.commerce?.value),
    currency: asString(input.commerce?.currency, 10),
    checkoutToken: asString(
      input.commerce?.checkoutToken,
      MAX_IDENTIFIER_LENGTH,
    ),
    orderId: asString(input.commerce?.orderId, MAX_IDENTIFIER_LENGTH),
  };
}

export async function persistBehaviorEvent(input: IncomingBehaviorEvent) {
  const event = validateBehaviorEvent(input);

  // Only accept events for a shop that has authenticated with this app.
  const installedShop = await prisma.session.findFirst({
    where: {
      shop: event.shop,
    },
    select: {
      id: true,
    },
  });

  if (!installedShop) {
    throw new Error("Unknown shop.");
  }

  try {
    const created = await prisma.behaviorEvent.create({
      data: event,
    });

    return {
      status: "created" as const,
      event: created,
    };
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "P2002"
    ) {
      return {
        status: "duplicate" as const,
        event: null,
      };
    }

    throw error;
  }
}

function asString(value: unknown, maxLength: number): string | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  if (
    typeof value !== "string" ||
    value.length > maxLength
  ) {
    throw new Error("Invalid string value.");
  }

  return value;
}

function asNumber(value: unknown): number | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error("Invalid numeric value.");
  }

  return value;
}

function asInteger(value: unknown): number | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (!Number.isInteger(value)) {
    throw new Error("Invalid integer value.");
  }

  return Number(value);
}
