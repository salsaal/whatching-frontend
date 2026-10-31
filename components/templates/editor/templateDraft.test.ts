import { describe, expect, it } from "vitest";

import { MessageTemplate } from "@/client-api/types/templates.type";
import {
  bodyWarnings,
  buildChecklist,
  buttonsFromTemplate,
  composeTemplateComponents,
  inferTemplateType,
  TemplateEditorState
} from "./templateDraft";

const base: TemplateEditorState = {
  name: "summer_sale",
  templateType: "TEXT",
  headerFormat: "NONE",
  headerText: "",
  headerSample: "",
  headerExampleUrl: "",
  selectedMediaId: "",
  existingHeaderHandle: "",
  offerText: "",
  carouselCards: [],
  bodyText: "Hi {{1}}, your order {{2}} ships today",
  bodyExamples: { "1": "Priya", "2": "#123" },
  footerText: "Reply STOP to opt out",
  supportsFooter: true,
  buttons: []
};

const failing = (state: TemplateEditorState) =>
  buildChecklist(state)
    .filter((item) => !item.ok)
    .map((item) => item.id);

describe("composeTemplateComponents", () => {
  it("builds body samples in variable order", () => {
    const components = composeTemplateComponents(base);
    expect(
      components.find((component) => component.type === "BODY")?.example
    ).toEqual({
      body_text: [["Priya", "#123"]]
    });
  });

  it("keeps an edited media template's stored header when no file is picked", () => {
    const components = composeTemplateComponents({
      ...base,
      templateType: "IMAGE",
      headerFormat: "IMAGE",
      existingHeaderHandle: "https://scontent.example/x.jpg"
    });
    expect(components[0]).toEqual({
      type: "HEADER",
      format: "IMAGE",
      example: { header_handle: ["https://scontent.example/x.jpg"] }
    });
  });

  it("sends header text and link samples Meta requires", () => {
    const components = composeTemplateComponents({
      ...base,
      headerFormat: "TEXT",
      headerText: "Hello {{1}}",
      headerSample: "Priya",
      buttons: [
        {
          type: "URL",
          text: "Track",
          url: "https://x.com/t/{{1}}",
          sample: "https://x.com/t/9"
        },
        { type: "COPY_CODE", text: "", code: "SAVE10" }
      ]
    });
    expect(components[0]).toMatchObject({
      example: { header_text: ["Priya"] }
    });
    const buttons = components.find(
      (component) => component.type === "BUTTONS"
    )?.buttons;
    expect(buttons?.[0]).toMatchObject({ example: ["https://x.com/t/9"] });
    expect(buttons?.[1]).toEqual({ type: "COPY_CODE", example: "SAVE10" });
  });

  it("puts carousel buttons on every card and nothing at the top level", () => {
    const components = composeTemplateComponents({
      ...base,
      templateType: "CAROUSEL",
      carouselCards: [
        { mediaId: "a", mediaName: "", mediaUrl: "" },
        { mediaId: "b", mediaName: "", mediaUrl: "" }
      ],
      buttons: [{ type: "QUICK_REPLY", text: "Buy" }]
    });
    expect(components.some((component) => component.type === "BUTTONS")).toBe(
      false
    );
    const cards =
      components.find((component) => component.type === "CAROUSEL")?.cards ||
      [];
    expect(cards).toHaveLength(2);
    expect(
      cards[1].components.find((component) => component.type === "BUTTONS")
    ).toBeTruthy();
  });
});

describe("buildChecklist", () => {
  it("passes a complete template", () => {
    expect(failing(base)).toEqual([]);
  });

  it("flags missing samples, media and bad buttons", () => {
    expect(
      failing({
        ...base,
        name: "",
        templateType: "IMAGE",
        headerFormat: "IMAGE",
        bodyExamples: { "1": "Priya" },
        buttons: [{ type: "URL", text: "Go", url: "not a url" }]
      })
    ).toEqual(["name", "samples", "media", "buttons"]);
  });

  it("rejects duplicate labels and an empty copy code", () => {
    const items = buildChecklist({
      ...base,
      buttons: [
        { type: "QUICK_REPLY", text: "Yes" },
        { type: "QUICK_REPLY", text: "yes" },
        { type: "COPY_CODE", text: "", code: "" }
      ]
    });
    expect(items.find((item) => item.id === "buttons")?.ok).toBe(false);
  });
});

describe("loading templates back into the editor", () => {
  it("recognises carousels and offers from their components", () => {
    const carousel = {
      components: [
        { type: "CAROUSEL", cards: [] },
        { type: "BODY", text: "x" }
      ]
    } as unknown as MessageTemplate;
    expect(inferTemplateType(carousel)).toBe("CAROUSEL");
    const image = {
      components: [
        { type: "HEADER", format: "IMAGE" },
        { type: "BODY", text: "x" }
      ]
    } as unknown as MessageTemplate;
    expect(inferTemplateType(image)).toBe("IMAGE");
  });

  it("pulls link samples and offer codes out of stored buttons", () => {
    expect(
      buttonsFromTemplate([
        {
          type: "URL",
          text: "Track",
          url: "https://x.com/{{1}}",
          example: ["https://x.com/1"]
        },
        { type: "COPY_CODE", text: "", example: "SAVE" as unknown as string[] }
      ])
    ).toEqual([
      {
        type: "URL",
        text: "Track",
        url: "https://x.com/{{1}}",
        sample: "https://x.com/1"
      },
      { type: "COPY_CODE", text: "", code: "SAVE" }
    ]);
  });
});

describe("bodyWarnings", () => {
  it("warns about variables at the edges, side by side, or out of order", () => {
    expect(bodyWarnings("{{1}} {{3}}")).toEqual(
      expect.arrayContaining([
        "Avoid starting or ending the message with a variable.",
        "Two variables sit next to each other; add words between them.",
        "Number variables in order: {{1}}, {{2}}, {{3}}…"
      ])
    );
    expect(bodyWarnings("Hi {{1}}, thanks for your order today.")).toEqual([]);
  });
});
