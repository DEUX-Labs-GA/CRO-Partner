import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import prisma from "../db.server";
import { authenticate } from "../shopify.server";
import {
  assessPreAnalysis,
  loadStoreBaseline,
} from "../services/experiment-pre-analysis.server";

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const experiment = await prisma.experiment.findFirst({
    where: { id: params.id, shop: session.shop },
    include: {
      variants: { orderBy: { createdAt: "asc" } },
      metrics: { where: { isPrimary: true }, take: 1 },
    },
  });

  if (!experiment) {
    throw new Response("Experiment not found", { status: 404 });
  }

  const baseline = await loadStoreBaseline(admin);

  return {
    experiment,
    preAnalysis: assessPreAnalysis(baseline),
  };
};

export default function ExperimentDetailPage() {
  const { experiment, preAnalysis } = useLoaderData<typeof loader>();
  const primaryMetric = experiment.metrics[0];

  return (
    <s-page heading={experiment.name}>
      <s-section heading="Experiment details">
        <s-paragraph>{experiment.hypothesis}</s-paragraph>
        <s-paragraph>Status: {experiment.status}</s-paragraph>
        <s-paragraph>Created: {experiment.createdAt.toLocaleDateString()}</s-paragraph>
        <s-paragraph>
          Primary metric: {primaryMetric?.name ?? "Not defined"}
          {primaryMetric ? ` (${primaryMetric.type})` : ""}
        </s-paragraph>
      </s-section>
      <s-section heading="Variants">
        <s-unordered-list>
          {experiment.variants.map((variant) => (
            <s-list-item key={variant.id}>
              {variant.name} {variant.isControl ? "(Control)" : "(Treatment)"}
            </s-list-item>
          ))}
        </s-unordered-list>
      </s-section>
      <s-section heading="Pre-analysis">
        <s-paragraph>Data availability: {preAnalysis.dataAvailability}</s-paragraph>
        <s-paragraph>
          Order-volume data: {preAnalysis.orderDataAvailable ? "Available" : "Unavailable"}
        </s-paragraph>
        <s-paragraph>
          Recent order count ({preAnalysis.orderWindow.label}): {preAnalysis.recentOrderCount ?? "Unavailable"}
        </s-paragraph>
        <s-paragraph>Product count: {preAnalysis.productCount}</s-paragraph>
        <s-paragraph>Readiness: {preAnalysis.readiness}</s-paragraph>
        <s-paragraph>{preAnalysis.explanation}</s-paragraph>
      </s-section>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};