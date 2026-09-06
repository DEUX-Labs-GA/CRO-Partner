import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { authenticate } from "../shopify.server";
import { boundary } from "@shopify/shopify-app-react-router/server";

type OverviewData = {
  shopName: string;
  currency: string;
  productCount: number;
  orderCount: number | null;
};

type GraphQLResponse<T> = {
  data?: T;
  errors?: Array<{ message: string }>;
};

type BaselineData = {
  shop: { name: string; currencyCode: string };
  productsCount: { count: number };
};

type OrdersData = {
  ordersCount: { count: number };
};

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin } = await authenticate.admin(request);

  const baselineResponse = await admin.graphql(
    `#graphql
      query OverviewBaseline {
        shop {
          name
          currencyCode
        }
        productsCount {
          count
        }
      }`,
  );
  const baseline = (await baselineResponse.json()) as GraphQLResponse<BaselineData>;

  if (!baseline.data) {
    throw new Error("Unable to load Shopify store baseline data.");
  }

  let orderCount: number | null = null;

  try {
    const ordersResponse = await admin.graphql(
      `#graphql
        query OverviewOrders {
          ordersCount {
            count
          }
        }`,
    );
    const orders = (await ordersResponse.json()) as GraphQLResponse<OrdersData>;
    orderCount = orders.data?.ordersCount.count ?? null;
  } catch {
    // Order data requires an order-read scope and is optional for this page.
  }

  return {
    shopName: baseline.data.shop.name,
    currency: baseline.data.shop.currencyCode,
    productCount: baseline.data.productsCount.count,
    orderCount,
  } satisfies OverviewData;
};

export default function Index() {
  const { shopName, currency, productCount, orderCount } =
    useLoaderData<typeof loader>();

  return (
    <s-page heading="Overview">
      <s-section heading="CRO Partner dashboard">
        <s-paragraph>
          Live store baseline for {shopName}.
        </s-paragraph>
      </s-section>
      <s-stack direction="inline" gap="base">
        <s-section heading="Store">
          <s-paragraph>{shopName}</s-paragraph>
          <s-paragraph>Currency: {currency}</s-paragraph>
        </s-section>
        <s-section heading="Products">
          <s-paragraph>{productCount}</s-paragraph>
        </s-section>
        <s-section heading="Orders">
          <s-paragraph>
            {orderCount === null
              ? "Unavailable with current app permissions"
              : orderCount}
          </s-paragraph>
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
