import { useMutation } from "@tanstack/react-query";
import { AxiosError } from "axios";
import { Search, SearchX } from "lucide-react";
import { FormEvent, useState } from "react";

import { testKnowledgeSearch } from "@/client-api/functions/bot";
import { KnowledgeSearchResult } from "@/client-api/types/bot.type";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

const MIN_QUERY = 2;
const MAX_QUERY = 1000;

function ResultCard({
  result,
  relevance
}: {
  result: KnowledgeSearchResult;
  relevance: number;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  return (
    <article className="space-y-2 rounded-md border p-3">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">
          {result.sourceTitle || "Untitled source"}
        </p>
        {result.heading && (
          <p className="truncate text-xs text-muted-foreground">
            {result.heading}
          </p>
        )}
      </div>
      <p
        className={
          isExpanded
            ? "whitespace-pre-line text-sm"
            : "line-clamp-3 whitespace-pre-line text-sm"
        }
      >
        {result.excerpt}
      </p>
      <button
        type="button"
        className="cursor-pointer text-xs font-medium text-primary hover:underline"
        onClick={() => setIsExpanded((current) => !current)}
      >
        {isExpanded ? "Show less" : "Show more"}
      </button>
      <div
        className="h-1.5 overflow-hidden rounded-full bg-muted"
        role="meter"
        aria-label="Relevance"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={relevance}
      >
        <div
          className="h-full rounded-full bg-primary"
          style={{ width: `${relevance}%` }}
        />
      </div>
    </article>
  );
}

// Retrieval only: shows the chunks the AI would read for a question, so an
// owner can spot gaps in the knowledge base without spending tokens.
function KnowledgeTest() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<KnowledgeSearchResult[] | null>(null);
  const [error, setError] = useState("");

  const { mutate: runTest, isPending } = useMutation({
    mutationFn: testKnowledgeSearch,
    meta: { showToast: false },
    onSuccess: (response) => {
      setError("");
      setResults(response.data?.chunks || []);
    },
    onError: (failure: AxiosError<{ message?: string }>) => {
      setResults(null);
      setError(
        failure.response?.data?.message || "Couldn't run the test. Try again."
      );
    }
  });

  const trimmedLength = query.trim().length;
  const isQueryValid = trimmedLength >= MIN_QUERY && trimmedLength <= MAX_QUERY;

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!isQueryValid) return;
    runTest({ query: query.trim(), limit: 5 });
  };

  // Scores are rank-fusion sums, only meaningful relative to each other, so
  // the bar compares each result to the best one in this set.
  const topScore = Math.max(...(results || []).map((item) => item.score), 0);

  return (
    <div className="space-y-3">
      <form onSubmit={handleSubmit} className="space-y-2">
        <Textarea
          value={query}
          maxLength={MAX_QUERY}
          rows={3}
          placeholder="Ask a question a customer might send…"
          onChange={(event) => setQuery(event.target.value)}
        />
        <Button
          type="submit"
          size="sm"
          className="w-full"
          disabled={!isQueryValid}
          isLoading={isPending}
        >
          Test
        </Button>
      </form>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {results && results.length === 0 && (
        <div className="flex gap-2 rounded-md bg-amber-50 p-3 text-sm text-amber-900">
          <SearchX className="mt-0.5 size-4 shrink-0" />
          <p>
            Nothing in your knowledge base matches this. The AI won&apos;t be
            able to answer it. Add a source that covers it.
          </p>
        </div>
      )}

      {results && results.length > 0 && (
        <div className="space-y-2">
          {results.map((result) => (
            <ResultCard
              key={result.id}
              result={result}
              relevance={
                topScore > 0 ? Math.round((result.score / topScore) * 100) : 0
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function KnowledgeTestButton() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Search className="size-4" />
          Test
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Test your knowledge</DialogTitle>
          <DialogDescription>
            Shows what the AI would read to answer. It doesn&apos;t send
            anything or use AI tokens.
          </DialogDescription>
        </DialogHeader>
        <KnowledgeTest />
      </DialogContent>
    </Dialog>
  );
}
