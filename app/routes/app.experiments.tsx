import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import prisma from "../db.server";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  return prisma.experiment.findMany({
    where: { shop: session.shop },
    include: { metrics: { where: { isPrimary: true }, take: 1 } },
    orderBy: { createdAt: "desc" },
  });
};

export default function ExperimentsPage() {
  const experiments = useLoaderData<typeof loader>();

  return (
    <s-page heading="Experiments">
      <s-button slot="primary-action" href="/app/experiments/new">
        Create experiment
      </s-button>
      {experiments.length === 0 ? (
        <s-section heading="No experiments yet">
          <s-paragraph>
            Create a hypothesis and define its primary metric to start the
            pre-analysis workflow.
          </s-paragraph>
          <s-link href="/app/experiments/new">Create your first experiment</s-link>
        </s-section>
      ) : (
        <s-section heading="Experiment list">
          <s-table>
            <s-table-header-row>
              <s-table-header>Name</s-table-header>
              <s-table-header>Status</s-table-header>
              <s-table-header>Hypothesis</s-table-header>
              <s-table-header>Primary metric</s-table-header>
              <s-table-header>Created</s-table-header>
            </s-table-header-row>
            <s-table-body>
              {experiments.map((experiment) => (
                <s-table-row key={experiment.id}>
                  <s-table-cell>
                    <s-link href={`/app/experiments/${experiment.id}`}>
                      {experiment.name}
                    </s-link>
                  </s-table-cell>
                  <s-table-cell>{experiment.status}</s-table-cell>
                  <s-table-cell>{experiment.hypothesis}</s-table-cell>
                  <s-table-cell>{experiment.metrics[0]?.name ?? "-"}</s-table-cell>
                  <s-table-cell>{experiment.createdAt.toLocaleDateString()}</s-table-cell>
                </s-table-row>
              ))}
            </s-table-body>
          </s-table>
        </s-section>
      )}
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};