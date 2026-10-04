import { describe, expect, it } from "vitest";

import { summarizeExperimentExposureHistory } from "./experiment-exposure-history.server";

function exposure({
  eventId,
  clientId,
  variantId,
  occurredAt,
}: {
  eventId: string;
  clientId: string;
  variantId: string;
  occurredAt: string;
}) {
  return {
    eventId,
    eventName: "cro_partner:experiment_exposure",
    clientId,
    experimentId: "experiment-1",
    experimentVariantId: variantId,
    occurredAt: new Date(occurredAt),
    value: null,
    currency: null,
    orderId: null,
  };
}

describe("summarizeExperimentExposureHistory", () => {
  it("counts each client once using their first exposure", () => {
    const result =
      summarizeExperimentExposureHistory([
        exposure({
          eventId: "1",
          clientId: "client-1",
          variantId: "control",
          occurredAt:
            "2026-10-01T10:00:00.000Z",
        }),
        exposure({
          eventId: "2",
          clientId: "client-1",
          variantId: "control",
          occurredAt:
            "2026-10-01T11:00:00.000Z",
        }),
        exposure({
          eventId: "3",
          clientId: "client-2",
          variantId: "variant-a",
          occurredAt:
            "2026-10-02T10:00:00.000Z",
        }),
      ]);

    expect(result).toEqual([
      {
        date: "2026-10-01",
        dailyByVariant: {
          control: 1,
        },
        cumulativeByVariant: {
          control: 1,
          "variant-a": 0,
        },
        dailyTotal: 1,
        cumulativeTotal: 1,
      },
      {
        date: "2026-10-02",
        dailyByVariant: {
          "variant-a": 1,
        },
        cumulativeByVariant: {
          control: 1,
          "variant-a": 1,
        },
        dailyTotal: 1,
        cumulativeTotal: 2,
      },
    ]);
  });

  it("excludes clients exposed to conflicting variants", () => {
    const result =
      summarizeExperimentExposureHistory([
        exposure({
          eventId: "1",
          clientId: "client-1",
          variantId: "control",
          occurredAt:
            "2026-10-01T10:00:00.000Z",
        }),
        exposure({
          eventId: "2",
          clientId: "client-1",
          variantId: "variant-a",
          occurredAt:
            "2026-10-02T10:00:00.000Z",
        }),
        exposure({
          eventId: "3",
          clientId: "client-2",
          variantId: "control",
          occurredAt:
            "2026-10-02T12:00:00.000Z",
        }),
      ]);

    expect(result).toEqual([
      {
        date: "2026-10-02",
        dailyByVariant: {
          control: 1,
        },
        cumulativeByVariant: {
          control: 1,
        },
        dailyTotal: 1,
        cumulativeTotal: 1,
      },
    ]);
  });

  it("fills dates with zero new exposures so cumulative lines stay continuous", () => {
    const result =
      summarizeExperimentExposureHistory([
        exposure({
          eventId: "1",
          clientId: "client-1",
          variantId: "control",
          occurredAt:
            "2026-10-01T10:00:00.000Z",
        }),
        exposure({
          eventId: "2",
          clientId: "client-2",
          variantId: "variant-a",
          occurredAt:
            "2026-10-03T10:00:00.000Z",
        }),
      ]);

    expect(result).toHaveLength(3);

    expect(result[1]).toEqual({
      date: "2026-10-02",
      dailyByVariant: {},
      cumulativeByVariant: {
        control: 1,
        "variant-a": 0,
      },
      dailyTotal: 0,
      cumulativeTotal: 1,
    });
  });

  it("returns an empty history when no valid exposures exist", () => {
    expect(
      summarizeExperimentExposureHistory([]),
    ).toEqual([]);
  });
});
