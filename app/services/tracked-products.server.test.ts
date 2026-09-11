import { describe, expect, it } from "vitest";
import { summarizeTrackedProducts } from "./tracked-products.server";

describe("tracked products", () => {
  it("builds unique product options from tracked PDP views", () => {
    const products = summarizeTrackedProducts([
      {
        productId: "product-1",
        pageTitle: "Hydrogen Snowboard",
        pagePath: "/products/hydrogen-snowboard",
        clientId: "visitor-1",
        occurredAt: new Date("2026-09-10T10:00:00Z"),
      },
      {
        productId: "product-1",
        pageTitle: "Hydrogen Snowboard",
        pagePath: "/products/hydrogen-snowboard",
        clientId: "visitor-2",
        occurredAt: new Date("2026-09-10T10:01:00Z"),
      },
      {
        productId: "product-2",
        pageTitle: "Oxygen Snowboard",
        pagePath: "/products/oxygen-snowboard",
        clientId: "visitor-3",
        occurredAt: new Date("2026-09-10T10:02:00Z"),
      },
    ]);

    expect(products).toHaveLength(2);
    expect(products[0]).toMatchObject({
      productId: "product-1",
      label: "Hydrogen Snowboard",
      visitors: 2,
    });
  });

  it("counts the same visitor only once per product", () => {
    const products = summarizeTrackedProducts([
      {
        productId: "product-1",
        pageTitle: "Hydrogen Snowboard",
        pagePath: "/products/hydrogen-snowboard",
        clientId: "visitor-1",
        occurredAt: new Date("2026-09-10T10:00:00Z"),
      },
      {
        productId: "product-1",
        pageTitle: "Hydrogen Snowboard",
        pagePath: "/products/hydrogen-snowboard",
        clientId: "visitor-1",
        occurredAt: new Date("2026-09-10T10:05:00Z"),
      },
    ]);

    expect(products[0].visitors).toBe(1);
  });
});
