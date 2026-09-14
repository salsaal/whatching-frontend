import { describe, expect, it } from "vitest";

import {
  applyVariableExamples,
  buildButtonsComponent,
  extractVariables,
  getBodyComponent,
  getButtonsComponent,
  getTemplateEditId,
  getTemplateType,
  isPendingTemplate,
  mapDraftToTemplate,
  statusLabel,
  templateNeedsMedia
} from "./templateUtils";
import {
  MessageTemplate,
  TemplateComponent,
  TemplateDraft
} from "@/client-api/types/templates.type";

const baseTemplate = (
  overrides: Partial<MessageTemplate> = {}
): MessageTemplate => ({
  _id: "tpl_1",
  templateId: "tpl_1",
  orgId: "org_1",
  name: "welcome_message",
  language: "en",
  category: "MARKETING",
  status: "APPROVED",
  components: [],
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  ...overrides
});

describe("statusLabel", () => {
  it("title-cases underscore-separated status codes", () => {
    expect(statusLabel("PENDING")).toBe("Pending");
    expect(statusLabel("ACTION_REQUIRED")).toBe("Action Required");
  });
});

describe("getBodyComponent / getButtonsComponent", () => {
  it("finds the component matching the requested type", () => {
    const components: TemplateComponent[] = [
      { type: "HEADER", format: "TEXT" },
      { type: "BODY", text: "Hello {{1}}" },
      { type: "BUTTONS", buttons: [{ type: "QUICK_REPLY", text: "Yes" }] }
    ];
    expect(getBodyComponent(components)?.text).toBe("Hello {{1}}");
    expect(getButtonsComponent(components)?.buttons?.[0].text).toBe("Yes");
  });
});

describe("getTemplateType", () => {
  it("defaults to TEXT with no header, and returns the header format otherwise", () => {
    expect(getTemplateType(baseTemplate({ components: [] }))).toBe("TEXT");
    expect(
      getTemplateType(
        baseTemplate({ components: [{ type: "HEADER", format: "IMAGE" }] })
      )
    ).toBe("IMAGE");
    expect(
      getTemplateType(
        baseTemplate({ components: [{ type: "HEADER", format: "TEXT" }] })
      )
    ).toBe("TEXT");
  });
});

describe("templateNeedsMedia", () => {
  it("is true only for a media header with no media attached yet", () => {
    const withMediaHeader = (format: TemplateComponent["format"]) =>
      baseTemplate({ components: [{ type: "HEADER", format }] });

    expect(templateNeedsMedia(withMediaHeader("IMAGE"))).toBe(true);
    expect(templateNeedsMedia(withMediaHeader("TEXT"))).toBe(false);
    expect(
      templateNeedsMedia(
        baseTemplate({
          components: [{ type: "HEADER", format: "IMAGE", mediaId: "media_1" }]
        })
      )
    ).toBe(false);
    expect(
      templateNeedsMedia(
        baseTemplate({
          components: [{ type: "HEADER", format: "IMAGE" }],
          defaultMediaId: "media_default"
        })
      )
    ).toBe(false);
  });
});

describe("extractVariables", () => {
  it("extracts unique numbered placeholders in first-seen order", () => {
    expect(
      extractVariables("Hi {{1}}, your order {{2}} is ready. Thanks {{1}}!")
    ).toEqual(["1", "2"]);
    expect(extractVariables("No placeholders here")).toEqual([]);
  });
});

describe("applyVariableExamples", () => {
  it("substitutes known examples and leaves unknown placeholders untouched", () => {
    expect(
      applyVariableExamples("Hi {{1}}, order {{2}}", { "1": "Asha" })
    ).toBe("Hi Asha, order {{2}}");
  });
});

describe("buildButtonsComponent", () => {
  it("returns null for an empty button list and a BUTTONS component otherwise", () => {
    expect(buildButtonsComponent([])).toBeNull();
    expect(
      buildButtonsComponent([{ type: "QUICK_REPLY", text: "Yes" }])
    ).toEqual({
      type: "BUTTONS",
      buttons: [{ type: "QUICK_REPLY", text: "Yes" }]
    });
  });
});

describe("mapDraftToTemplate", () => {
  const baseDraft: TemplateDraft = {
    _id: "draft_1",
    orgId: "org_1",
    name: "welcome_message",
    language: "en",
    category: "MARKETING",
    status: "draft",
    components: [],
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z"
  };

  it("maps lowercase draft statuses to their display equivalents", () => {
    expect(mapDraftToTemplate(baseDraft).status).toBe("DRAFT");
    expect(
      mapDraftToTemplate({ ...baseDraft, status: "pending_review" }).status
    ).toBe("PENDING");
    expect(
      mapDraftToTemplate({ ...baseDraft, status: "REJECTED" }).status
    ).toBe("REJECTED");
  });

  it("prefers metaTemplateId, then templateId, then _id for the resulting templateId", () => {
    expect(mapDraftToTemplate(baseDraft).templateId).toBe("draft_1");
    expect(
      mapDraftToTemplate({ ...baseDraft, templateId: "tpl_local" }).templateId
    ).toBe("tpl_local");
    expect(
      mapDraftToTemplate({
        ...baseDraft,
        templateId: "tpl_local",
        metaTemplateId: "tpl_meta"
      }).templateId
    ).toBe("tpl_meta");
  });

  it("always tags the mapped result as a draft source", () => {
    expect(mapDraftToTemplate(baseDraft).source).toBe("draft");
    expect(mapDraftToTemplate(baseDraft).draftId).toBe("draft_1");
  });
});

describe("getTemplateEditId", () => {
  it("uses the draft id for draft-sourced templates and the templateId otherwise", () => {
    expect(
      getTemplateEditId(
        baseTemplate({ source: "draft", draftId: "draft_1", _id: "tpl_1" })
      )
    ).toBe("draft_1");
    expect(
      getTemplateEditId(
        baseTemplate({ source: "draft", draftId: undefined, _id: "tpl_1" })
      )
    ).toBe("tpl_1");
    expect(
      getTemplateEditId(
        baseTemplate({ source: "meta", templateId: "tpl_meta" })
      )
    ).toBe("tpl_meta");
  });
});

describe("isPendingTemplate", () => {
  it("recognizes both the Meta and local draft pending statuses", () => {
    expect(isPendingTemplate(baseTemplate({ status: "PENDING" }))).toBe(true);
    expect(isPendingTemplate(baseTemplate({ status: "pending_review" }))).toBe(
      true
    );
    expect(isPendingTemplate(baseTemplate({ status: "APPROVED" }))).toBe(false);
  });
});
