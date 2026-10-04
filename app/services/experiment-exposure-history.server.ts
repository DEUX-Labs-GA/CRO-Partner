import prisma from "../db.server";

const EXPOSURE_EVENT =
  "cro_partner:experiment_exposure";

type ExposureEvent = {
  clientId: string | null;
  experimentVariantId: string | null;
  occurredAt: Date;
};

export type ExperimentExposureHistoryPoint = {
  date: string;
  dailyByVariant: Record<string, number>;
  cumulativeByVariant: Record<string, number>;
  dailyTotal: number;
  cumulativeTotal: number;
};

export async function loadExperimentExposureHistory(
  shop: string,
  experimentId: string,
) {
  const events =
    await prisma.behaviorEvent.findMany({
      where: {
        shop,
        eventName: EXPOSURE_EVENT,
        experimentId,
        clientId: {
          not: null,
        },
        experimentVariantId: {
          not: null,
        },
      },
      select: {
        clientId: true,
        experimentVariantId: true,
        occurredAt: true,
      },
      orderBy: {
        occurredAt: "asc",
      },
    });

  return summarizeExperimentExposureHistory(
    events,
  );
}

export function summarizeExperimentExposureHistory(
  events: ExposureEvent[],
): ExperimentExposureHistoryPoint[] {
  const sortedEvents = [...events].sort(
    (a, b) =>
      a.occurredAt.getTime() -
      b.occurredAt.getTime(),
  );

  const firstExposureByClient = new Map<
    string,
    {
      variantId: string;
      occurredAt: Date;
    }
  >();

  const ambiguousClients =
    new Set<string>();

  for (const event of sortedEvents) {
    if (
      !event.clientId ||
      !event.experimentVariantId
    ) {
      continue;
    }

    const existing =
      firstExposureByClient.get(
        event.clientId,
      );

    if (
      existing &&
      existing.variantId !==
        event.experimentVariantId
    ) {
      ambiguousClients.add(
        event.clientId,
      );
      continue;
    }

    if (!existing) {
      firstExposureByClient.set(
        event.clientId,
        {
          variantId:
            event.experimentVariantId,
          occurredAt:
            event.occurredAt,
        },
      );
    }
  }

  for (const clientId of ambiguousClients) {
    firstExposureByClient.delete(
      clientId,
    );
  }

  const exposures = [
    ...firstExposureByClient.values(),
  ];

  if (exposures.length === 0) {
    return [];
  }

  const dailyBuckets = new Map<
    string,
    Record<string, number>
  >();

  const variantIds = new Set<string>();

  for (const exposure of exposures) {
    const date = toUtcDateKey(
      exposure.occurredAt,
    );

    variantIds.add(
      exposure.variantId,
    );

    const bucket =
      dailyBuckets.get(date) ?? {};

    bucket[exposure.variantId] =
      (bucket[exposure.variantId] ?? 0) +
      1;

    dailyBuckets.set(
      date,
      bucket,
    );
  }

  const dates = [
    ...dailyBuckets.keys(),
  ].sort();

  const firstDate = parseUtcDateKey(
    dates[0],
  );

  const lastDate = parseUtcDateKey(
    dates[dates.length - 1],
  );

  const cumulativeByVariant:
    Record<string, number> = {};

  for (const variantId of variantIds) {
    cumulativeByVariant[variantId] = 0;
  }

  let cumulativeTotal = 0;

  const history:
    ExperimentExposureHistoryPoint[] = [];

  for (
    let date = firstDate;
    date <= lastDate;
    date = addUtcDays(date, 1)
  ) {
    const dateKey =
      toUtcDateKey(date);

    const dailyByVariant =
      dailyBuckets.get(dateKey) ?? {};

    let dailyTotal = 0;

    for (const variantId of variantIds) {
      const dailyCount =
        dailyByVariant[variantId] ?? 0;

      dailyTotal += dailyCount;

      cumulativeByVariant[variantId] +=
        dailyCount;
    }

    cumulativeTotal += dailyTotal;

    history.push({
      date: dateKey,
      dailyByVariant: {
        ...dailyByVariant,
      },
      cumulativeByVariant: {
        ...cumulativeByVariant,
      },
      dailyTotal,
      cumulativeTotal,
    });
  }

  return history;
}

function toUtcDateKey(date: Date) {
  return date
    .toISOString()
    .slice(0, 10);
}

function parseUtcDateKey(value: string) {
  return new Date(
    `${value}T00:00:00.000Z`,
  );
}

function addUtcDays(
  date: Date,
  days: number,
) {
  const next = new Date(date);

  next.setUTCDate(
    next.getUTCDate() + days,
  );

  return next;
}
