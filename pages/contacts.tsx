"use client";

import { Edit3, Plus, Search, Tag, Trash2, Upload, X } from "lucide-react";
import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";

import {
  bulkDeleteSubscribers,
  createTag,
  deleteTag,
  deleteSubscriber,
  getAllSubscribers,
  getTags,
  importSubscribers,
  updateSubscriber
} from "@/api/functions/subscribers";
import { Subscriber, SubscriberPayload } from "@/api/types/subscribers.type";
import ImportSubscribersModal from "@/components/subscribers/ImportSubscribersModal";
import SubscriberModal from "@/components/subscribers/SubscriberModal";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import AppLayout from "@/layouts/AppLayout";
import { cn } from "@/lib/utils";

const formatDate = (date?: string) =>
  date
    ? new Intl.DateTimeFormat("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric"
      }).format(new Date(date))
    : "-";

export default function ContactsPage() {
  const [query, setQuery] = useState("");
  const [selectedSubscriber, setSelectedSubscriber] =
    useState<Subscriber | null>(null);
  const [isSubscriberModalOpen, setIsSubscriberModalOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectedTagFilters, setSelectedTagFilters] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [editingTag, setEditingTag] = useState<string | null>(null);
  const [deleteTagTarget, setDeleteTagTarget] = useState<string | null>(null);
  const [deleteSubscriberTarget, setDeleteSubscriberTarget] =
    useState<Subscriber | null>(null);
  const [isTagsModalOpen, setIsTagsModalOpen] = useState(false);
  const [isBulkDeleteOpen, setIsBulkDeleteOpen] = useState(false);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["subscribers"],
    queryFn: getAllSubscribers,
    refetchOnMount: "always"
  });

  const {
    data: tagsData,
    isLoading: isTagsLoading,
    refetch: refetchTags
  } = useQuery({
    queryKey: ["subscriber-tags"],
    queryFn: getTags,
    refetchOnMount: "always"
  });

  const subscribers = useMemo(
    () => data?.data.subscribers || [],
    [data?.data.subscribers]
  );
  const availableTags = useMemo(
    () => tagsData?.data.tags || [],
    [tagsData?.data.tags]
  );
  const filteredSubscribers = useMemo(() => {
    const value = query.trim().toLowerCase();

    return subscribers.filter((subscriber) => {
      const matchesTags =
        !selectedTagFilters.length ||
        selectedTagFilters.every((tag) => subscriber.tags.includes(tag));

      const matchesQuery =
        !value ||
        [
          subscriber.phoneNumber,
          subscriber.firstName,
          subscriber.lastName,
          subscriber.waId,
          subscriber.tags.join(",")
        ]
          .filter(Boolean)
          .some((item) => String(item).toLowerCase().includes(value));

      return matchesTags && matchesQuery;
    });
  }, [query, selectedTagFilters, subscribers]);
  const selectedVisibleIds = useMemo(
    () =>
      filteredSubscribers
        .filter((subscriber) => selectedIds.includes(subscriber._id))
        .map((subscriber) => subscriber._id),
    [filteredSubscribers, selectedIds]
  );

  const { mutate: saveSubscriber, isPending: isSaving } = useMutation({
    mutationFn: async (payload: SubscriberPayload) => {
      if (selectedSubscriber) {
        return updateSubscriber({
          subscriberId: selectedSubscriber._id,
          payload
        });
      }

      return importSubscribers({
        dryRun: false,
        subscribers: [payload]
      });
    },
    onSuccess: () => {
      setIsSubscriberModalOpen(false);
      setSelectedSubscriber(null);
      refetch();
      refetchTags();
    }
  });

  const { mutate: importBulk, isPending: isImporting } = useMutation({
    mutationFn: (subscribersPayload: SubscriberPayload[]) =>
      importSubscribers({
        dryRun: false,
        subscribers: subscribersPayload
      }),
    onSuccess: () => {
      setIsImportOpen(false);
      refetch();
      refetchTags();
    }
  });

  const { mutate: saveTag, isPending: isSavingTag } = useMutation({
    mutationFn: async (tag: string) => {
      const trimmedTag = tag.trim();
      if (!trimmedTag) return null;

      await createTag(trimmedTag);
      if (editingTag && editingTag !== trimmedTag) {
        await deleteTag(editingTag);
      }

      return null;
    },
    onSuccess: () => {
      setTagInput("");
      setEditingTag(null);
      setIsTagsModalOpen(false);
      refetchTags();
    }
  });

  const { mutate: removeTag, isPending: isDeletingTag } = useMutation({
    mutationFn: deleteTag,
    onSuccess: () => {
      setDeleteTagTarget(null);
      refetchTags();
    }
  });

  const { mutate: deleteSelectedSubscribers, isPending: isDeletingSelected } =
    useMutation({
      mutationFn: bulkDeleteSubscribers,
      onSuccess: () => {
        setSelectedIds([]);
        setIsBulkDeleteOpen(false);
        refetch();
      }
    });

  const { mutate: deleteSingleSubscriber, isPending: isDeletingSubscriber } =
    useMutation({
      mutationFn: deleteSubscriber,
      onSuccess: () => {
        setDeleteSubscriberTarget(null);
        setSelectedIds((current) =>
          current.filter((item) => item !== deleteSubscriberTarget?._id)
        );
        refetch();
      }
    });

  const toggleSubscriber = (subscriberId: string) => {
    setSelectedIds((current) =>
      current.includes(subscriberId)
        ? current.filter((item) => item !== subscriberId)
        : [...current, subscriberId]
    );
  };

  const toggleAllVisible = () => {
    if (selectedVisibleIds.length === filteredSubscribers.length) {
      setSelectedIds((current) =>
        current.filter((item) => !selectedVisibleIds.includes(item))
      );
      return;
    }

    setSelectedIds((current) =>
      Array.from(
        new Set([...current, ...filteredSubscribers.map((item) => item._id)])
      )
    );
  };

  const handleSaveTag = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    saveTag(tagInput);
  };

  const openEditTag = (tag: string) => {
    setEditingTag(tag);
    setTagInput(tag);
    setIsTagsModalOpen(true);
  };

  const resetTagForm = () => {
    setEditingTag(null);
    setTagInput("");
  };

  const toggleTagFilter = (tag: string) => {
    setSelectedTagFilters((current) =>
      current.includes(tag)
        ? current.filter((item) => item !== tag)
        : [...current, tag]
    );
  };

  return (
    <AppLayout>
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="flex flex-col gap-4 rounded-lg bg-white p-5 shadow-xs lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-medium text-primary">Contacts</p>
            <h1 className="mt-1 font-heading text-3xl font-semibold">
              Subscribers
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Manage WhatsApp subscribers, tags, and opt-in records.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            {selectedIds.length > 0 && (
              <Button
                variant="outline"
                className="border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive"
                onClick={() => setIsBulkDeleteOpen(true)}
              >
                <Trash2 className="size-4" />
                Delete selected
              </Button>
            )}
            <Button variant="outline" onClick={() => setIsImportOpen(true)}>
              <Upload className="size-4" />
              Import bulk
            </Button>
            <Button
              onClick={() => {
                setSelectedSubscriber(null);
                setIsSubscriberModalOpen(true);
              }}
            >
              <Plus className="size-4" />
              Add subscriber
            </Button>
          </div>
        </section>

        <section className="rounded-lg bg-white p-4 shadow-xs">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative w-full lg:max-w-md">
              <Search className="absolute left-3 top-3.5 size-4 text-muted-foreground" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search by name, phone, tag"
                className="h-12 rounded-sm border-0 bg-muted/70 pl-9 shadow-none"
              />
            </div>

            <div className="flex gap-2 overflow-x-auto pb-1">
              {isTagsLoading ? (
                <Skeleton className="h-10 w-32 shrink-0" />
              ) : availableTags.length ? (
                availableTags.map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => toggleTagFilter(item)}
                    className={cn(
                      "inline-flex h-10 shrink-0 cursor-pointer items-center gap-2 rounded-sm px-3 text-sm font-medium text-muted-foreground transition",
                      "hover:bg-accent hover:text-accent-foreground",
                      selectedTagFilters.includes(item) &&
                        "bg-primary/10 text-primary shadow-xs"
                    )}
                  >
                    <Tag className="size-4" />
                    {item}
                  </button>
                ))
              ) : (
                <span className="inline-flex h-10 items-center text-sm text-muted-foreground">
                  No tags found
                </span>
              )}
            </div>
          </div>

          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <Checkbox
                checked={
                  filteredSubscribers.length > 0 &&
                  selectedVisibleIds.length === filteredSubscribers.length
                }
                disabled={!filteredSubscribers.length}
                onCheckedChange={toggleAllVisible}
              />
              Select all visible
            </label>
            <Button
              type="button"
              variant="outline"
              className="w-full sm:w-auto"
              onClick={() => {
                resetTagForm();
                setIsTagsModalOpen(true);
              }}
            >
              <Plus className="size-4" />
              Add tag
            </Button>
          </div>
        </section>

        <section className="rounded-lg bg-white p-2 shadow-xs">
          {isLoading ? (
            <div className="space-y-3 p-3">
              {Array.from({ length: 6 }).map((_, index) => (
                <div key={index} className="grid gap-4 md:grid-cols-6">
                  <Skeleton className="h-5" />
                  <Skeleton className="h-5" />
                  <Skeleton className="h-5" />
                  <Skeleton className="h-5" />
                  <Skeleton className="h-5" />
                  <Skeleton className="h-5" />
                </div>
              ))}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-primary">
                    <th className="w-12 p-4"></th>
                    <th className="p-4">Name</th>
                    <th className="p-4">Phone</th>
                    <th className="p-4">Tags</th>
                    <th className="p-4">Opt-in</th>
                    <th className="p-4">Last interaction</th>
                    <th className="p-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSubscribers.map((subscriber) => (
                    <tr key={subscriber._id} className="border-t">
                      <td className="p-4">
                        <Checkbox
                          checked={selectedIds.includes(subscriber._id)}
                          onCheckedChange={() =>
                            toggleSubscriber(subscriber._id)
                          }
                        />
                      </td>
                      <td className="p-4 font-medium">
                        {[subscriber.firstName, subscriber.lastName]
                          .filter(Boolean)
                          .join(" ") || "-"}
                      </td>
                      <td className="p-4">{subscriber.phoneNumber}</td>
                      <td className="p-4">
                        <div className="flex max-w-md flex-wrap gap-2">
                          {subscriber.tags.length ? (
                            subscriber.tags.map((tagName) => (
                              <span
                                key={tagName}
                                className="inline-flex items-center rounded-sm bg-muted px-2 py-1 text-xs"
                              >
                                {tagName}
                              </span>
                            ))
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </div>
                      </td>
                      <td className="p-4">
                        {subscriber.isOptedIn ? "Yes" : "No"}
                      </td>
                      <td className="p-4">
                        {formatDate(subscriber.lastInteraction)}
                      </td>
                      <td className="p-4">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setSelectedSubscriber(subscriber);
                              setIsSubscriberModalOpen(true);
                            }}
                          >
                            <Edit3 className="size-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                            onClick={() =>
                              setDeleteSubscriberTarget(subscriber)
                            }
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      <SubscriberModal
        open={isSubscriberModalOpen}
        subscriber={selectedSubscriber}
        isSaving={isSaving}
        availableTags={availableTags}
        onOpenChange={setIsSubscriberModalOpen}
        onSave={saveSubscriber}
      />

      <ImportSubscribersModal
        open={isImportOpen}
        isImporting={isImporting}
        onOpenChange={setIsImportOpen}
        onImport={importBulk}
      />

      <Dialog
        open={isTagsModalOpen}
        onOpenChange={(open) => {
          setIsTagsModalOpen(open);
          if (!open) resetTagForm();
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingTag ? "Edit tag" : "Add tag"}</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSaveTag} className="space-y-4">
            <Input
              value={tagInput}
              onChange={(event) => setTagInput(event.target.value)}
              placeholder="Tag name"
              className="border-0 bg-muted/70 shadow-none"
            />

            {availableTags.length > 0 && (
              <div className="space-y-2 rounded-sm border p-3">
                <p className="text-sm font-medium">Existing tags</p>
                <div className="flex flex-wrap gap-2">
                  {availableTags.map((item) => (
                    <span
                      key={item}
                      className="inline-flex items-center gap-2 rounded-sm bg-muted px-2.5 py-1.5 text-sm"
                    >
                      {item}
                      <button
                        type="button"
                        className="text-primary"
                        onClick={() => openEditTag(item)}
                      >
                        <Edit3 className="size-3.5" />
                      </button>
                      <button
                        type="button"
                        className="text-destructive"
                        onClick={() => setDeleteTagTarget(item)}
                      >
                        <X className="size-3.5" />
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsTagsModalOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" isLoading={isSavingTag}>
                {editingTag ? "Update tag" : "Create tag"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={Boolean(deleteTagTarget)}
        onOpenChange={(open) => !open && setDeleteTagTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete tag?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes {deleteTagTarget} from the organisation tag list.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              disabled={isDeletingTag}
              onClick={() => {
                if (!deleteTagTarget) return;
                removeTag(deleteTagTarget);
                if (editingTag === deleteTagTarget) resetTagForm();
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={Boolean(deleteSubscriberTarget)}
        onOpenChange={(open) => !open && setDeleteSubscriberTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete subscriber?</AlertDialogTitle>
            <AlertDialogDescription>
              This will delete{" "}
              {[
                deleteSubscriberTarget?.firstName,
                deleteSubscriberTarget?.lastName
              ]
                .filter(Boolean)
                .join(" ") ||
                deleteSubscriberTarget?.phoneNumber ||
                "this subscriber"}
              .
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              disabled={isDeletingSubscriber}
              onClick={() =>
                deleteSubscriberTarget &&
                deleteSingleSubscriber(deleteSubscriberTarget._id)
              }
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={isBulkDeleteOpen} onOpenChange={setIsBulkDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete selected subscribers?</AlertDialogTitle>
            <AlertDialogDescription>
              This will delete {selectedIds.length} selected subscriber
              {selectedIds.length === 1 ? "" : "s"}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              disabled={isDeletingSelected}
              onClick={() => deleteSelectedSubscribers(selectedIds)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
