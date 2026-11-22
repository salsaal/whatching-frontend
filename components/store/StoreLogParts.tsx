import {
  ChevronLeft,
  ChevronRight,
  Loader2,
  type LucideIcon
} from "lucide-react";
import { useRouter } from "next/router";
import { type ReactNode, useState } from "react";
import { toast } from "sonner";

import { getSubscriberById } from "@/client-api/functions/subscribers";
import { Button } from "@/components/ui/button";
import { formatCount } from "@/lib/displayFormat";

/**
 * A name in the order or cart log, opening that person's chat. The log
 * only carries the contact's id, so the contact is looked up on click.
 * Without an id it's plain text.
 */
export function StoreContactLink({
  name,
  subscriberId,
  noun = "customer"
}: {
  name: string;
  subscriberId?: string | null;
  /** "customer" or "shopper", for the tooltip and the error. */
  noun?: string;
}) {
  const router = useRouter();
  const [isOpening, setIsOpening] = useState(false);
  if (!subscriberId) return <span>{name}</span>;

  const open = async () => {
    setIsOpening(true);
    try {
      const response = await getSubscriberById(subscriberId);
      const contact = response.data.subscriber;
      const search =
        contact.phoneNumber ||
        [contact.firstName, contact.lastName].filter(Boolean).join(" ") ||
        name;
      await router.push(`/conversations?search=${encodeURIComponent(search)}`);
    } catch {
      toast.error(`This ${noun}'s chat couldn't be opened.`);
      setIsOpening(false);
    }
  };

  return (
    <button
      type="button"
      onClick={open}
      disabled={isOpening}
      className="inline-flex cursor-pointer items-center gap-1 text-left font-medium text-primary hover:underline disabled:cursor-wait"
      title={`Open this ${noun}'s chat`}
    >
      {name}
      {isOpening && <Loader2 className="size-3 animate-spin" />}
    </button>
  );
}

/** "Page 1 of 3 · 60 orders" with Previous and Next; only past one page. */
export function StoreLogPagination({
  page,
  pageSize,
  total,
  noun,
  onPageChange
}: {
  page: number;
  pageSize: number;
  total: number;
  /** Plural, e.g. "orders". */
  noun: string;
  onPageChange: (page: number) => void;
}) {
  if (total <= pageSize) return null;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  return (
    <div className="flex items-center justify-between gap-3 border-t px-4 py-3 text-sm text-muted-foreground sm:px-5">
      <span>
        Page {page} of {pageCount} · {formatCount(total)} {noun}
      </span>
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={page <= 1}
          onClick={() => onPageChange(Math.max(1, page - 1))}
        >
          <ChevronLeft className="size-4" />
          Previous
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={page >= pageCount}
          onClick={() => onPageChange(Math.min(pageCount, page + 1))}
        >
          Next
          <ChevronRight className="size-4" />
        </Button>
      </div>
    </div>
  );
}

/** An empty list: an icon in a soft circle above the explanation. */
export function StoreEmptyState({
  icon: Icon,
  children
}: {
  icon: LucideIcon;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed bg-white px-6 py-10 text-center">
      <span className="flex size-11 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Icon className="size-5" />
      </span>
      <p className="max-w-sm text-sm text-muted-foreground">{children}</p>
    </div>
  );
}
