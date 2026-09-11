import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { loadProductFunnel } from "../services/product-funnel.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);

  return loadProductFunnel(session.shop);
};

export default function AnalyticsPage() {
  const funnel = useLoaderData<typeof loader>();

  return (
    <s-page heading="Analytics">
      <s-section heading="PDP to purchase funnel">
        <s-paragraph>
          Unique tracked visitors moving from product view through purchase.
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

        <s-section heading="Tracked revenue">
          <s-paragraph>
            {formatCurrency(funnel.totalRevenue, funnel.currency)}
          </s-paragraph>
        </s-section>
      </s-stack>

      <s-section heading="Funnel">
        <s-table>
          <s-table-header-row>
            <s-table-header>Step</s-table-header>
            <s-table-header>Visitors</s-table-header>
            <s-table-header>From previous step</s-table-header>
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
                  {formatPercent(step.rateFromProductView)}
                </s-table-cell>
              </s-table-row>
            ))}
          </s-table-body>
        </s-table>
      </s-section>

      <s-section heading="About this data">
        <s-paragraph>
          Funnel counts are based on unique Web Pixel client IDs captured by CRO
          Partner. Shopify order count is not being used as the traffic
          denominator.
        </s-paragraph>
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
