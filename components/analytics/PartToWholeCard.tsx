const numberFormat = new Intl.NumberFormat("en-IN");

export interface PartToWholeSegment {
  name: string;
  value: number;
  color: string;
}

export function PartToWholeCard({
  title,
  data,
  emptyMessage
}: {
  title: string;
  data: PartToWholeSegment[];
  emptyMessage?: string;
}) {
  const total = data.reduce((sum, item) => sum + item.value, 0);

  return (
    <div className="rounded-lg bg-white p-5 shadow-xs">
      <h2 className="font-heading text-lg font-semibold">{title}</h2>

      {total === 0 ? (
        <div className="mt-6 rounded-sm bg-muted/50 p-6 text-center text-sm text-muted-foreground">
          {emptyMessage || "No data for this range."}
        </div>
      ) : (
        <>
          <div className="mt-5 flex h-3 w-full overflow-hidden rounded-full bg-muted">
            {data.map(
              (item) =>
                item.value > 0 && (
                  <div
                    key={item.name}
                    style={{
                      width: `${(item.value / total) * 100}%`,
                      backgroundColor: item.color
                    }}
                    className="h-full border-r-2 border-white last:border-r-0"
                    title={`${item.name}: ${numberFormat.format(item.value)}`}
                  />
                )
            )}
          </div>

          <div className="mt-4 space-y-2">
            {data.map((item) => (
              <div
                key={item.name}
                className="flex items-center justify-between gap-2 text-sm"
              >
                <span className="inline-flex items-center gap-2 text-muted-foreground">
                  <span
                    className="size-2 shrink-0 rounded-full"
                    style={{ backgroundColor: item.color }}
                  />
                  {item.name}
                </span>
                <span className="font-semibold text-foreground">
                  {numberFormat.format(item.value)}
                  <span className="ml-1.5 font-normal text-muted-foreground">
                    ({Math.round((item.value / total) * 100)}%)
                  </span>
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
