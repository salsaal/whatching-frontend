"use client";

import { ChangeEvent, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Brain, FileText, Loader2, RefreshCcw, Trash2, UploadCloud } from "lucide-react";
import { toast } from "sonner";

import {
  createKnowledgeTextSource,
  deleteKnowledgeSource,
  listKnowledgeSources,
  reingestKnowledgeSource,
  uploadKnowledgeSource
} from "@/client-api/functions/bot";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import AppLayout from "@/layouts/AppLayout";
import { useOrganizationStore } from "@/stores/organizationStore";

export default function KnowledgeSettingsPage() {
  const activeOrganization = useOrganizationStore(
    (state) => state.activeOrganization
  );
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [form, setForm] = useState({ title: "", content: "" });

  const { data, refetch, isLoading } = useQuery({
    queryKey: ["bot-knowledge-sources", activeOrganization?._id],
    queryFn: listKnowledgeSources,
    enabled: Boolean(activeOrganization?._id)
  });

  const sources = data?.data?.sources || [];

  const { mutate: createText, isPending: isCreating } = useMutation({
    mutationFn: createKnowledgeTextSource,
    onSuccess: () => {
      setForm({ title: "", content: "" });
      toast.success("Knowledge source added.");
      refetch();
    }
  });

  const { mutate: uploadFile, isPending: isUploading } = useMutation({
    mutationFn: uploadKnowledgeSource,
    onSuccess: () => {
      toast.success("File source uploaded.");
      refetch();
    }
  });

  const { mutate: deleteSource } = useMutation({
    mutationFn: deleteKnowledgeSource,
    onSuccess: () => {
      toast.success("Knowledge source deleted.");
      refetch();
    }
  });

  const { mutate: reingestSource } = useMutation({
    mutationFn: reingestKnowledgeSource,
    onSuccess: () => {
      toast.success("Knowledge source queued for re-ingestion.");
      refetch();
    }
  });

  const handleFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append("file", file);
    formData.append("title", file.name);
    uploadFile(formData);
    event.target.value = "";
  };

  return (
    <AppLayout>
      <div className="mx-auto max-w-6xl space-y-6">
        <section className="rounded-lg bg-white p-5 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-sm bg-primary/10 text-primary">
              <Brain className="size-5" />
            </div>
            <div>
              <p className="text-sm font-medium text-primary">Settings</p>
              <h1 className="font-heading text-3xl font-semibold">
                Knowledge Source
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Manage support content used by AI fallback and internal answers.
              </p>
            </div>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-[420px_1fr]">
          <Card className="rounded-lg">
            <CardContent className="space-y-3 p-5">
              <p className="font-heading text-xl font-semibold">
                Add text source
              </p>
              <Input
                placeholder="Source title"
                value={form.title}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    title: event.target.value
                  }))
                }
              />
              <Textarea
                placeholder="Paste policy, FAQ, support script, or product details"
                className="min-h-44"
                value={form.content}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    content: event.target.value
                  }))
                }
              />
              <Button
                className="w-full cursor-pointer"
                disabled={isCreating || !form.title.trim() || !form.content.trim()}
                onClick={() =>
                  createText({
                    type: "text",
                    title: form.title,
                    content: form.content
                  })
                }
              >
                {isCreating && <Loader2 className="mr-2 size-4 animate-spin" />}
                Add text source
              </Button>

              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={handleFile}
              />
              <Button
                variant="outline"
                className="w-full cursor-pointer"
                disabled={isUploading}
                onClick={() => fileInputRef.current?.click()}
              >
                {isUploading ? (
                  <Loader2 className="mr-2 size-4 animate-spin" />
                ) : (
                  <UploadCloud className="mr-2 size-4" />
                )}
                Upload file source
              </Button>
            </CardContent>
          </Card>

          <div className="space-y-3">
            {isLoading ? (
              <Card className="rounded-lg">
                <CardContent className="p-5 text-sm text-muted-foreground">
                  Loading knowledge sources...
                </CardContent>
              </Card>
            ) : sources.length ? (
              sources.map((source) => (
                <Card key={source._id} className="rounded-lg">
                  <CardContent className="flex items-center gap-4 p-4">
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-sm bg-primary/10 text-primary">
                      <FileText className="size-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate font-medium">{source.title}</p>
                        <Badge variant="secondary" className="capitalize">
                          {source.type}
                        </Badge>
                        <Badge className="capitalize">{source.status}</Badge>
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {source.filename || `${source.chunkCount || 0} chunks`}
                      </p>
                    </div>
                    <Button
                      size="icon"
                      variant="outline"
                      className="cursor-pointer"
                      onClick={() => reingestSource(source._id)}
                    >
                      <RefreshCcw className="size-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="outline"
                      className="cursor-pointer text-destructive hover:text-destructive"
                      onClick={() => deleteSource(source._id)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </CardContent>
                </Card>
              ))
            ) : (
              <Card className="rounded-lg">
                <CardContent className="p-5 text-sm text-muted-foreground">
                  No knowledge sources yet.
                </CardContent>
              </Card>
            )}
          </div>
        </section>
      </div>
    </AppLayout>
  );
}
