import {
  describe,
  expect,
  it,
} from "vitest";

import {
  detectFunnelOpportunities,
  type OpportunityFunnelInput,
} from "./opportunity-detection.server";

function funnel({
  viewed = 100,
  added = 100,
  checkout = 100,
  purchased = 100,
}: {
  viewed?: number;
  added?: number;
  checkout?: number;
  purchased?: number;
} = {}): OpportunityFunnelInput {
  return {
    trackedVisitors: viewed,
    steps: [
      {
        eventName: "product_viewed",
        label: "Product viewed",
        visitors: viewed,
        rateFromPrevious: null,
        dropOffFromPrevious: null,
        dropOffRateFromPrevious: null,
      },
      {
        eventName: "product_added_to_cart",
        label: "Added to cart",
        visitors: added,
        rateFromPrevious:
          viewed > 0 ? added / viewed : null,
        dropOffFromPrevious:
          Math.max(viewed - added, 0),
        dropOffRateFromPrevious:
          viewed > 0
            ? Math.max(viewed - added, 0) /
              viewed
            : null,
      },
      {
        eventName: "checkout_started",
        label: "Checkout started",
        visitors: checkout,
        rateFromPrevious:
          added > 0 ? checkout / added : null,
        dropOffFromPrevious:
          Math.max(added - checkout, 0),
        dropOffRateFromPrevious:
          added > 0
            ? Math.max(added - checkout, 0) /
              added
            : null,
      },
      {
        eventName: "checkout_completed",
        label: "Purchase completed",
        visitors: purchased,
        rateFromPrevious:
          checkout > 0
            ? purchased / checkout
            : null,
        dropOffFromPrevious:
          Math.max(checkout - purchased, 0),
        dropOffRateFromPrevious:
          checkout > 0
            ? Math.max(
                checkout - purchased,
                0,
              ) / checkout
            : null,
      },
    ],
  };
}

describe("opportunity detection", () => {
  it("returns no opportunity without tracked visitors", () => {
    const result =
      detectFunnelOpportunities(
        funnel({
          viewed: 0,
          added: 0,
          checkout: 0,
          purchased: 0,
        }),
      );

    expect(result).toEqual([]);
  });

  it("detects high PDP to add-to-cart drop-off", () => {
    const result =
      detectFunnelOpportunities(
        funnel({
          viewed: 100,
          added: 20,
          checkout: 15,
          purchased: 12,
        }),
      );

    expect(result[0].ruleId).toBe(
      "PDP_TO_CART_DROPOFF",
    );

    expect(
      result[0].potentialImpact.affectedVisitors,
    ).toBe(80);

    expect(
      result[0].potentialImpact.affectedShare,
    ).toBeCloseTo(0.8);

    expect(result[0].confidence).toBe("HIGH");
  });

  it("does not detect PDP drop-off below the rule threshold", () => {
    const result =
      detectFunnelOpportunities(
        funnel({
          viewed: 100,
          added: 40,
          checkout: 35,
          purchased: 30,
        }),
      );

    expect(
      result.some(
        (item) =>
          item.ruleId ===
          "PDP_TO_CART_DROPOFF",
      ),
    ).toBe(false);
  });

  it("does not create an opportunity from an undersized sample", () => {
    const result =
      detectFunnelOpportunities(
        funnel({
          viewed: 10,
          added: 1,
          checkout: 1,
          purchased: 1,
        }),
      );

    expect(result).toEqual([]);
  });

  it("detects cart to checkout friction", () => {
    const result =
      detectFunnelOpportunities(
        funnel({
          viewed: 100,
          added: 40,
          checkout: 10,
          purchased: 10,
        }),
      );

    expect(
      result.some(
        (item) =>
          item.ruleId ===
          "CART_TO_CHECKOUT_DROPOFF",
      ),
    ).toBe(true);
  });

  it("detects checkout completion friction", () => {
    const result =
      detectFunnelOpportunities(
        funnel({
          viewed: 100,
          added: 60,
          checkout: 50,
          purchased: 20,
        }),
      );

    const opportunity = result.find(
      (item) =>
        item.ruleId ===
        "CHECKOUT_TO_PURCHASE_DROPOFF",
    );

    expect(opportunity).toBeDefined();

    expect(opportunity?.hypothesis).toBeTruthy();
    expect(
      opportunity?.recommendation,
    ).toBeTruthy();
    expect(
      opportunity?.evidence,
    ).toBeTruthy();
  });
});
