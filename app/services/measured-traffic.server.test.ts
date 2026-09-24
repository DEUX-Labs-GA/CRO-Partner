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
      findMany: vi.fn(),
    },
  },
}));

import prisma from "../db.server";
import {
  loadMeasuredTrafficBaseline,
} from "./measured-traffic.server";

const findMany = vi.mocked(
  prisma.behaviorEvent.findMany,
);

describe("measured traffic baseline", () => {
  beforeEach(() => {
    findMany.mockReset();
  });

  it("returns null without a target product", async () => {
    const result =
      await loadMeasuredTrafficBaseline({
        shop: "example.myshopify.com",
        targetProductId: null,
      });

    expect(result).toBeNull();
    expect(findMany).not.toHaveBeenCalled();
  });

  it("counts one client once per calendar day", async () => {
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

  it("returns zero measured visitors when no events exist", async () => {
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
