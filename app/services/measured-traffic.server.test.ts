import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

vi.mock("../db.server", () => ({
  default: {
    behaviorEvent: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

import prisma from "../db.server";
import {
  loadMeasuredTrafficBaseline,
} from "./measured-traffic.server";

const findFirst = vi.mocked(
  prisma.behaviorEvent.findFirst,
);

const findMany = vi.mocked(
  prisma.behaviorEvent.findMany,
);

describe("measured traffic baseline", () => {
  beforeEach(() => {
    findFirst.mockReset();
    findMany.mockReset();
  });

  it("returns null without a target product", async () => {
    const result =
      await loadMeasuredTrafficBaseline({
        shop: "example.myshopify.com",
        targetProductId: null,
      });

    expect(result).toBeNull();
    expect(findFirst).not.toHaveBeenCalled();
    expect(findMany).not.toHaveBeenCalled();
  });

  it("returns null when no pixel history exists", async () => {
    findFirst.mockResolvedValue(null);

    const result =
      await loadMeasuredTrafficBaseline({
        shop: "example.myshopify.com",
        targetProductId: "123",
      });

    expect(result).toBeNull();
    expect(findMany).not.toHaveBeenCalled();
  });

  it("uses the full requested window when tracking predates it", async () => {
    findFirst.mockResolvedValue({
      occurredAt:
        new Date("2026-07-01T00:00:00Z"),
    } as never);

    findMany.mockResolvedValue([]);

    const result =
      await loadMeasuredTrafficBaseline({
        shop: "example.myshopify.com",
        targetProductId: "123",
        days: 30,
        now: new Date(
          "2026-09-20T00:00:00Z",
        ),
      });

    expect(result?.days).toBe(30);
    expect(result?.lookbackDays).toBe(30);
  });

  it("uses actual tracking coverage when pixel history is shorter than the lookback", async () => {
    findFirst.mockResolvedValue({
      occurredAt:
        new Date("2026-09-12T00:00:00Z"),
    } as never);

    findMany.mockResolvedValue([
      {
        clientId: "visitor-1",
        occurredAt:
          new Date("2026-09-13T10:00:00Z"),
      },
      {
        clientId: "visitor-2",
        occurredAt:
          new Date("2026-09-14T10:00:00Z"),
      },
      {
        clientId: "visitor-3",
        occurredAt:
          new Date("2026-09-15T10:00:00Z"),
      },
      {
        clientId: "visitor-4",
        occurredAt:
          new Date("2026-09-16T10:00:00Z"),
      },
    ] as never);

    const result =
      await loadMeasuredTrafficBaseline({
        shop: "example.myshopify.com",
        targetProductId: "123",
        days: 30,
        now: new Date(
          "2026-09-20T00:00:00Z",
        ),
      });

    expect(result?.days).toBe(8);
    expect(result?.lookbackDays).toBe(30);
    expect(result?.eligibleVisitors).toBe(4);

    expect(
      result?.eligibleVisitorsPerDay,
    ).toBeCloseTo(0.5);
  });

  it("counts one client once per calendar day", async () => {
    findFirst.mockResolvedValue({
      occurredAt:
        new Date("2026-08-01T00:00:00Z"),
    } as never);

    findMany.mockResolvedValue([
      {
        clientId: "visitor-1",
        occurredAt:
          new Date("2026-09-01T10:00:00Z"),
      },
      {
        clientId: "visitor-1",
        occurredAt:
          new Date("2026-09-01T11:00:00Z"),
      },
      {
        clientId: "visitor-1",
        occurredAt:
          new Date("2026-09-02T10:00:00Z"),
      },
      {
        clientId: "visitor-2",
        occurredAt:
          new Date("2026-09-02T12:00:00Z"),
      },
    ] as never);

    const result =
      await loadMeasuredTrafficBaseline({
        shop: "example.myshopify.com",
        targetProductId: "123",
        days: 30,
        now: new Date(
          "2026-09-20T00:00:00Z",
        ),
      });

    expect(result?.eligibleVisitors).toBe(3);

    expect(
      result?.eligibleVisitorsPerDay,
    ).toBeCloseTo(0.1);
  });

  it("returns zero eligible traffic when tracking exists but the target product had no views", async () => {
    findFirst.mockResolvedValue({
      occurredAt:
        new Date("2026-08-01T00:00:00Z"),
    } as never);

    findMany.mockResolvedValue([]);

    const result =
      await loadMeasuredTrafficBaseline({
        shop: "example.myshopify.com",
        targetProductId: "123",
        days: 30,
      });

    expect(result?.eligibleVisitors).toBe(0);
    expect(
      result?.eligibleVisitorsPerDay,
    ).toBe(0);
  });
});
