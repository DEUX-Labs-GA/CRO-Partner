import { randomUUID } from "node:crypto";
import {
  ExperimentChangeType,
  ExperimentTarget,
  MetricType,
} from "@prisma/client";
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

  const url = new URL(request.url);
  const followUpFrom = url.searchParams.get("followUpFrom");
  const followUpMode = url.searchParams.get("followUpMode");

  let followUpDefaults: {
    sourceExperimentId: string;
    sourceExperimentName: string;
    mode: "RETEST" | "ITERATE";
    name: string;
    hypothesis: string;
    targetProductId: string;
    metricName: string;
    metricType: string;
    target: string;
    changeType: string;
    controlName: string;
    treatmentName: string;
    changeValue: string;
    baselineConversionRate: string;
    minimumDetectableEffect: string;
    significanceLevel: string;
    statisticalPower: string;
  } | null = null;

  if (
    followUpFrom &&
    (followUpMode === "RETEST" || followUpMode === "ITERATE")
  ) {
    const sourceExperiment = await prisma.experiment.findFirst({
      where: {
        id: followUpFrom,
        shop: session.shop,
      },
      include: {
        variants: {
          orderBy: {
            createdAt: "asc",
          },
        },
        metrics: {
          where: {
            isPrimary: true,
          },
          take: 1,
        },
      },
    });

    if (sourceExperiment) {
      const controlVariant =
        sourceExperiment.variants.find(
          (variant) => variant.isControl,
        ) ?? null;

      const treatmentVariant =
        sourceExperiment.variants.find(
          (variant) => !variant.isControl,
        ) ?? null;

      const primaryMetric =
        sourceExperiment.metrics[0] ?? null;

      if (controlVariant && treatmentVariant && primaryMetric) {
        followUpDefaults = {
          sourceExperimentId: sourceExperiment.id,
          sourceExperimentName: sourceExperiment.name,
          mode: followUpMode,
          name:
            followUpMode === "RETEST"
              ? `${sourceExperiment.name} — Retest`
              : `${sourceExperiment.name} — Iteration`,
          hypothesis: sourceExperiment.hypothesis,
          targetProductId:
            sourceExperiment.targetProductId ?? "",
          metricName: primaryMetric.name,
          metricType: primaryMetric.type,
          target: treatmentVariant.target ?? "PRODUCT_TITLE",
          changeType:
            treatmentVariant.changeType ?? "REPLACE_TEXT",
          controlName: controlVariant.name,
          treatmentName: treatmentVariant.name,
          changeValue:
            treatmentVariant.changeValue ??
            treatmentVariant.titleOverride ??
            "",
          baselineConversionRate: String(
            (sourceExperiment.baselineConversionRate ?? 0.05) * 100,
          ),
          minimumDetectableEffect: String(
            sourceExperiment.minimumDetectableEffect * 100,
          ),
          significanceLevel: String(
            sourceExperiment.significanceLevel * 100,
          ),
          statisticalPower: String(
            sourceExperiment.statisticalPower * 100,
          ),
        };
      }
    }
  }

  return {
    trackedProducts,
    followUpDefaults,
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
    const target = String(
      formData.get("target") || "",
    );
    const changeType = String(
      formData.get("changeType") || "",
    );
    const changeValue = String(
      formData.get("changeValue") || "",
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
      !changeValue
    ) {
      return {
        error:
          "Complete every field before saving the experiment.",
      };
    }

    if (
      !Object.values(ExperimentTarget).includes(
        target as ExperimentTarget,
      )
    ) {
      return {
        error: "Select a valid experiment target.",
      };
    }

    if (
      !Object.values(ExperimentChangeType).includes(
        changeType as ExperimentChangeType,
      )
    ) {
      return {
        error: "Select a valid change type.",
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
              target: target as ExperimentTarget,
              changeType:
                changeType as ExperimentChangeType,
              changeValue,
              // Preserve the legacy field while existing
              // title experiments remain supported.
              titleOverride:
                target === ExperimentTarget.PRODUCT_TITLE
                  ? changeValue
                  : null,
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
const {
  trackedProducts,
  followUpDefaults,
} = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const submit = useSubmit();

  return (
    <s-page heading="Create experiment">
      <s-section heading="Experiment details">
        {followUpDefaults ? (
  <div
    style={{
      marginBottom: "20px",
      padding: "14px 16px",
      border: "1px solid #c8c8c8",
      borderRadius: "10px",
      background: "#f7f7f7",
    }}
  >
    <div
      style={{
        fontSize: "12px",
        fontWeight: 700,
        textTransform: "uppercase",
        letterSpacing: "0.04em",
        marginBottom: "5px",
      }}
    >
      {followUpDefaults.mode === "RETEST"
        ? "Retest follow-up"
        : "Iteration follow-up"}
    </div>

    <div
      style={{
        fontSize: "13px",
        lineHeight: 1.5,
      }}
    >
      Starting from{" "}
      <strong>
        {followUpDefaults.sourceExperimentName}
      </strong>
      .{" "}
      {followUpDefaults.mode === "RETEST"
        ? "Use the inherited setup as a reference, but reconsider the hypothesis, treatment, traffic assumptions, and detectable effect before saving."
        : "Use the inherited experiment as a starting point for the next hypothesis. Update the hypothesis and treatment so the new experiment meaningfully tests a new iteration."}
      {" "}
      Nothing will be launched automatically.
    </div>
  </div>
) : null}
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
            value={followUpDefaults?.name ?? ""}
            required
          />

          <s-text-area
            label="Hypothesis"
            name="hypothesis"
            value={followUpDefaults?.hypothesis ?? ""}
            required
          />

            <s-select
              label="Target product"
              name="targetProductId"
              value={followUpDefaults?.targetProductId ?? ""}
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
            value={followUpDefaults?.metricName ?? ""}
            required
          />

            <s-select
              label="Primary metric type"
              name="metricType"
              value={followUpDefaults?.metricType ?? "CONVERSION_RATE"}
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

            <s-select
              label="Experiment target"
              name="target"
              value={followUpDefaults?.target ?? "PRODUCT_TITLE"}
              required
            >
            <s-option value="PRODUCT_TITLE">
              Product title
            </s-option>
            <s-option value="ADD_TO_CART_BUTTON">
              Add to cart button
            </s-option>
          </s-select>

          <input
            type="hidden"
            name="changeType"
            value={followUpDefaults?.changeType ?? "REPLACE_TEXT"}
          />

          <s-text-field
            label="Control variant name"
            name="controlName"
            value={
              followUpDefaults?.controlName ??
              "Original content"
            }
            required
          />

          <s-text-field
            label="Treatment variant name"
            name="treatmentName"
            value={
              followUpDefaults?.treatmentName ??
              "Treatment content"
            }
            required
          />

          <s-text-field
            label="Treatment replacement text"
            name="changeValue"
            value={followUpDefaults?.changeValue ?? ""}
            required
          />

          <p
            style={{
              margin: "8px 0 18px",
              fontSize: "13px",
              color: "#616161",
            }}
          >
            Control keeps the storefront unchanged. Treatment
            replaces the selected target's text with the value
            entered above.
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
