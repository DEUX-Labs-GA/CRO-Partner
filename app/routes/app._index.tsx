import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { boundary } from "@shopify/shopify-app-react-router/server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);

  return null;
};

export default function Index() {
  return (
    <s-page heading="Overview">
      <s-section heading="CRO Partner dashboard">
        <s-paragraph>
          Monitor store performance, review active experiments, and turn
          optimization opportunities into action.
        </s-paragraph>
      </s-section>
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
