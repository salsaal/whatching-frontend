import { ArrowLeft, Ban, Check, ChevronDown, Plus } from "lucide-react";
import { useState } from "react";

import { BotBlockType } from "@/client-api/types/bot.type";
import { BotFlowReactNode } from "@/components/flows/BotFlowNode";
import {
  blockPalette,
  getBlockIcon,
  getBlockLabel,
  outlineOrder
} from "@/components/flows/FlowBlockLibrary";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

// Names longer than this may be cut off in the list; they get a tooltip.
const LONG_NAME = 40;

// Matches the search against an item's keywords (name and type), not its
// value, which is an ID.
const filterByKeywords = (
  _value: string,
  search: string,
  keywords?: string[]
) =>
  (keywords || []).join(" ").toLowerCase().includes(search.trim().toLowerCase())
    ? 1
    : 0;

/** The least a block needs to be listed: WhatsApp's or Instagram's. */
export type PickerBlock<T extends string> = {
  id: string;
  hidden?: boolean;
  data: { label: string; blockType: T };
};

export type PickerPalette<T extends string> = Array<{
  group: string;
  items: Array<{ type: T; label: string; icon: React.ElementType }>;
}>;

/**
 * The "Go to block" picker on the Next steps tab: one control to pick an
 * existing block or create a new one. Styled like the selects around it.
 * WhatsApp's block types are the default; Instagram passes its own.
 */
export function FlowBlockPicker<
  T extends string = BotBlockType,
  B extends PickerBlock<T> = PickerBlock<T>
>({
  value,
  blocks,
  currentBlockId,
  disabled,
  actionId,
  onSelect,
  onCreate,
  onClear,
  palette,
  getIcon,
  getLabel,
  order
}: {
  /** The block this option goes to now. */
  value?: string;
  blocks: B[];
  /** The block being edited; listed last, as "This block". */
  currentBlockId: string;
  disabled?: boolean;
  /** Lets an issue about this option focus the picker. */
  actionId?: string;
  onSelect: (nodeId: string) => void;
  onCreate: (type: T) => void;
  /** Offers "Nothing", which removes the wire. */
  onClear?: () => void;
  palette?: PickerPalette<T>;
  getIcon?: (type: T) => React.ElementType;
  getLabel?: (type: T) => string;
  /** The order blocks are listed in. */
  order?: (blocks: B[]) => B[];
}) {
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const iconFor =
    getIcon || (getBlockIcon as unknown as (type: T) => React.ElementType);
  const labelFor =
    getLabel || (getBlockLabel as unknown as (type: T) => string);
  const types = palette || (blockPalette as unknown as PickerPalette<T>);
  const ordered = order
    ? order(blocks)
    : (outlineOrder(blocks as unknown as BotFlowReactNode[]) as unknown as B[]);
  const others = ordered.filter((node) => node.id !== currentBlockId);
  const current = ordered.find((node) => node.id === currentBlockId);
  const selected = blocks.find((node) => node.id === value);
  const SelectedIcon = selected ? iconFor(selected.data.blockType) : null;

  const close = () => {
    setOpen(false);
    setCreating(false);
  };

  const renderBlock = (node: B, isCurrent = false) => {
    const Icon = iconFor(node.data.blockType);
    const name = isCurrent ? "This block" : node.data.label;
    return (
      <CommandItem
        key={node.id}
        value={node.id}
        keywords={[
          node.data.label,
          labelFor(node.data.blockType),
          ...(isCurrent ? ["this block"] : [])
        ]}
        className={cn(isCurrent && "text-muted-foreground")}
        onSelect={() => {
          onSelect(node.id);
          close();
        }}
      >
        <Icon className="size-4 shrink-0" />
        <span
          className="min-w-0 flex-1 truncate"
          title={name.length > LONG_NAME ? name : undefined}
        >
          {name}
        </span>
        {value === node.id && <Check className="size-4 shrink-0" />}
      </CommandItem>
    );
  };

  return (
    <Popover
      open={open}
      onOpenChange={(next) => (next ? setOpen(true) : close())}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          data-action-id={actionId}
          aria-label="Go to block"
          className="flex h-8 w-full min-w-0 cursor-pointer items-center gap-2 rounded-md border border-input bg-white px-3 text-left text-sm shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {selected && SelectedIcon ? (
            <>
              <SelectedIcon className="size-4 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1 truncate">
                {selected.id === currentBlockId
                  ? "This block"
                  : selected.data.label}
              </span>
            </>
          ) : (
            <span className="min-w-0 flex-1 truncate text-muted-foreground">
              Choose a block
            </span>
          )}
          <ChevronDown className="size-4 shrink-0 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-[max(var(--radix-popover-trigger-width),320px)] p-0"
      >
        {creating ? (
          <Command filter={filterByKeywords}>
            <div className="flex items-center border-b pl-1 [&_[data-slot=command-input-wrapper]]:flex-1 [&_[data-slot=command-input-wrapper]]:border-b-0 [&_[data-slot=command-input-wrapper]]:pl-1">
              <button
                type="button"
                aria-label="Back to blocks"
                className="flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-md text-muted-foreground hover:bg-muted"
                onClick={() => setCreating(false)}
              >
                <ArrowLeft className="size-4" />
              </button>
              <CommandInput autoFocus placeholder="New block: search types" />
            </div>
            <CommandList className="max-h-80">
              <CommandEmpty>No block type matches.</CommandEmpty>
              {types.map((group) => (
                <CommandGroup key={group.group} heading={group.group}>
                  {group.items.map((item) => (
                    <CommandItem
                      key={item.type}
                      value={item.type}
                      keywords={[item.label, group.group]}
                      onSelect={() => {
                        onCreate(item.type);
                        close();
                      }}
                    >
                      <item.icon className="size-4 shrink-0" />
                      {item.label}
                    </CommandItem>
                  ))}
                </CommandGroup>
              ))}
            </CommandList>
          </Command>
        ) : (
          <Command filter={filterByKeywords}>
            <CommandInput placeholder="Search by name or type" />
            <CommandList className="max-h-80">
              <CommandEmpty>No block matches.</CommandEmpty>
              <CommandGroup>
                {onClear && (
                  <CommandItem
                    value="__no_block"
                    keywords={["nothing", "none"]}
                    className="text-muted-foreground"
                    onSelect={() => {
                      onClear();
                      close();
                    }}
                  >
                    <Ban className="size-4 shrink-0" />
                    <span className="min-w-0 flex-1 truncate">Nothing</span>
                    {!value && <Check className="size-4 shrink-0" />}
                  </CommandItem>
                )}
                {others.map((node) => renderBlock(node))}
                {current && renderBlock(current, true)}
              </CommandGroup>
              <CommandItem
                forceMount
                value="__create_block"
                className="sticky bottom-0 rounded-none border-t bg-popover"
                onSelect={() => setCreating(true)}
              >
                <Plus className="size-4 shrink-0" />
                Create a new block…
              </CommandItem>
            </CommandList>
          </Command>
        )}
      </PopoverContent>
    </Popover>
  );
}
