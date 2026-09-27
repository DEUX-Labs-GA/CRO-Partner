import type {
  ActionFunctionArgs,
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import {
  Form,
  redirect,
  useLoaderData,
} from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { loadProductFunnel } from "../services/product-funnel.server";
import { loadTrackedProducts } from "../services/tracked-products.server";
import { detectFunnelOpportunities } from "../services/opportunity-detection.server";
import { saveDetectedOpportunity } from "../services/opportunity-backlog.server";

export const action = async ({
  request,
}: ActionFunctionArgs) => {
  const { session } =
    await authenticate.admin(request);

  const formData =
    await request.formData();

  const intent =
    formData.get("intent");

  if (intent !== "add-opportunity") {
    throw new Response("Invalid action", {
      status: 400,
    });
  }

  const ruleId =
    formData.get("ruleId");

  const requestedProductId =
    formData.get("productId");

  if (typeof ruleId !== "string") {
    throw new Response(
      "Opportunity rule is required",
      {
        status: 400,
      },
    );
  }

  const products =
    await loadTrackedProducts(session.shop);

  const selectedProduct =
    typeof requestedProductId === "string" &&
    requestedProductId
      ? products.find(
          (product) =>
            product.productId ===
            requestedProductId,
        ) ?? null
      : null;

  /*
   * Reject a supplied product ID that does not belong to
   * this shop's tracked product set.
   */
  if (
    requestedProductId &&
    !selectedProduct
  ) {
    throw new Response(
      "Tracked product not found",
      {
        status: 404,
      },
    );
  }

  const productId =
    selectedProduct?.productId ?? null;

  const funnel =
    await loadProductFunnel(
      session.shop,
      productId,
    );

  const detected =
    detectFunnelOpportunities(funnel);

  const opportunity =
    detected.find(
      (item) =>
        item.ruleId === ruleId,
    );

  /*
   * The server must currently detect the opportunity.
   * We do not accept browser-supplied evidence or scoring.
   */
  if (!opportunity) {
    throw new Response(
      "Opportunity is no longer supported by current funnel data",
      {
        status: 409,
      },
    );
  }

  await saveDetectedOpportunity({
    shop: session.shop,
    productId,
    opportunity,
  });

  const query =
    productId
      ? `?productId=${encodeURIComponent(
          productId,
        )}`
      : "";

  return redirect(
    `/app/analytics${query}`,
  );
};

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

  const opportunities =
  detectFunnelOpportunities(funnel);

  return {
    funnel,
    opportunities,
    products,
    selectedProductId: funnelProductId ?? "",
    selectedProduct,
  };
};

export default function AnalyticsPage() {
  const {
    funnel,
    opportunities,
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

      <s-section heading="Detected opportunities">
        {opportunities.length === 0 ? (
          <s-paragraph>
            No opportunity currently meets the minimum evidence and drop-off
            thresholds for this funnel.
          </s-paragraph>
        ) : (
          <div
            style={{
              display: "grid",
              gap: "16px",
            }}
          >
            {opportunities.map((opportunity) => (
              <div
                key={opportunity.ruleId}
                style={{
                  border: "1px solid #dcdcdc",
                  borderRadius: "12px",
                  padding: "16px",
                  background: "#ffffff",
                }}
              >
                <div
                  style={{
                    fontSize: "16px",
                    fontWeight: 650,
                    marginBottom: "10px",
                  }}
                >
                  {opportunity.title}
                </div>

                <s-paragraph>
                  Observation: {opportunity.observation}
                </s-paragraph>

                <s-paragraph>
                  Evidence: {opportunity.evidence}
                </s-paragraph>

                <s-paragraph>
                  Hypothesis: {opportunity.hypothesis}
                </s-paragraph>

                <s-paragraph>
                  Recommendation: {opportunity.recommendation}
                </s-paragraph>

                <s-paragraph>
                  Confidence: {formatLabel(opportunity.confidence)}
                </s-paragraph>

                <s-paragraph>
                  Potential impact:{" "}
                  {formatLabel(opportunity.potentialImpact.level)} —{" "}
                  {opportunity.potentialImpact.affectedVisitors} affected visitor
                  {opportunity.potentialImpact.affectedVisitors === 1 ? "" : "s"} (
                  {formatPercent(
                    opportunity.potentialImpact.affectedShare,
                  )}
                  )
                </s-paragraph>

                <Form method="post">
                  <input
                    type="hidden"
                    name="intent"
                    value="add-opportunity"
                  />

                  <input
                    type="hidden"
                    name="ruleId"
                    value={opportunity.ruleId}
                  />

                  <input
                    type="hidden"
                    name="productId"
                    value={selectedProductId}
                  />

                  <button
                    type="submit"
                    style={{
                      marginTop: "12px",
                      minHeight: "36px",
                      padding: "6px 14px",
                      cursor: "pointer",
                    }}
                  >
                    Add to CRO backlog
                  </button>
                </Form>                
              </div>
            ))}
          </div>
        )}
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

function formatLabel(value: string) {
  return value
    .toLowerCase()
    .replace(/(^|_)([a-z])/g, (_, prefix, letter) =>
      `${prefix ? " " : ""}${letter.toUpperCase()}`,
    );
}
