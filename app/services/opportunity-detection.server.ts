export type OpportunityConfidence =
  | "LOW"
  | "MEDIUM"
  | "HIGH";

export type OpportunityImpact =
  | "LOW"
  | "MEDIUM"
  | "HIGH";

export type FunnelOpportunity = {
  ruleId:
    | "PDP_TO_CART_DROPOFF"
    | "CART_TO_CHECKOUT_DROPOFF"
    | "CHECKOUT_TO_PURCHASE_DROPOFF";
  title: string;
  observation: string;
  evidence: string;
  hypothesis: string;
  recommendation: string;
  confidence: OpportunityConfidence;
  potentialImpact: {
    level: OpportunityImpact;
    affectedVisitors: number;
    affectedShare: number;
  };
};

export type OpportunityFunnelStep = {
  eventName:
    | "product_viewed"
    | "product_added_to_cart"
    | "checkout_started"
    | "checkout_completed";
  label: string;
  visitors: number;
  rateFromPrevious: number | null;
  dropOffFromPrevious: number | null;
  dropOffRateFromPrevious: number | null;
};

export type OpportunityFunnelInput = {
  trackedVisitors: number;
  steps: OpportunityFunnelStep[];
};

type RuleDefinition = {
  ruleId: FunnelOpportunity["ruleId"];
  fromEvent: OpportunityFunnelStep["eventName"];
  toEvent: OpportunityFunnelStep["eventName"];
  minimumFromVisitors: number;
  minimumDropOffRate: number;
  title: string;
  hypothesis: string;
  recommendation: string;
};

const RULES: RuleDefinition[] = [
  {
    ruleId: "PDP_TO_CART_DROPOFF",
    fromEvent: "product_viewed",
    toEvent: "product_added_to_cart",
    minimumFromVisitors: 20,
    minimumDropOffRate: 0.7,
    title: "High product-view to add-to-cart drop-off",
    hypothesis:
      "The product page may not be giving enough clarity, value, trust, or purchase motivation for visitors to add the product to cart.",
    recommendation:
      "Review the product page value proposition, imagery, pricing context, trust signals, product details, and add-to-cart CTA for testable friction.",
  },
  {
    ruleId: "CART_TO_CHECKOUT_DROPOFF",
    fromEvent: "product_added_to_cart",
    toEvent: "checkout_started",
    minimumFromVisitors: 10,
    minimumDropOffRate: 0.5,
    title: "High add-to-cart to checkout drop-off",
    hypothesis:
      "Visitors may be encountering friction or uncertainty after adding the product to cart and before beginning checkout.",
    recommendation:
      "Review cart messaging, shipping and cost clarity, checkout CTA prominence, distractions, and cart-level trust signals.",
  },
  {
    ruleId: "CHECKOUT_TO_PURCHASE_DROPOFF",
    fromEvent: "checkout_started",
    toEvent: "checkout_completed",
    minimumFromVisitors: 10,
    minimumDropOffRate: 0.4,
    title: "High checkout-start to purchase drop-off",
    hypothesis:
      "Visitors who begin checkout may be encountering cost, trust, payment, or completion friction before purchase.",
    recommendation:
      "Review checkout abandonment drivers such as unexpected costs, payment options, delivery expectations, errors, and trust concerns.",
  },
];

export function detectFunnelOpportunities(
  funnel: OpportunityFunnelInput,
): FunnelOpportunity[] {
  if (funnel.trackedVisitors <= 0) {
    return [];
  }

  const opportunities: FunnelOpportunity[] = [];

  for (const rule of RULES) {
    const fromStep = funnel.steps.find(
      (step) => step.eventName === rule.fromEvent,
    );

    const toStep = funnel.steps.find(
      (step) => step.eventName === rule.toEvent,
    );

    if (!fromStep || !toStep) {
      continue;
    }

    const dropOffRate =
      toStep.dropOffRateFromPrevious;

    const affectedVisitors =
      toStep.dropOffFromPrevious;

    if (
      dropOffRate === null ||
      affectedVisitors === null ||
      fromStep.visitors < rule.minimumFromVisitors ||
      dropOffRate < rule.minimumDropOffRate
    ) {
      continue;
    }

    const affectedShare =
      affectedVisitors / funnel.trackedVisitors;

    opportunities.push({
      ruleId: rule.ruleId,
      title: rule.title,
      observation:
        `${formatPercent(dropOffRate)} of tracked visitors dropped between ` +
        `${fromStep.label.toLowerCase()} and ${toStep.label.toLowerCase()}.`,
      evidence:
        `${fromStep.visitors.toLocaleString()} visitors reached ` +
        `${fromStep.label.toLowerCase()}, ${toStep.visitors.toLocaleString()} ` +
        `reached ${toStep.label.toLowerCase()}, and ` +
        `${affectedVisitors.toLocaleString()} did not progress.`,
      hypothesis: rule.hypothesis,
      recommendation: rule.recommendation,
      confidence: confidenceForSample(
        fromStep.visitors,
      ),
      potentialImpact: {
        level: impactForShare(affectedShare),
        affectedVisitors,
        affectedShare,
      },
    });
  }

  return opportunities.sort((a, b) => {
    if (
      b.potentialImpact.affectedVisitors !==
      a.potentialImpact.affectedVisitors
    ) {
      return (
        b.potentialImpact.affectedVisitors -
        a.potentialImpact.affectedVisitors
      );
    }

    return (
      b.potentialImpact.affectedShare -
      a.potentialImpact.affectedShare
    );
  });
}

function confidenceForSample(
  visitors: number,
): OpportunityConfidence {
  if (visitors >= 100) {
    return "HIGH";
  }

  if (visitors >= 50) {
    return "MEDIUM";
  }

  return "LOW";
}

function impactForShare(
  share: number,
): OpportunityImpact {
  if (share >= 0.5) {
    return "HIGH";
  }

  if (share >= 0.25) {
    return "MEDIUM";
  }

  return "LOW";
}

function formatPercent(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}
