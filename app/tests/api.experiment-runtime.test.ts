import { beforeEach, describe, expect, it, vi } from "vitest";

const findFirst = vi.fn();

vi.mock("../db.server", () => ({
  default: {
    experiment: {
      findFirst,
    },
  },
}));

vi.mock("../shopify.server", () => ({
  authenticate: {
    public: {
      appProxy: vi.fn(async () => ({
        session: {
          shop: "test-shop.myshopify.com",
        },
      })),
    },
  },
}));

describe("experiment runtime proxy", () => {
  beforeEach(() => {
    findFirst.mockReset();
  });

  it("returns generic treatment configuration", async () => {
    findFirst.mockResolvedValue({
      id: "experiment-db-id",
      trackingKey: "experiment-runtime-key",
      status: "RUNNING",
      targetProductId: "123",
      variants: [
        {
          id: "control-db-id",
          name: "Original content",
          isControl: true,
          titleOverride: null,
          target: null,
          changeType: null,
          changeValue: null,
        },
        {
          id: "treatment-db-id",
          name: "Treatment content",
          isControl: false,
          titleOverride: null,
          target: "ADD_TO_CART_BUTTON",
          changeType: "REPLACE_TEXT",
          changeValue: "Buy now",
        },
      ],
    });

    const { loader } = await import(
      "../routes/api.experiment-runtime"
    );

    const request = new Request(
      "https://example.com/apps/cro-partner",
    );

    const response = await loader({
      request,
      params: {},
      context: {},
    } as never);

    const body = await response.json();

    expect(body.activeExperiment).toMatchObject({
      experimentId: "experiment-db-id",
      trackingKey: "experiment-runtime-key",
      productId: "123",
    });

    expect(body.activeExperiment.variants[1]).toMatchObject({
      id: "variant-a",
      databaseId: "treatment-db-id",
      target: "ADD_TO_CART_BUTTON",
      changeType: "REPLACE_TEXT",
      changeValue: "Buy now",
    });
  });

  it("maps legacy titleOverride into generic configuration", async () => {
    findFirst.mockResolvedValue({
      id: "legacy-experiment-db-id",
      trackingKey: "legacy-runtime-key",
      status: "RUNNING",
      targetProductId: "456",
      variants: [
        {
          id: "legacy-control-db-id",
          name: "Original title",
          isControl: true,
          titleOverride: null,
          target: null,
          changeType: null,
          changeValue: null,
        },
        {
          id: "legacy-treatment-db-id",
          name: "Treatment title",
          isControl: false,
          titleOverride: "Legacy replacement title",
          target: null,
          changeType: null,
          changeValue: null,
        },
      ],
    });

    const { loader } = await import(
      "../routes/api.experiment-runtime"
    );

    const request = new Request(
      "https://example.com/apps/cro-partner",
    );

    const response = await loader({
      request,
      params: {},
      context: {},
    } as never);

    const body = await response.json();
    const treatment = body.activeExperiment.variants[1];

    expect(treatment).toMatchObject({
      target: "PRODUCT_TITLE",
      changeType: "REPLACE_TEXT",
      changeValue: "Legacy replacement title",
      titleOverride: "Legacy replacement title",
    });
  });
});
