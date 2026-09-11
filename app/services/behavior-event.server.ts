import prisma from "../db.server";

const SUPPORTED_EVENTS = new Set([
  "product_viewed",
  "product_added_to_cart",
  "checkout_started",
  "checkout_completed",
]);

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

  if (typeof input.shop !== "string" || !input.shop.endsWith(".myshopify.com")) {
    throw new Error("Invalid shop.");
  }

  if (typeof input.eventId !== "string" || input.eventId.length < 1) {
    throw new Error("Missing eventId.");
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
    sourceId: asString(input.sourceId),
    occurredAt,
    sequence: asInteger(input.sequence),
    clientId: asString(input.clientId),
    pageUrl: asString(input.page?.url),
    pagePath: asString(input.page?.path),
    pageReferrer: asString(input.page?.referrer),
    pageTitle: asString(input.page?.title),
    productId: asString(input.commerce?.productId),
    variantId: asString(input.commerce?.variantId),
    sku: asString(input.commerce?.sku),
    quantity: asNumber(input.commerce?.quantity),
    value: asNumber(input.commerce?.value),
    currency: asString(input.commerce?.currency),
    checkoutToken: asString(input.commerce?.checkoutToken),
    orderId: asString(input.commerce?.orderId),
  };
}

export async function persistBehaviorEvent(input: IncomingBehaviorEvent) {
  const event = validateBehaviorEvent(input);

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

function asString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function asNumber(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }

  return value;
}

function asInteger(value: unknown): number | null {
  return Number.isInteger(value) ? Number(value) : null;
}
