import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

vi.mock("../db.server", () => ({
  default: {
    opportunity: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  },
}));

import prisma from "../db.server";
import {
  DEFAULT_OPPORTUNITY_EFFORT,
  saveDetectedOpportunity,
} from "./opportunity-backlog.server";

const findFirst = vi.mocked(
  prisma.opportunity.findFirst,
);

const create = vi.mocked(
  prisma.opportunity.create,
);

const update = vi.mocked(
  prisma.opportunity.update,
);

const opportunity = {
  ruleId: "PDP_TO_CART_DROPOFF" as const,
  title:
    "High product-view to add-to-cart drop-off",
  observation:
    "80.0% of tracked visitors dropped between product viewed and added to cart.",
  evidence:
    "100 visitors reached product viewed, 20 reached added to cart, and 80 did not progress.",
  hypothesis:
    "The product page may not be giving enough clarity.",
  recommendation:
    "Review the product page for testable friction.",
  confidence: "HIGH" as const,
  potentialImpact: {
    level: "HIGH" as const,
    affectedVisitors: 80,
    affectedShare: 0.8,
  },
};

describe("opportunity backlog", () => {
  beforeEach(() => {
    findFirst.mockReset();
    create.mockReset();
    update.mockReset();
  });

  it("creates a new detected opportunity", async () => {
    findFirst.mockResolvedValue(null);

    create.mockResolvedValue({
      id: "opportunity-1",
    } as never);

    await saveDetectedOpportunity({
      shop: "example.myshopify.com",
      productId: "product-1",
      opportunity,
    });

    expect(create).toHaveBeenCalledOnce();

    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        shop: "example.myshopify.com",
        sourceRuleId:
          "PDP_TO_CART_DROPOFF",
        productId: "product-1",
        reach: 80,
        effort:
          DEFAULT_OPPORTUNITY_EFFORT,
        priorityScore: 120,
      }),
    });
  });

  it("refreshes an existing active opportunity instead of duplicating it", async () => {
    findFirst.mockResolvedValue({
      id: "existing-opportunity",
    } as never);

    update.mockResolvedValue({
      id: "existing-opportunity",
    } as never);

    await saveDetectedOpportunity({
      shop: "example.myshopify.com",
      productId: "product-1",
      opportunity,
    });

    expect(create).not.toHaveBeenCalled();

    expect(update).toHaveBeenCalledWith({
      where: {
        id: "existing-opportunity",
      },
      data: expect.objectContaining({
        evidence: opportunity.evidence,
        reach: 80,
        priorityScore: 120,
      }),
    });
  });

  it("uses null product ID for a store-wide opportunity", async () => {
    findFirst.mockResolvedValue(null);

    create.mockResolvedValue({
      id: "opportunity-1",
    } as never);

    await saveDetectedOpportunity({
      shop: "example.myshopify.com",
      productId: null,
      opportunity,
    });

    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        productId: null,
      }),
    });
  });

  it("allows effort to change the priority score", async () => {
    findFirst.mockResolvedValue(null);

    create.mockResolvedValue({
      id: "opportunity-1",
    } as never);

    await saveDetectedOpportunity({
      shop: "example.myshopify.com",
      productId: "product-1",
      opportunity,
      effort: 4,
    });

    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        effort: 4,
        priorityScore: 60,
      }),
    });
  });
});
