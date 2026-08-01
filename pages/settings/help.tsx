"use client";

import { useEffect, useRef } from "react";
import { useInfiniteQuery, useMutation } from "@tanstack/react-query";
import { LifeBuoy, Send } from "lucide-react";
import { FormEvent, useState } from "react";
import { toast } from "sonner";

import {
  createSupportRequest,
  getSupportRequests
} from "@/client-api/functions/organizations";
import {
  SupportRequestCategory,
  SupportRequestPriority
} from "@/client-api/types/organizations.type";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import AppLayout from "@/layouts/AppLayout";
import { useOrganizationStore } from "@/stores/organizationStore";

const categories: Array<{ value: SupportRequestCategory; label: string }> = [
  { value: "technical", label: "Technical issue" },
  { value: "integration", label: "Integration" },
  { value: "billing", label: "Billing" },
  { value: "contact_sync", label: "Contact sync" },
  { value: "plan_limit", label: "Plan limit" },
  { value: "data_recovery", label: "Data recovery" },
  { value: "other", label: "Other" }
];

export default function HelpPage() {
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const activeOrganization = useOrganizationStore(
    (state) => state.activeOrganization
  );
  const [category, setCategory] = useState<SupportRequestCategory>("technical");
  const [priority, setPriority] = useState<SupportRequestPriority>("normal");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");

  const {
    data,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    refetch
  } = useInfiniteQuery({
    queryKey: ["support-requests", activeOrganization?._id],
    queryFn: ({ pageParam }) =>
      getSupportRequests({ page: pageParam, limit: 10 }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      const currentPage = lastPage.pagination.page;
      return currentPage < lastPage.pagination.totalPages
        ? currentPage + 1
        : undefined;
    },
    enabled: Boolean(activeOrganization?._id)
  });

  const { mutate: submitTicket, isPending } = useMutation({
    mutationFn: createSupportRequest,
    onSuccess: async (response) => {
      toast.success(response.message || "Support request created.");
      setSubject("");
      setMessage("");
      setPriority("normal");
      await refetch();
    }
  });

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (subject.trim().length < 3 || message.trim().length < 10) {
      toast.error("Add a subject and at least 10 characters of detail.");
      return;
    }
    submitTicket({
      category,
      priority,
      subject: subject.trim(),
      message: message.trim(),
      context: { page: window.location.pathname }
    });
  };

  const requests =
    data?.pages.flatMap((page) => page.data?.supportRequests || []) || [];

  useEffect(() => {
    const sentinel = loadMoreRef.current;
    if (!sentinel || !hasNextPage) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { rootMargin: "160px 0px" }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  return (
    <AppLayout>
      <div className="mx-auto max-w-6xl space-y-6">
        <section className="flex items-center gap-3">
          <div className="flex size-11 items-center justify-center rounded-sm bg-primary/10 text-primary">
            <LifeBuoy className="size-5" />
          </div>
          <div>
            <p className="text-sm font-medium text-primary">Settings</p>
            <h1 className="font-heading text-3xl font-semibold">
              Help & support
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Send a support request and track its status.
            </p>
          </div>
        </section>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_420px]">
          <form
            onSubmit={handleSubmit}
            className="space-y-4 rounded-lg bg-white p-5 shadow-xs"
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="support-category">Category</Label>
                <select
                  id="support-category"
                  className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                  value={category}
                  onChange={(event) =>
                    setCategory(event.target.value as SupportRequestCategory)
                  }
                >
                  {categories.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="support-priority">Priority</Label>
                <select
                  id="support-priority"
                  className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                  value={priority}
                  onChange={(event) =>
                    setPriority(event.target.value as SupportRequestPriority)
                  }
                >
                  <option value="low">Low</option>
                  <option value="normal">Normal</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="support-subject">Subject</Label>
              <Input
                id="support-subject"
                maxLength={120}
                value={subject}
                onChange={(event) => setSubject(event.target.value)}
                placeholder="What do you need help with?"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="support-message">Details</Label>
              <Textarea
                id="support-message"
                className="min-h-44"
                maxLength={5000}
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                placeholder="Describe what happened and what you expected."
              />
            </div>
            <Button type="submit" isLoading={isPending}>
              <Send className="size-4" />
              Submit ticket
            </Button>
          </form>

          <section className="rounded-lg bg-white p-5 shadow-xs">
            <h2 className="font-heading text-lg font-semibold">
              Recent tickets
            </h2>
            <div className="mt-4 space-y-3">
              {isLoading ? (
                Array.from({ length: 3 }).map((_, index) => (
                  <Skeleton key={index} className="h-20" />
                ))
              ) : requests.length ? (
                requests.map((request) => (
                  <div key={request._id} className="rounded-md border p-3">
                    <div className="flex items-start justify-between gap-3">
                      <p className="line-clamp-2 text-sm font-medium">
                        {request.subject}
                      </p>
                      <Badge variant="outline" className="shrink-0 capitalize">
                        {request.status.replace("_", " ")}
                      </Badge>
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {new Date(request.createdAt).toLocaleString()}
                    </p>
                  </div>
                ))
              ) : (
                <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
                  No support requests yet.
                </p>
              )}
              <div ref={loadMoreRef} className="h-px" />
              {isFetchingNextPage && <Skeleton className="h-20" />}
              {!hasNextPage && requests.length > 0 && (
                <p className="text-center text-xs text-muted-foreground">
                  All tickets are loaded.
                </p>
              )}
            </div>
          </section>
        </div>
      </div>
    </AppLayout>
  );
}
