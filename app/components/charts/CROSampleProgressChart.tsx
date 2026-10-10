export type CROSampleProgressItem = {
  label: string;
  visitors: number;
};

function formatPercent(value: number) {
  return `${value.toFixed(1)}%`;
}

export function CROSampleProgressChart({
  data,
  requiredSamplePerVariant,
}: {
  data: CROSampleProgressItem[];
  requiredSamplePerVariant: number;
}) {
  if (
    data.length === 0 ||
    requiredSamplePerVariant <= 0
  ) {
    return null;
  }

  return (
    <div
      style={{
        display: "grid",
        gap: "18px",
        marginTop: "14px",
      }}
    >
      {data.map((item) => {
        const progress =
          item.visitors /
          requiredSamplePerVariant;

        const progressPercent =
          Math.min(
            100,
            progress * 100,
          );

        const remaining = Math.max(
          0,
          requiredSamplePerVariant -
            item.visitors,
        );

        return (
          <div key={item.label}>
            <div
              style={{
                display: "flex",
                justifyContent:
                  "space-between",
                alignItems: "baseline",
                gap: "16px",
                marginBottom: "8px",
              }}
            >
              <div
                style={{
                  fontWeight: 650,
                  fontSize: "14px",
                }}
              >
                {item.label}
              </div>

              <div
                style={{
                  fontSize: "13px",
                  color: "#616161",
                  textAlign: "right",
                }}
              >
                {item.visitors.toLocaleString()} of{" "}
                {requiredSamplePerVariant.toLocaleString()}{" "}
                visitors
              </div>
            </div>

            <div
              style={{
                position: "relative",
                width: "100%",
                height: "14px",
                borderRadius: "999px",
                background: "#ececec",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  width: `${progressPercent}%`,
                  height: "100%",
                  borderRadius: "999px",
                  background:
                    item.label
                      .toLowerCase()
                      .includes("control")
                      ? "#616161"
                      : "#1473e6",
                  minWidth:
                    item.visitors > 0
                      ? "4px"
                      : "0",
                }}
              />
            </div>

            <div
              style={{
                display: "flex",
                justifyContent:
                  "space-between",
                gap: "16px",
                marginTop: "7px",
                fontSize: "12px",
                color: "#616161",
              }}
            >
              <span>
                {formatPercent(
                  progressPercent,
                )} complete
              </span>

              <span>
                {remaining.toLocaleString()}{" "}
                visitor
                {remaining === 1
                  ? ""
                  : "s"}{" "}
                remaining
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
