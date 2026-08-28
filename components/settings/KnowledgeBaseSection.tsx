import { ChangeEvent, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Eye,
  FileText,
  HelpCircle,
  Loader2,
  Plus,
  RefreshCcw,
  Trash2,
  UploadCloud,
  X
} from "lucide-react";
import { toast } from "sonner";

import {
  createKnowledgeTextSource,
  deleteKnowledgeSource,
  listKnowledgeSources,
  reingestKnowledgeSource,
  uploadKnowledgeSource
} from "@/client-api/functions/bot";
import { KnowledgeSource } from "@/client-api/types/bot.type";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import { ListLoadingSkeleton } from "@/components/ui/loading-skeletons";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useOrganizationStore } from "@/stores/organizationStore";

type SourceFormType = "text" | "faq" | "file";

const emptyFaqEntry = () => ({ question: "", answer: "" });

const formatDate = (value?: string) =>
  value
    ? new Intl.DateTimeFormat("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
      }).format(new Date(value))
    : "-";

const sourceIcon = (type: KnowledgeSource["type"]) =>
  type === "faq" ? HelpCircle : FileText;

export function KnowledgeBaseSection() {
  const activeOrganization = useOrganizationStore(
    (state) => state.activeOrganization
  );
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [sourceType, setSourceType] = useState<SourceFormType>("text");
  const [form, setForm] = useState({ title: "", content: "" });
  const [sourceFile, setSourceFile] = useState<File | null>(null);
  const [faqEntries, setFaqEntries] = useState([emptyFaqEntry()]);
  const [selectedSource, setSelectedSource] = useState<KnowledgeSource | null>(
    null
  );

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
      setFaqEntries([emptyFaqEntry()]);
      toast.success("Knowledge source added.");
      refetch();
    }
  });

  const { mutate: uploadFile, isPending: isUploading } = useMutation({
    mutationFn: uploadKnowledgeSource,
    onSuccess: () => {
      setForm({ title: "", content: "" });
      setSourceFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
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
    setSourceFile(file);
  };

  const handleCreateSource = () => {
    const title = form.title.trim();
    if (!title) {
      toast.error("Add a title for this knowledge source.");
      return;
    }

    if (sourceType === "text") {
      const content = form.content.trim();
      if (!content) {
        toast.error("Add content for this text source.");
        return;
      }
      createText({ type: "text", title, content });
      return;
    }

    if (sourceType === "file") {
      if (!sourceFile) {
        toast.error("Choose a TXT, PDF, or DOCX file to upload.");
        return;
      }
      const formData = new FormData();
      formData.append("title", title);
      formData.append("file", sourceFile);
      uploadFile(formData);
      return;
    }

    const cleanedFaqEntries = faqEntries
      .map((entry) => ({
        question: entry.question.trim(),
        answer: entry.answer.trim()
      }))
      .filter((entry) => entry.question || entry.answer);
    const incompleteEntry = cleanedFaqEntries.find(
      (entry) => !entry.question || !entry.answer
    );

    if (!cleanedFaqEntries.length) {
      toast.error("Add at least one FAQ question and answer.");
      return;
    }
    if (incompleteEntry) {
      toast.error("Every FAQ row needs both a question and an answer.");
      return;
    }

    createText({
      type: "faq",
      title,
      faqEntries: cleanedFaqEntries
    });
  };

  return (
    <>
      <div className="grid min-w-0 gap-4 lg:grid-cols-[420px_minmax(0,1fr)]">
        <Card className="min-w-0 rounded-lg">
          <CardContent className="space-y-3 p-5">
            <div>
              <p className="font-heading text-xl font-semibold">Add source</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Add text, FAQs, or upload a document for AI fallback.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-[140px_1fr]">
              <div className="space-y-2 w-full">
                <Label>Type</Label>
                <Select
                  value={sourceType}
                  onValueChange={(value) =>
                    setSourceType(value as SourceFormType)
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="text">Text</SelectItem>
                    <SelectItem value="faq">FAQ</SelectItem>
                    <SelectItem value="file">File</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="knowledge-title">Title</Label>
                <Input
                  id="knowledge-title"
                  maxLength={200}
                  placeholder="Refund policy"
                  value={form.title}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      title: event.target.value
                    }))
                  }
                />
              </div>
            </div>
            {sourceType === "text" ? (
              <Textarea
                placeholder="Paste policy, support script, or product details"
                className="min-h-44 max-h-[400px] overflow-y-auto resize-y"
                maxLength={50000}
                value={form.content}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    content: event.target.value
                  }))
                }
              />
            ) : sourceType === "faq" ? (
              <div className="space-y-3">
                {faqEntries.map((entry, index) => (
                  <div
                    key={index}
                    className="space-y-2 rounded-md border bg-muted/20 p-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <Label>FAQ {index + 1}</Label>
                      {faqEntries.length > 1 && (
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="size-8"
                          tooltip="Remove FAQ"
                          onClick={() =>
                            setFaqEntries((current) =>
                              current.filter(
                                (_, itemIndex) => itemIndex !== index
                              )
                            )
                          }
                        >
                          <X className="size-4" />
                        </Button>
                      )}
                    </div>
                    <Input
                      maxLength={2000}
                      placeholder="Question customers ask"
                      value={entry.question}
                      onChange={(event) =>
                        setFaqEntries((current) =>
                          current.map((item, itemIndex) =>
                            itemIndex === index
                              ? { ...item, question: event.target.value }
                              : item
                          )
                        )
                      }
                    />
                    <Textarea
                      maxLength={8000}
                      className="min-h-24 max-h-[400px] overflow-y-auto resize-y"
                      placeholder="Answer the AI should use"
                      value={entry.answer}
                      onChange={(event) =>
                        setFaqEntries((current) =>
                          current.map((item, itemIndex) =>
                            itemIndex === index
                              ? { ...item, answer: event.target.value }
                              : item
                          )
                        )
                      }
                    />
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  disabled={faqEntries.length >= 200}
                  onClick={() =>
                    setFaqEntries((current) => [...current, emptyFaqEntry()])
                  }
                >
                  <Plus className="size-4" />
                  Add FAQ row
                </Button>
              </div>
            ) : (
              <div className="space-y-2 rounded-md border border-dashed bg-muted/20 p-3">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".txt,.pdf,.docx,text/plain,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  className="hidden"
                  onChange={handleFile}
                />
                <Button
                  type="button"
                  variant="outline"
                  className="w-full cursor-pointer"
                  disabled={isUploading}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <UploadCloud className="size-4" />
                  {sourceFile ? "Replace file" : "Choose file"}
                </Button>
                <p className="truncate text-xs text-muted-foreground">
                  {sourceFile
                    ? sourceFile.name
                    : "TXT, PDF, or DOCX. The title above is saved with the source."}
                </p>
              </div>
            )}
            <Button
              className="w-full cursor-pointer"
              disabled={
                isCreating ||
                isUploading ||
                !form.title.trim() ||
                (sourceType === "file" && !sourceFile)
              }
              onClick={handleCreateSource}
            >
              {(isCreating || isUploading) && (
                <Loader2 className="mr-2 size-4 animate-spin" />
              )}
              Add {sourceType === "faq" ? "FAQ" : sourceType} source
            </Button>
          </CardContent>
        </Card>

        <div className="min-w-0 space-y-3">
          {isLoading ? (
            <ListLoadingSkeleton rows={5} />
          ) : sources.length ? (
            sources.map((source) => {
              const Icon = sourceIcon(source.type);
              return (
                <Card key={source._id} className="rounded-lg !p-0">
                  <CardContent className="flex items-center gap-3 p-4">
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-sm bg-primary/10 text-primary">
                      <Icon className="size-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate font-medium">{source.title}</p>
                        <Badge variant="secondary" className="capitalize">
                          {source.type}
                        </Badge>
                        <Badge
                          variant={
                            source.status === "failed"
                              ? "destructive"
                              : "default"
                          }
                          className="capitalize"
                        >
                          {source.status}
                        </Badge>
                      </div>
                      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        <span>{source.chunkCount || 0} chunks</span>
                        <span>
                          {source.filename ||
                            `Updated ${formatDate(source.updatedAt)}`}
                        </span>
                        {source.ingestError && (
                          <span className="text-destructive">
                            {source.ingestError}
                          </span>
                        )}
                      </div>
                    </div>
                    <Button
                      size="icon"
                      variant="outline"
                      className="cursor-pointer"
                      tooltip="View source details"
                      onClick={() => setSelectedSource(source)}
                    >
                      <Eye className="size-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="outline"
                      className="cursor-pointer"
                      tooltip="Re-ingest this knowledge source"
                      onClick={() => reingestSource(source._id)}
                    >
                      <RefreshCcw className="size-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="outline"
                      className="cursor-pointer text-destructive hover:text-destructive"
                      tooltip="Archive this knowledge source"
                      onClick={() => deleteSource(source._id)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </CardContent>
                </Card>
              );
            })
          ) : (
            <Card className="rounded-lg">
              <CardContent className="p-5 text-sm text-muted-foreground">
                No knowledge sources yet.
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <Dialog
        open={Boolean(selectedSource)}
        onOpenChange={() => setSelectedSource(null)}
      >
        <DialogContent className="flex max-h-[85vh] flex-col overflow-hidden sm:max-w-2xl">
          <DialogHeader className="shrink-0 pr-8">
            <DialogTitle>{selectedSource?.title}</DialogTitle>
            <DialogDescription>
              Knowledge source details from the current backend record.
            </DialogDescription>
          </DialogHeader>
          {selectedSource && (
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overflow-x-hidden pr-1">
              <div className="grid gap-3 text-sm sm:grid-cols-3">
                <div className="rounded-md bg-muted/40 p-3">
                  <p className="text-xs text-muted-foreground">Type</p>
                  <p className="mt-1 font-medium capitalize">
                    {selectedSource.type}
                  </p>
                </div>
                <div className="rounded-md bg-muted/40 p-3">
                  <p className="text-xs text-muted-foreground">Status</p>
                  <p className="mt-1 font-medium capitalize">
                    {selectedSource.status}
                  </p>
                </div>
                <div className="rounded-md bg-muted/40 p-3">
                  <p className="text-xs text-muted-foreground">Chunks</p>
                  <p className="mt-1 font-medium">
                    {selectedSource.chunkCount || 0}
                  </p>
                </div>
              </div>

              {selectedSource.type === "text" && (
                <div className="rounded-md border p-3">
                  <p className="mb-2 text-xs font-medium text-muted-foreground">
                    Content
                  </p>
                  <p className="whitespace-pre-wrap text-sm">
                    {selectedSource.content || "No content stored."}
                  </p>
                </div>
              )}

              {selectedSource.type === "faq" && (
                <div className="space-y-2">
                  {(selectedSource.faqEntries || []).map((entry, index) => (
                    <div key={index} className="rounded-md border p-3">
                      <p className="text-sm font-medium">{entry.question}</p>
                      <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">
                        {entry.answer}
                      </p>
                    </div>
                  ))}
                  {!selectedSource.faqEntries?.length && (
                    <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                      No FAQ rows stored.
                    </p>
                  )}
                </div>
              )}

              {selectedSource.type === "file" && (
                <div className="rounded-md border p-3 text-sm">
                  <p className="font-medium">
                    {selectedSource.filename || selectedSource.title}
                  </p>
                  <p className="mt-1 text-muted-foreground">
                    {selectedSource.mimeType || "Uploaded file"}
                  </p>
                  {selectedSource.cloudinaryUrl && (
                    <a
                      href={selectedSource.cloudinaryUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-3 inline-flex text-primary hover:underline"
                    >
                      Open file
                    </a>
                  )}
                </div>
              )}

              {selectedSource.ingestError && (
                <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                  {selectedSource.ingestError}
                </div>
              )}
            </div>
          )}
          {selectedSource && (
            <div className="grid shrink-0 gap-2 border-t pt-3 text-xs text-muted-foreground sm:grid-cols-2">
              <p>Last ingested: {formatDate(selectedSource.lastIngestedAt)}</p>
              <p>Updated: {formatDate(selectedSource.updatedAt)}</p>
            </div>
          )}
          <DialogFooter className="shrink-0">
            <Button variant="outline" onClick={() => setSelectedSource(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
