import { MetricType } from "@prisma/client";
import { useActionData, useSubmit } from "react-router";
import type { ActionFunctionArgs, HeadersFunction } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import prisma from "../db.server";
import { authenticate } from "../shopify.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  console.log("CREATE ACTION START", {
    method: request.method,
    url: request.url,
    contentType: request.headers.get("content-type"),
  });

  try {
    const auth = await authenticate.admin(request);

    console.log("CREATE AUTH OK", {
      shop: auth.session.shop,
    });

    const formData = await request.formData();

    console.log("CREATE FORM DATA", {
      keys: Array.from(formData.keys()),
    });

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
        shop: auth.session.shop,
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

    console.log("CREATE SUCCESS", experiment.id);

    return auth.redirect(`/app/experiments/${experiment.id}`);
  } catch (error) {
    console.error("CREATE ACTION ERROR", error);
    throw error;
  }
};

export default function NewExperiment() {
  const actionData = useActionData<typeof action>();
  const submit = useSubmit();

  return (
    <s-page heading="Create experiment">
      <s-section heading="Experiment details">
        {actionData?.error ? (
          <p style={{ color: "red" }}>{actionData.error}</p>
        ) : null}
        <form
          onSubmit={(event) => {
            event.preventDefault();

            const formData = new FormData(event.currentTarget);

            submit(formData, {
              method: "post",
              action: "/app/experiments/new",
            });
          }}
        >
          <s-text-field
            label="Experiment name"
            name="name"
            required
          />

          <s-text-area
            label="Hypothesis"
            name="hypothesis"
            required
          />

          <s-text-field
            label="Primary metric name"
            name="metricName"
            required
          />

<s-select
  label="Primary metric type"
  name="metricType"
  required
>
  <s-option value="CONVERSION_RATE">Conversion rate</s-option>
  <s-option value="REVENUE">Revenue</s-option>
  <s-option value="AVERAGE_ORDER_VALUE">Average order value</s-option>
  <s-option value="CUSTOM">Custom</s-option>
</s-select>

          <s-text-field
            label="Control variant name"
            name="controlName"
            required
          />

          <s-text-field
            label="Treatment variant name"
            name="treatmentName"
            required
          />

          <button type="submit">Save experiment</button>
        </form>
      </s-section>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};