const numberFormat = new Intl.NumberFormat("en-IN");

interface ChartTooltipProps {
  active?: boolean;
  label?: string | number;
  payload?: Array<{
    name?: string;
    value?: number | string;
    color?: string;
  }>;
  formatValue?: (value: number) => string;
}

export function ChartTooltip({
  active,
  label,
  payload,
  formatValue
}: ChartTooltipProps) {
  if (!active || !payload || !payload.length) return null;

  return (
    <div className="min-w-36 rounded-md border bg-white p-3 shadow-md">
      {label !== undefined && (
        <p className="mb-2 text-xs font-medium text-muted-foreground">
          {label}
        </p>
      )}
      <div className="space-y-1.5">
        {payload.map((entry, index) => {
          const numericValue =
            typeof entry.value === "number" ? entry.value : Number(entry.value);
          return (
            <div
              key={`${entry.name}-${index}`}
              className="flex items-center justify-between gap-4 text-sm"
            >
              <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                <span
                  className="h-0.5 w-3 rounded-full"
                  style={{ backgroundColor: entry.color }}
                />
                {entry.name}
              </span>
              <span className="font-semibold text-foreground">
                {formatValue && Number.isFinite(numericValue)
                  ? formatValue(numericValue)
                  : numberFormat.format(numericValue)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
