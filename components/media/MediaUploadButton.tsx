import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AxiosError } from "axios";
import { Upload } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { uploadMedia } from "@/client-api/functions/media";
import { MediaAsset, MediaFileType } from "@/client-api/types/media.type";
import { Button } from "@/components/ui/button";
import { useCurrentMembership } from "@/hooks/useCurrentMembership";
import { uploadAccept, uploadProblem } from "@/lib/mediaUpload";

/**
 * "Upload", next to "choose from the library" in any media slot. The file
 * goes to the Media library and comes back to the slot as if picked there.
 * Hidden for people without media:manage; they can still pick.
 */
export function MediaUploadButton({
  kind,
  pdfOnly = false,
  disabled = false,
  size = "sm",
  variant = "outline",
  className,
  onUploaded
}: {
  /** What the slot takes. */
  kind: MediaFileType;
  /** Template document headers take PDFs only. */
  pdfOnly?: boolean;
  disabled?: boolean;
  size?: "sm" | "default";
  variant?: "outline" | "ghost" | "default";
  className?: string;
  onUploaded: (media: MediaAsset) => void;
}) {
  const { can } = useCurrentMembership();
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<number | null>(null);

  const { mutate: upload, isPending } = useMutation({
    mutationFn: (file: File) =>
      uploadMedia([file], { onProgress: setProgress }),
    meta: { showToast: false },
    onSuccess: (response) => {
      const media = response.data.media?.[0];
      queryClient.invalidateQueries({ queryKey: ["media"] });
      if (!media) {
        toast.error("Upload failed. Check the file and try again.");
        return;
      }
      toast.success(`“${media.name}” uploaded.`);
      onUploaded(media);
    },
    onError: (error: AxiosError<{ message?: string }>) =>
      toast.error(
        error.response?.data?.message ||
          "Upload failed. Check the file and try again."
      ),
    onSettled: () => setProgress(null)
  });

  if (!can("media:manage")) return null;

  return (
    <>
      <Button
        type="button"
        size={size}
        variant={variant}
        className={className}
        disabled={disabled || isPending}
        isLoading={isPending}
        onClick={() => inputRef.current?.click()}
      >
        {!isPending && <Upload className="size-4" />}
        {isPending
          ? progress !== null && progress < 100
            ? `Uploading ${progress}%`
            : "Uploading…"
          : "Upload"}
      </Button>
      <input
        ref={inputRef}
        type="file"
        accept={uploadAccept(kind, pdfOnly)}
        className="hidden"
        aria-label="Upload a file"
        onChange={(event) => {
          const file = event.target.files?.[0];
          // Cleared so choosing the same file again still fires.
          event.target.value = "";
          if (!file) return;
          const problem = uploadProblem(file, kind, pdfOnly);
          if (problem) {
            toast.error(problem);
            return;
          }
          upload(file);
        }}
      />
    </>
  );
}
