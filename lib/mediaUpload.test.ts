import { describe, expect, it } from "vitest";

import {
  MEDIA_UPLOAD_MAX_BYTES,
  mediaKindOf,
  uploadAccept,
  uploadProblem
} from "./mediaUpload";

const file = (name: string, type: string, size = 1000) => ({
  name,
  type,
  size
});

describe("uploading from a media slot", () => {
  it("refuses WebP and SVG with one plain answer", () => {
    expect(uploadProblem(file("a.webp", "image/webp"), "image")).toBe(
      "Use a JPG or PNG image."
    );
    expect(uploadProblem(file("logo.svg", "image/svg+xml"), "image")).toBe(
      "Use a JPG or PNG image."
    );
    expect(uploadProblem(file("a.webp", "image/webp"), "document")).toBe(
      "Use a JPG or PNG image."
    );
  });

  it("takes only what the slot needs", () => {
    expect(uploadProblem(file("a.png", "image/png"), "image")).toBe("");
    expect(uploadProblem(file("a.JPG", ""), "image")).toBe("");
    expect(uploadProblem(file("a.mp4", "video/mp4"), "image")).toBe(
      "Use a JPG or PNG image."
    );
    expect(uploadProblem(file("a.mp4", "video/mp4"), "video")).toBe("");
    expect(uploadProblem(file("a.mov", "video/quicktime"), "video")).toBe(
      "Use an MP4 video."
    );
    expect(uploadProblem(file("menu.pdf", "application/pdf"), "document")).toBe(
      ""
    );
    expect(uploadProblem(file("list.xlsx", ""), "document")).toBe("");
    expect(uploadProblem(file("list.xlsx", ""), "document", true)).toBe(
      "Use a PDF file."
    );
    expect(uploadProblem(file("a.png", "image/png"), "document")).toBe(
      "Use a PDF, Word, Excel, CSV or text file."
    );
  });

  it("refuses files over 15 MB", () => {
    expect(
      uploadProblem(
        file("big.png", "image/png", MEDIA_UPLOAD_MAX_BYTES + 1),
        "image"
      )
    ).toBe("This file is over 15 MB. Use a smaller one.");
    expect(
      uploadProblem(
        file("ok.png", "image/png", MEDIA_UPLOAD_MAX_BYTES),
        "image"
      )
    ).toBe("");
  });

  it("filters the file chooser to the slot", () => {
    expect(uploadAccept("image")).toContain(".png");
    expect(uploadAccept("image")).not.toContain("webp");
    expect(uploadAccept("document", true)).toBe(".pdf,application/pdf");
    expect(uploadAccept("document")).toContain(".docx");
  });

  it("reads header formats and block types as a kind", () => {
    expect(mediaKindOf("IMAGE")).toBe("image");
    expect(mediaKindOf("document")).toBe("document");
    expect(mediaKindOf("TEXT")).toBeNull();
    expect(mediaKindOf(undefined)).toBeNull();
  });
});
