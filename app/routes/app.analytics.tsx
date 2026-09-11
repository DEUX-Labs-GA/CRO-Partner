import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { Form, useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { loadProductFunnel } from "../services/product-funnel.server";
import { loadTrackedProducts } from "../services/tracked-products.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const url = new URL(request.url);

  const selectedProductId = url.searchParams.get("productId") ?? "";

  const products = await loadTrackedProducts(session.shop);

  const selectedProduct =
    products.find(
      (product) => product.productId === selectedProductId,
    ) ?? null;

  /*
   * Only use a product ID that belongs to a tracked product option
   * for this authenticated shop.
   */
  const funnelProductId = selectedProduct?.productId ?? null;

  const funnel = await loadProductFunnel(
    session.shop,
    funnelProductId,
  );

  return {
    funnel,
    products,
    selectedProductId: funnelProductId ?? "",
    selectedProduct,
  };
};

export default function AnalyticsPage() {
  const {
    funnel,
    products,
    selectedProductId,
    selectedProduct,
  } = useLoaderData<typeof loader>();

  const isProductFiltered = Boolean(selectedProduct);

  return (
    <s-page heading="Analytics">
      <s-section heading="Product">
        <s-paragraph>
          Choose a product observed in tracked PDP activity during the last{" "}
          {funnel.windowDays} days.
        </s-paragraph>

        <Form method="get">
          <div
            style={{
              display: "flex",
              gap: "12px",
              alignItems: "end",
              flexWrap: "wrap",
              marginTop: "12px",
            }}
          >
            <div>
              <label
                htmlFor="productId"
                style={{
                  display: "block",
                  fontWeight: 600,
                  marginBottom: "6px",
                }}
              >
                Product
              </label>

              <select
                id="productId"
                name="productId"
                defaultValue={selectedProductId}
                style={{
                  minWidth: "320px",
                  minHeight: "36px",
                  padding: "6px 10px",
                }}
              >
                <option value="">All tracked products</option>

                {products.map((product) => (
                  <option
                    key={product.productId}
                    value={product.productId}
                  >
                    {product.label} ({product.visitors} tracked visitor
                    {product.visitors === 1 ? "" : "s"})
                  </option>
                ))}
              </select>
            </div>

            <button
              type="submit"
              style={{
                minHeight: "36px",
                padding: "6px 16px",
                cursor: "pointer",
              }}
            >
              Apply
            </button>
          </div>
        </Form>

        {selectedProduct ? (
          <s-paragraph>
            Showing visitor-path funnel attribution for{" "}
            {selectedProduct.label}.
          </s-paragraph>
        ) : (
          <s-paragraph>
            Showing the funnel across all tracked products.
          </s-paragraph>
        )}
      </s-section>

      <s-section
        heading={
          selectedProduct
            ? `${selectedProduct.label} — PDP to purchase funnel`
            : "PDP to purchase funnel"
        }
      >
        <s-paragraph>
          Unique tracked visitors moving from product view through purchase
          during the last {funnel.windowDays} days.
        </s-paragraph>
      </s-section>

      <s-stack direction="inline" gap="base">
        <s-section heading="Tracked visitors">
          <s-paragraph>{funnel.trackedVisitors}</s-paragraph>
        </s-section>

        <s-section heading="Purchases">
          <s-paragraph>{funnel.purchases}</s-paragraph>
        </s-section>

        <s-section heading="PDP conversion rate">
          <s-paragraph>
            {formatPercent(funnel.overallConversionRate)}
          </s-paragraph>
        </s-section>

        <s-section
          heading={
            isProductFiltered
              ? "Attributed revenue"
              : "Tracked revenue"
          }
        >
          <s-paragraph>
            {formatCurrency(funnel.totalRevenue, funnel.currency)}
          </s-paragraph>
        </s-section>
      </s-stack>

      <s-section heading={`Funnel — last ${funnel.windowDays} days`}>
        <s-table>
          <s-table-header-row>
            <s-table-header>Step</s-table-header>
            <s-table-header>Visitors</s-table-header>
            <s-table-header>From previous</s-table-header>
            <s-table-header>Drop-off</s-table-header>
            <s-table-header>From product view</s-table-header>
          </s-table-header-row>

          <s-table-body>
            {funnel.steps.map((step) => (
              <s-table-row key={step.eventName}>
                <s-table-cell>{step.label}</s-table-cell>

                <s-table-cell>{step.visitors}</s-table-cell>

                <s-table-cell>
                  {formatPercent(step.rateFromPrevious)}
                </s-table-cell>

                <s-table-cell>
                  {formatDropOff(
                    step.dropOffFromPrevious,
                    step.dropOffRateFromPrevious,
                  )}
                </s-table-cell>

                <s-table-cell>
                  {formatPercent(step.rateFromProductView)}
                </s-table-cell>
              </s-table-row>
            ))}
          </s-table-body>
        </s-table>
      </s-section>

      <s-section heading="About this data">
        {isProductFiltered ? (
          <s-paragraph>
            Product-specific reporting uses visitor-path attribution. A visitor
            must view and add the selected product to cart before their later
            checkout and purchase events are attributed to this funnel.
            Checkout and purchase events do not currently provide exact
            line-item product attribution, so attributed revenue should not be
            interpreted as SKU-level revenue.
          </s-paragraph>
        ) : (
          <s-paragraph>
            Funnel counts use unique CRO Partner Web Pixel client IDs. Each
            visitor must progress through the tracked funnel steps in sequence
            during the reporting window. Shopify order count is not used as the
            traffic denominator.
          </s-paragraph>
        )}
      </s-section>
    </s-page>
  );
}

function formatPercent(value: number | null) {
  if (value === null) {
    return "—";
  }

  return `${(value * 100).toFixed(1)}%`;
}

function formatDropOff(
  visitors: number | null,
  rate: number | null,
) {
  if (visitors === null || rate === null) {
    return "—";
  }

  return `${visitors} (${formatPercent(rate)})`;
}

function formatCurrency(value: number, currency: string | null) {
  if (!currency) {
    return value.toFixed(2);
  }

  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
    }).format(value);
  } catch {
    return `${value.toFixed(2)} ${currency}`;
  }
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
