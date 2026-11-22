import {
  Tooltip,
  TooltipContent,
  TooltipTrigger
} from "@/components/ui/tooltip";

/**
 * "Used by Store": the template sends Store messages (order messages or
 * cart reminders). The tooltip names them.
 */
export function StoreUseBadge({ uses }: { uses: string[] }) {
  if (!uses.length) return null;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          tabIndex={0}
          aria-label={`Used by Store: ${uses.join(", ")}`}
          onClick={(event) => event.stopPropagation()}
          className="inline-flex shrink-0 items-center rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium whitespace-nowrap text-primary"
        >
          Used by Store
        </span>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs">
        <p className="font-medium">Sends these Store messages:</p>
        <ul className="mt-1 list-disc pl-4">
          {uses.map((use) => (
            <li key={use}>{use}</li>
          ))}
        </ul>
      </TooltipContent>
    </Tooltip>
  );
}
