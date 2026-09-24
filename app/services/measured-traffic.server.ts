import prisma from "../db.server";

export type MeasuredTrafficBaseline = {
  eligibleVisitors: number;
  eligibleVisitorsPerDay: number;
  days: number;
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
  const startDate = new Date(now);

  startDate.setUTCDate(
    startDate.getUTCDate() - days,
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

  const eligibleVisitorDays = new Set<string>();

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
      eligibleVisitors / days,
    days,
    startDate,
    endDate,
  };
}
