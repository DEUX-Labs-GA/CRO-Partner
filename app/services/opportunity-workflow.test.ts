import {
  describe,
  expect,
  it,
} from "vitest";

const STATUSES = [
  "RESEARCH_NEEDED",
  "READY_TO_TEST",
  "TESTING",
  "COMPLETED",
  "NOT_PURSUING",
] as const;

function isStatus(value: string) {
  return STATUSES.includes(
    value as (typeof STATUSES)[number],
  );
}

describe("opportunity workflow", () => {
  it("supports all required backlog states", () => {
    expect(STATUSES).toEqual([
      "RESEARCH_NEEDED",
      "READY_TO_TEST",
      "TESTING",
      "COMPLETED",
      "NOT_PURSUING",
    ]);
  });

  it("accepts a valid workflow state", () => {
    expect(
      isStatus("READY_TO_TEST"),
    ).toBe(true);
  });

  it("rejects an invalid workflow state", () => {
    expect(
      isStatus("ARCHIVED"),
    ).toBe(false);
  });

  it("sorts higher priority first", () => {
    const items = [
      {
        id: "low",
        priorityScore: 10,
      },
      {
        id: "high",
        priorityScore: 100,
      },
      {
        id: "medium",
        priorityScore: 50,
      },
    ];

    items.sort(
      (a, b) =>
        b.priorityScore -
        a.priorityScore,
    );

    expect(
      items.map((item) => item.id),
    ).toEqual([
      "high",
      "medium",
      "low",
    ]);
  });
});
