import prisma from "../db.server";

const MILLISECONDS_PER_DAY =
  24 * 60 * 60 * 1000;

export type MeasuredTrafficBaseline = {
  eligibleVisitors: number;
  eligibleVisitorsPerDay: number;
  days: number;
  lookbackDays: number;
  startDate: Date;
  endDate: Date;
};

export async function loadMeasuredTrafficBaseline({
  shop,
  targetProductId,
  days = 30,
  now = new Date(),
}: {
  shop: string;
  targetProductId: string | null;
  days?: number;
  now?: Date;
}): Promise<MeasuredTrafficBaseline | null> {
  if (!targetProductId || days <= 0) {
    return null;
  }

  const endDate = new Date(now);
  const requestedStartDate = new Date(now);

  requestedStartDate.setUTCDate(
    requestedStartDate.getUTCDate() - days,
  );

  /*
   * The first stored pixel event tells us when CRO Partner
   * actually began observing this shop.
   *
   * If tracking started less than `days` ago, we should not
   * pretend we observed the missing days before that point.
   */
  const firstRecordedEvent =
    await prisma.behaviorEvent.findFirst({
      where: {
        shop,
      },
      orderBy: {
        occurredAt: "asc",
      },
      select: {
        occurredAt: true,
      },
    });

  /*
   * No pixel history means measured traffic is unavailable.
   * Returning null allows pre-analysis to use its existing
   * order-derived fallback rather than treating missing
   * measurement as zero traffic.
   */
  if (!firstRecordedEvent) {
    return null;
  }

  const startDate =
    firstRecordedEvent.occurredAt >
    requestedStartDate
      ? new Date(
          firstRecordedEvent.occurredAt,
        )
      : requestedStartDate;

  const coverageDays = Math.min(
    days,
    Math.max(
      1,
      Math.ceil(
        (endDate.getTime() -
          startDate.getTime()) /
          MILLISECONDS_PER_DAY,
      ),
    ),
  );

  const events =
    await prisma.behaviorEvent.findMany({
      where: {
        shop,
        eventName: "product_viewed",
        productId: targetProductId,
        clientId: {
          not: null,
        },
        occurredAt: {
          gte: startDate,
          lt: endDate,
        },
      },
      select: {
        clientId: true,
        occurredAt: true,
      },
    });

  /*
   * Count the same Shopify client once per calendar day.
   * This is deliberately described as eligible visitor-days,
   * not Shopify sessions.
   */
  const eligibleVisitorDays =
    new Set<string>();

  for (const event of events) {
    if (!event.clientId) {
      continue;
    }

    const date =
      event.occurredAt
        .toISOString()
        .slice(0, 10);

    eligibleVisitorDays.add(
      `${date}:${event.clientId}`,
    );
  }

  const eligibleVisitors =
    eligibleVisitorDays.size;

  return {
    eligibleVisitors,
    eligibleVisitorsPerDay:
      eligibleVisitors / coverageDays,
    days: coverageDays,
    lookbackDays: days,
    startDate,
    endDate,
  };
}
