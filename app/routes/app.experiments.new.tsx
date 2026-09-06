import { MetricType } from "@prisma/client";
import type { ActionFunctionArgs, HeadersFunction } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import prisma from "../db.server";
import { authenticate } from "../shopify.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session, redirect } = await authenticate.admin(request);
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

export default function NewExperiment() {
  return <div>NEW EXPERIMENT ROUTE WORKS</div>;
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};