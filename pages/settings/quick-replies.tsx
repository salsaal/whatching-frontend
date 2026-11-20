"use client";

import { Loader2, Pencil, Plus, Search, Trash2, Zap } from "lucide-react";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AxiosError } from "axios";
import { toast } from "sonner";

import {
  createQuickReply,
  deleteQuickReply,
  listQuickReplies,
  updateQuickReply
} from "@/client-api/functions/quickReplies";
import type { QuickReply } from "@/client-api/types/quickReplies.type";
import { PermissionGate } from "@/components/common/NoAccess";
import { SettingsBackLink } from "@/components/settings/SettingsBackLink";
import { QueryErrorState } from "@/components/shared/QueryErrorState";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useCurrentMembership } from "@/hooks/useCurrentMembership";
import AppLayout from "@/layouts/AppLayout";
import {
  QUICK_REPLY_LIMITS,
  normalizeShortcut,
  shortcutProblem
} from "@/lib/quickReplies";
import { useOrganizationStore } from "@/stores/organizationStore";

type FormState = { shortcut: string; title: string; text: string };

const emptyForm: FormState = { shortcut: "", title: "", text: "" };

const errorMessage = (error: unknown, fallback: string) =>
  (error as AxiosError<{ message?: string }>)?.response?.data?.message ||
  fallback;

function QuickReplyDialog({
  open,
  editing,
  onOpenChange
}: {
  open: boolean;
  editing: QuickReply | null;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const orgId = useOrganizationStore((state) => state.activeOrganization?._id);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [touched, setTouched] = useState(false);
  const [serverError, setServerError] = useState("");
  const [openedFor, setOpenedFor] = useState<string | null | undefined>(
    undefined
  );

  // Reset the form each time the dialog opens, for a new reply or the one
  // being edited.
  const openKey = open ? editing?.id || null : undefined;
  if (openKey !== openedFor) {
    setOpenedFor(openKey);
    if (open) {
      setForm(
        editing
          ? {
              shortcut: editing.shortcut,
              title: editing.title,
              text: editing.text
            }
          : emptyForm
      );
      setTouched(false);
      setServerError("");
    }
  }

  const { mutate: save, isPending } = useMutation({
    mutationFn: (payload: FormState) =>
      editing
        ? updateQuickReply({ id: editing.id, ...payload })
        : createQuickReply(payload),
    meta: { showToast: false },
    onSuccess: async () => {
      toast.success(editing ? "Quick reply saved." : "Quick reply added.");
      await queryClient.invalidateQueries({
        queryKey: ["quick-replies", orgId]
      });
      onOpenChange(false);
    },
    onError: (error) =>
      setServerError(
        errorMessage(error, "The quick reply couldn't be saved. Try again.")
      )
  });

  const problems = {
    shortcut: shortcutProblem(form.shortcut),
    title: form.title.trim() ? "" : "Add a title, like Thank you.",
    text: form.text.trim() ? "" : "Write the message your team will send."
  };
  const hasProblem = Boolean(
    problems.shortcut || problems.title || problems.text
  );

  const submit = () => {
    setTouched(true);
    setServerError("");
    if (hasProblem) return;
    save({
      shortcut: normalizeShortcut(form.shortcut),
      title: form.title.trim(),
      text: form.text
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {editing ? "Edit quick reply" : "Add a quick reply"}
          </DialogTitle>
          <DialogDescription>
            In any chat, type / and the shortcut to put this message in the
            reply box. You can change it before sending.
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="quick-reply-shortcut">Shortcut</Label>
            <div className="flex items-center rounded-md border focus-within:ring-2 focus-within:ring-ring/50">
              <span className="pl-3 text-sm text-muted-foreground">/</span>
              <Input
                id="quick-reply-shortcut"
                value={form.shortcut}
                maxLength={QUICK_REPLY_LIMITS.shortcut + 1}
                placeholder="thanks"
                autoComplete="off"
                className="border-0 pl-1 shadow-none focus-visible:ring-0"
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    shortcut: event.target.value.replace(/^\//, "")
                  }))
                }
              />
            </div>
            {touched && problems.shortcut ? (
              <p className="text-xs text-destructive">{problems.shortcut}</p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Letters, numbers, - and _. No spaces.
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="quick-reply-title">Title</Label>
            <Input
              id="quick-reply-title"
              value={form.title}
              maxLength={QUICK_REPLY_LIMITS.title}
              placeholder="Thank you"
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  title: event.target.value
                }))
              }
            />
            {touched && problems.title && (
              <p className="text-xs text-destructive">{problems.title}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <div className="flex items-baseline justify-between gap-2">
              <Label htmlFor="quick-reply-text">Message</Label>
              <span className="text-xs text-muted-foreground tabular-nums">
                {form.text.length.toLocaleString("en-IN")} /{" "}
                {QUICK_REPLY_LIMITS.text.toLocaleString("en-IN")}
              </span>
            </div>
            <Textarea
              id="quick-reply-text"
              value={form.text}
              maxLength={QUICK_REPLY_LIMITS.text}
              rows={5}
              placeholder="Thanks for reaching out! We'll get back to you shortly."
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  text: event.target.value
                }))
              }
            />
            {touched && problems.text ? (
              <p className="text-xs text-destructive">{problems.text}</p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Instagram messages can be at most 1,000 characters.
              </p>
            )}
          </div>
          {serverError && (
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {serverError}
            </p>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending && <Loader2 className="size-4 animate-spin" />}
              {editing ? "Save changes" : "Add quick reply"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function QuickRepliesContent() {
  const queryClient = useQueryClient();
  const orgId = useOrganizationStore((state) => state.activeOrganization?._id);
  const { isOwnerOrAdmin } = useCurrentMembership();
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<QuickReply | null>(null);
  const [deleting, setDeleting] = useState<QuickReply | null>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["quick-replies", orgId],
    queryFn: () => listQuickReplies(),
    enabled: Boolean(orgId)
  });
  const quickReplies = useMemo(
    () => data?.data.quickReplies || [],
    [data?.data.quickReplies]
  );
  const atLimit = quickReplies.length >= QUICK_REPLY_LIMITS.perWorkspace;

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return quickReplies;
    return quickReplies.filter(
      (reply) =>
        reply.shortcut.includes(normalizeShortcut(q)) ||
        reply.title.toLowerCase().includes(q) ||
        reply.text.toLowerCase().includes(q)
    );
  }, [quickReplies, search]);

  const { mutate: remove, isPending: isDeleting } = useMutation({
    mutationFn: (reply: QuickReply) => deleteQuickReply(reply.id),
    meta: { showToast: false },
    onSuccess: async () => {
      toast.success("Quick reply deleted.");
      setDeleting(null);
      await queryClient.invalidateQueries({
        queryKey: ["quick-replies", orgId]
      });
    },
    onError: (error) =>
      toast.error(
        errorMessage(error, "The quick reply couldn't be deleted. Try again.")
      )
  });

  const openNew = () => {
    setEditing(null);
    setDialogOpen(true);
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <SettingsBackLink />
      <section className="flex flex-col gap-4 rounded-lg bg-white p-5 shadow-xs sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-sm bg-primary/10 text-primary">
            <Zap className="size-5" />
          </div>
          <div>
            <p className="text-sm font-medium text-primary">Settings</p>
            <h1 className="font-heading text-3xl font-semibold">
              Quick replies
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Saved answers your team can use in any chat. Type / in the reply
              box to pick one.
            </p>
          </div>
        </div>
        {isOwnerOrAdmin && quickReplies.length > 0 && (
          <Button
            type="button"
            className="shrink-0"
            disabled={atLimit}
            tooltip={
              atLimit
                ? `You can save up to ${QUICK_REPLY_LIMITS.perWorkspace}. Delete one you no longer use to add another.`
                : undefined
            }
            onClick={openNew}
          >
            <Plus className="size-4" />
            Add quick reply
          </Button>
        )}
      </section>

      <section className="overflow-hidden rounded-lg bg-white shadow-xs">
        {isLoading ? (
          <div className="space-y-3 p-5">
            {Array.from({ length: 3 }).map((_, index) => (
              <Skeleton key={index} className="h-14 rounded-md" />
            ))}
          </div>
        ) : isError ? (
          <div className="p-5">
            <QueryErrorState message="Quick replies could not be loaded. Refresh the page to try again." />
          </div>
        ) : quickReplies.length === 0 ? (
          <div className="flex flex-col items-center px-6 py-12 text-center">
            <div className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Zap className="size-5" />
            </div>
            <h2 className="mt-4 font-heading text-lg font-semibold">
              No quick replies yet
            </h2>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
              Save the answers your team types again and again, like opening
              hours, prices or a thank-you.
            </p>
            {isOwnerOrAdmin ? (
              <Button type="button" className="mt-5" onClick={openNew}>
                <Plus className="size-4" />
                Add your first quick reply
              </Button>
            ) : (
              <p className="mt-4 text-sm text-muted-foreground">
                Your organisation owner or an admin can add them.
              </p>
            )}
          </div>
        ) : (
          <>
            <div className="flex flex-col gap-2 border-b p-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="relative sm:w-72">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search quick replies"
                  className="pl-9"
                  aria-label="Search quick replies"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                {quickReplies.length} of {QUICK_REPLY_LIMITS.perWorkspace} saved
              </p>
            </div>
            {visible.length === 0 ? (
              <p className="p-6 text-center text-sm text-muted-foreground">
                No quick replies match &ldquo;{search.trim()}&rdquo;.
              </p>
            ) : (
              <ul>
                {visible.map((reply, index) => (
                  <li
                    key={reply.id}
                    className={
                      index > 0
                        ? "flex items-start gap-3 border-t p-4"
                        : "flex items-start gap-3 p-4"
                    }
                  >
                    <div className="min-w-0 flex-1">
                      <p className="flex flex-wrap items-baseline gap-x-2">
                        <span className="font-medium text-primary">
                          /{reply.shortcut}
                        </span>
                        <span className="font-medium">{reply.title}</span>
                      </p>
                      <p className="mt-1 line-clamp-2 whitespace-pre-line text-sm text-muted-foreground">
                        {reply.text}
                      </p>
                    </div>
                    {isOwnerOrAdmin && (
                      <div className="flex shrink-0 gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-8 text-muted-foreground"
                          aria-label={`Edit /${reply.shortcut}`}
                          tooltip="Edit"
                          onClick={() => {
                            setEditing(reply);
                            setDialogOpen(true);
                          }}
                        >
                          <Pencil className="size-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-8 text-muted-foreground hover:text-destructive"
                          aria-label={`Delete /${reply.shortcut}`}
                          tooltip="Delete"
                          onClick={() => setDeleting(reply)}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </section>

      <QuickReplyDialog
        open={dialogOpen}
        editing={editing}
        onOpenChange={setDialogOpen}
      />

      <AlertDialog
        open={Boolean(deleting)}
        onOpenChange={(open) => {
          if (!open) setDeleting(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this quick reply?</AlertDialogTitle>
            <AlertDialogDescription>
              /{deleting?.shortcut} will no longer be available to your team.
              Messages already sent aren&apos;t affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              disabled={isDeleting}
              onClick={(event) => {
                event.preventDefault();
                if (deleting) remove(deleting);
              }}
            >
              {isDeleting && <Loader2 className="mr-2 size-4 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default function QuickRepliesSettingsPage() {
  return (
    <AppLayout>
      <PermissionGate permission="conversations:view" feature="Quick replies">
        <QuickRepliesContent />
      </PermissionGate>
    </AppLayout>
  );
}
