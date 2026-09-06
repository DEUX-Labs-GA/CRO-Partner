import { MetricType } from "@prisma/client";
import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs } from "react-router";
import { redirect, useActionData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import prisma from "../db.server";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  return null;
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();
  const name = String(formData.get("name") || "").trim();
  const hypothesis = String(formData.get("hypothesis") || "").trim();
  const metricName = String(formData.get("metricName") || "").trim();
  const metricType = String(formData.get("metricType") || "");
  const controlName = String(formData.get("controlName") || "").trim();
  const treatmentName = String(formData.get("treatmentName") || "").trim();

  if (!name || !hypothesis || !metricName || !controlName || !treatmentName) {
    return { error: "Complete every field before saving the experiment." };
  }

  if (!Object.values(MetricType).includes(metricType as MetricType)) {
    return { error: "Select a valid primary metric type." };
  }

  const experiment = await prisma.experiment.create({
    data: {
      shop: session.shop,
      name,
      hypothesis,
      variants: {
        create: [
          { name: controlName, isControl: true },
          { name: treatmentName, isControl: false },
        ],
      },
      metrics: {
        create: {
          name: metricName,
          type: metricType as MetricType,
          isPrimary: true,
        },
      },
    },
  });

  return redirect(`/app/experiments/${experiment.id}`);
};

export default function NewExperimentPage() {
  const actionData = useActionData<typeof action>();

  return (
    <s-page heading="Create experiment">
      {actionData?.error && <s-banner tone="critical">{actionData.error}</s-banner>}
      <form method="post">
        <s-section heading="Hypothesis">
          <s-stack direction="block" gap="base">
            <s-text-field label="Experiment name" name="name" required />
            <s-text-area label="Hypothesis" name="hypothesis" required />
          </s-stack>
        </s-section>
        <s-section heading="Primary metric">
          <s-stack direction="block" gap="base">
            <s-text-field label="Metric name" name="metricName" required />
            <s-select label="Metric type" name="metricType" required>
              <s-option value="CONVERSION_RATE">Conversion rate</s-option>
              <s-option value="REVENUE">Revenue</s-option>
              <s-option value="AVERAGE_ORDER_VALUE">Average order value</s-option>
              <s-option value="CUSTOM">Custom</s-option>
            </s-select>
          </s-stack>
        </s-section>
        <s-section heading="Variants">
          <s-stack direction="block" gap="base">
            <s-text-field label="Control variant name" name="controlName" required />
            <s-text-field label="Treatment variant name" name="treatmentName" required />
          </s-stack>
        </s-section>
        <s-button variant="primary" type="submit">Save draft</s-button>
      </form>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};