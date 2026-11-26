import { MediaFileType } from "@/client-api/types/media.type";

// Uploading straight from a media slot (template header, flow block, …).
// The file also lands in the Media library, so it's used exactly as if it
// had been picked there. Checked here first so people get a plain answer
// before waiting on an upload the server would refuse.

export const MEDIA_UPLOAD_MAX_BYTES = 15 * 1024 * 1024;

const IMAGE_TYPES = ["image/jpeg", "image/png"];
const VIDEO_TYPES = ["video/mp4", "video/3gpp"];
const DOCUMENT_EXTENSIONS = [
  ".pdf",
  ".doc",
  ".docx",
  ".xls",
  ".xlsx",
  ".csv",
  ".txt"
];

const extension = (name: string) => {
  const match = name.toLowerCase().match(/\.[a-z0-9]+$/);
  return match ? match[0] : "";
};

/** The file chooser's filter for a slot. */
export const uploadAccept = (kind: MediaFileType, pdfOnly = false) => {
  if (kind === "image") return ".jpg,.jpeg,.png,image/jpeg,image/png";
  if (kind === "video") return ".mp4,.3gp,video/mp4,video/3gpp";
  return pdfOnly ? ".pdf,application/pdf" : DOCUMENT_EXTENSIONS.join(",");
};

/** Why this file can't go in this slot, or "" when it can. */
export const uploadProblem = (
  file: Pick<File, "name" | "type" | "size">,
  kind: MediaFileType,
  pdfOnly = false
) => {
  const ext = extension(file.name);
  const isWebpOrSvg =
    file.type === "image/webp" ||
    file.type === "image/svg+xml" ||
    ext === ".webp" ||
    ext === ".svg";
  if (isWebpOrSvg) return "Use a JPG or PNG image.";
  if (kind === "image") {
    const ok =
      IMAGE_TYPES.includes(file.type) ||
      [".jpg", ".jpeg", ".png"].includes(ext);
    if (!ok) return "Use a JPG or PNG image.";
  }
  if (kind === "video") {
    const ok =
      VIDEO_TYPES.includes(file.type) || [".mp4", ".3gp"].includes(ext);
    if (!ok) return "Use an MP4 video.";
  }
  if (kind === "document") {
    if (pdfOnly && ext !== ".pdf" && file.type !== "application/pdf") {
      return "Use a PDF file.";
    }
    if (!pdfOnly && !DOCUMENT_EXTENSIONS.includes(ext)) {
      return "Use a PDF, Word, Excel, CSV or text file.";
    }
  }
  if (file.size > MEDIA_UPLOAD_MAX_BYTES) {
    return "This file is over 15 MB. Use a smaller one.";
  }
  return "";
};

/** Template header formats and flow block types, as a media kind. */
export const mediaKindOf = (type?: string | null): MediaFileType | null => {
  const value = (type || "").toLowerCase();
  if (value === "image" || value === "video" || value === "document") {
    return value;
  }
  return null;
};
