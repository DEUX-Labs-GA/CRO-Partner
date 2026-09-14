import { randomUUID } from "node:crypto";
import { MetricType } from "@prisma/client";
import {
  useActionData,
  useLoaderData,
  useSubmit,
} from "react-router";
import type {
  ActionFunctionArgs,
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import prisma from "../db.server";
import { authenticate } from "../shopify.server";
import { loadTrackedProducts } from "../services/tracked-products.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);

  const trackedProducts = await loadTrackedProducts(session.shop);

  return {
    trackedProducts,
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  try {
    const auth = await authenticate.admin(request);
    const formData = await request.formData();

    const name = String(formData.get("name") || "").trim();
    const hypothesis = String(
      formData.get("hypothesis") || "",
    ).trim();
    const metricName = String(
      formData.get("metricName") || "",
    ).trim();
    const metricType = String(
      formData.get("metricType") || "",
    );
    const targetProductId = String(
      formData.get("targetProductId") || "",
    ).trim();
    const controlName = String(
      formData.get("controlName") || "",
    ).trim();
    const treatmentName = String(
      formData.get("treatmentName") || "",
    ).trim();
    const treatmentTitle = String(
      formData.get("treatmentTitle") || "",
    ).trim();

    const baselineConversionRate =
      Number(formData.get("baselineConversionRate")) / 100;
    const minimumDetectableEffect =
      Number(formData.get("minimumDetectableEffect")) / 100;
    const significanceLevel =
      Number(formData.get("significanceLevel")) / 100;
    const statisticalPower =
      Number(formData.get("statisticalPower")) / 100;

    if (
      !name ||
      !hypothesis ||
      !metricName ||
      !targetProductId ||
      !controlName ||
      !treatmentName ||
      !treatmentTitle
    ) {
      return {
        error:
          "Complete every field before saving the experiment.",
      };
    }

    if (
      !Object.values(MetricType).includes(
        metricType as MetricType,
      )
    ) {
      return {
        error: "Select a valid primary metric type.",
      };
    }

    if (
      !Number.isFinite(baselineConversionRate) ||
      baselineConversionRate <= 0 ||
      baselineConversionRate >= 1 ||
      !Number.isFinite(minimumDetectableEffect) ||
      minimumDetectableEffect <= 0 ||
      !Number.isFinite(significanceLevel) ||
      significanceLevel <= 0 ||
      significanceLevel >= 1 ||
      !Number.isFinite(statisticalPower) ||
      statisticalPower <= 0 ||
      statisticalPower >= 1
    ) {
      return {
        error:
          "Enter valid feasibility assumptions as percentages.",
      };
    }

    /*
     * Only allow products CRO Partner has actually observed
     * in this shop's product-view event stream.
     */
    const trackedProducts = await loadTrackedProducts(
      auth.session.shop,
    );

    const targetProduct = trackedProducts.find(
      (product) => product.productId === targetProductId,
    );

    if (!targetProduct) {
      return {
        error:
          "Select a valid tracked product for this experiment.",
      };
    }

    const experiment = await prisma.experiment.create({
      data: {
        shop: auth.session.shop,
        name,
        hypothesis,
        trackingKey: `experiment-${randomUUID()}`,
        targetProductId,
        baselineConversionRate,
        minimumDetectableEffect,
        significanceLevel,
        statisticalPower,
        variants: {
          create: [
            {
              name: controlName,
              isControl: true,
              titleOverride: null,
            },
            {
              name: treatmentName,
              isControl: false,
              titleOverride: treatmentTitle,
            },
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

    return auth.redirect(
      `/app/experiments/${experiment.id}`,
    );
  } catch (error) {
    console.error("CREATE ACTION ERROR", error);
    throw error;
  }
};

export default function NewExperiment() {
  const { trackedProducts } =
    useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const submit = useSubmit();

  return (
    <s-page heading="Create experiment">
      <s-section heading="Experiment details">
        {actionData?.error ? (
          <p style={{ color: "red" }}>
            {actionData.error}
          </p>
        ) : null}

        {trackedProducts.length === 0 ? (
          <p>
            No tracked products are available yet. Visit a
            product page on the storefront so CRO Partner can
            observe it before creating an experiment.
          </p>
        ) : null}

        <form
          onSubmit={(event) => {
            event.preventDefault();

            const formData = new FormData(
              event.currentTarget,
            );

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

          <s-select
            label="Target product"
            name="targetProductId"
            required
          >
            <s-option value="">
              Select a product
            </s-option>

            {trackedProducts.map((product) => (
              <s-option
                key={product.productId}
                value={product.productId}
              >
                {product.label}
              </s-option>
            ))}
          </s-select>

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
            <s-option value="CONVERSION_RATE">
              Conversion rate
            </s-option>
            <s-option value="REVENUE">
              Revenue
            </s-option>
            <s-option value="AVERAGE_ORDER_VALUE">
              Average order value
            </s-option>
            <s-option value="CUSTOM">
              Custom
            </s-option>
          </s-select>

          <s-text-field
            label="Control variant name"
            name="controlName"
            value="Original product title"
            required
          />

          <s-text-field
            label="Treatment variant name"
            name="treatmentName"
            value="Treatment product title"
            required
          />

          <s-text-field
            label="Treatment product title"
            name="treatmentTitle"
            required
          />

          <p
            style={{
              margin: "8px 0 18px",
              fontSize: "13px",
              color: "#616161",
            }}
          >
            Control keeps the product's original title.
            Treatment replaces it with the title entered above.
          </p>

          <s-number-field
            label="Baseline conversion rate (%) - merchant-provided"
            name="baselineConversionRate"
            value="5"
            min={0.01}
            max={99.99}
            step={0.01}
            required
          />

          <s-number-field
            label="Minimum detectable effect (relative improvement, %)"
            name="minimumDetectableEffect"
            value="20"
            min={0.01}
            step={0.01}
            required
          />

          <s-number-field
            label="Significance level (%)"
            name="significanceLevel"
            value="95"
            min={0.01}
            max={99.99}
            step={0.01}
            required
          />

          <s-number-field
            label="Statistical power (%)"
            name="statisticalPower"
            value="80"
            min={0.01}
            max={99.99}
            step={0.01}
            required
          />

          <button
            type="submit"
            disabled={trackedProducts.length === 0}
          >
            Save experiment
          </button>
        </form>
      </s-section>
    </s-page>
  );
}

export const headers: HeadersFunction = (
  headersArgs,
) => {
  return boundary.headers(headersArgs);
};
