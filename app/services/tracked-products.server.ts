import prisma from "../db.server";
import { PRODUCT_FUNNEL_WINDOW_DAYS } from "./product-funnel.server";

type TrackedProductEvent = {
  productId: string | null;
  pageTitle: string | null;
  pagePath: string | null;
  clientId: string | null;
  occurredAt: Date;
};

export type TrackedProductOption = {
  productId: string;
  label: string;
  pagePath: string | null;
  visitors: number;
  lastSeenAt: string;
};

export async function loadTrackedProducts(shop: string) {
  const windowStart = new Date();

  windowStart.setUTCDate(
    windowStart.getUTCDate() - PRODUCT_FUNNEL_WINDOW_DAYS,
  );

  const events = await prisma.behaviorEvent.findMany({
    where: {
      shop,
      eventName: "product_viewed",
      productId: {
        not: null,
      },
      occurredAt: {
        gte: windowStart,
      },
    },
    select: {
      productId: true,
      pageTitle: true,
      pagePath: true,
      clientId: true,
      occurredAt: true,
    },
    orderBy: {
      occurredAt: "asc",
    },
  });

  return summarizeTrackedProducts(events);
}

export function summarizeTrackedProducts(
  events: TrackedProductEvent[],
): TrackedProductOption[] {
  const products = new Map<
    string,
    {
      productId: string;
      label: string;
      pagePath: string | null;
      visitors: Set<string>;
      lastSeenAt: Date;
    }
  >();

  for (const event of events) {
    if (!event.productId) {
      continue;
    }

    const existing = products.get(event.productId);

    if (!existing) {
      const visitors = new Set<string>();

      if (event.clientId) {
        visitors.add(event.clientId);
      }

      products.set(event.productId, {
        productId: event.productId,
        label: productLabel(event),
        pagePath: event.pagePath,
        visitors,
        lastSeenAt: event.occurredAt,
      });

      continue;
    }

    if (event.clientId) {
      existing.visitors.add(event.clientId);
    }

    /*
     * Keep the newest observed title/path in case product metadata
     * changed during the reporting window.
     */
    if (event.occurredAt >= existing.lastSeenAt) {
      existing.label = productLabel(event);
      existing.pagePath = event.pagePath;
      existing.lastSeenAt = event.occurredAt;
    }
  }

  return [...products.values()]
    .map((product) => ({
      productId: product.productId,
      label: product.label,
      pagePath: product.pagePath,
      visitors: product.visitors.size,
      lastSeenAt: product.lastSeenAt.toISOString(),
    }))
    .sort((a, b) => {
      if (b.visitors !== a.visitors) {
        return b.visitors - a.visitors;
      }

      return a.label.localeCompare(b.label);
    });
}

function productLabel(event: TrackedProductEvent) {
  if (event.pageTitle?.trim()) {
    return event.pageTitle.trim();
  }

  if (event.pagePath?.trim()) {
    return event.pagePath.trim();
  }

  return `Product ${event.productId}`;
}
