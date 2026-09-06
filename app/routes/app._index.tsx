import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { loadStoreBaseline } from "../services/experiment-pre-analysis.server";
import { authenticate } from "../shopify.server";
import { boundary } from "@shopify/shopify-app-react-router/server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  return loadStoreBaseline(admin);
};

export default function Index() {
  const baseline = useLoaderData<typeof loader>();

  return (
    <s-page heading="Overview">
      <s-section heading="CRO Partner dashboard">
        <s-paragraph>
          Live store baseline for {baseline.shopName}.
        </s-paragraph>
      </s-section>
      <s-stack direction="inline" gap="base">
        <s-section heading="Store">
          <s-paragraph>{baseline.shopName}</s-paragraph>
          <s-paragraph>Currency: {baseline.currency}</s-paragraph>
        </s-section>
        <s-section heading="Products">
          <s-paragraph>{baseline.productCount}</s-paragraph>
        </s-section>
        <s-section heading="Orders">
          <s-paragraph>
            {baseline.recentOrderCount === null
              ? "Unavailable with current app permissions"
              : baseline.recentOrderCount}
          </s-paragraph>
          <s-paragraph>{baseline.orderWindow.label}</s-paragraph>
        </s-section>
      </s-stack>
      <s-stack direction="inline" gap="base">
        <s-section heading="Analytics">
          <s-paragraph>Performance reporting will appear here.</s-paragraph>
          <s-link href="/app/analytics">View analytics</s-link>
        </s-section>
        <s-section heading="Experiments">
          <s-paragraph>Experiment status will appear here.</s-paragraph>
          <s-link href="/app/experiments">View experiments</s-link>
        </s-section>
        <s-section heading="Recommendations">
          <s-paragraph>Optimization recommendations will appear here.</s-paragraph>
          <s-link href="/app/recommendations">View recommendations</s-link>
        </s-section>
      </s-stack>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
