import { beforeEach, describe, expect, it } from "vitest";

import { useTemplateStore } from "./templateStore";
import type { MessageTemplate } from "@/client-api/types/templates.type";

const template = (
  id: string,
  templateId: string,
  overrides: Partial<MessageTemplate> = {}
): MessageTemplate => ({
  _id: id,
  templateId,
  orgId: "org_1",
  name: `template_${id}`,
  language: "en",
  category: "MARKETING",
  status: "APPROVED",
  components: [],
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  ...overrides
});

beforeEach(() => {
  useTemplateStore.setState({ templates: [] });
});

describe("addTemplate", () => {
  it("prepends and de-duplicates by templateId", () => {
    useTemplateStore.getState().addTemplate(template("db_1", "tpl_1"));
    useTemplateStore
      .getState()
      .addTemplate(template("db_1", "tpl_1", { name: "renamed" }));
    const templates = useTemplateStore.getState().templates;
    expect(templates).toHaveLength(1);
    expect(templates[0].name).toBe("renamed");
  });
});

describe("upsertTemplate", () => {
  it("matches on templateId even when the Mongo _id differs (draft promoted to a Meta template)", () => {
    // A draft (_id: draft_1, templateId falls back to draft_1 itself) that's
    // since been approved and re-fetched from Meta now carries a *different*
    // _id but the *same* templateId -- upsert must still treat it as the
    // same logical template, not create a duplicate row.
    useTemplateStore.getState().setTemplates([template("draft_1", "draft_1")]);
    useTemplateStore
      .getState()
      .upsertTemplate(
        template("meta_tpl_1", "draft_1", { status: "APPROVED" })
      );

    const templates = useTemplateStore.getState().templates;
    expect(templates).toHaveLength(1);
    expect(templates[0]._id).toBe("meta_tpl_1");
  });

  it("matches on _id even when templateId differs", () => {
    useTemplateStore.getState().setTemplates([template("db_1", "tpl_old")]);
    useTemplateStore.getState().upsertTemplate(template("db_1", "tpl_new"));

    const templates = useTemplateStore.getState().templates;
    expect(templates).toHaveLength(1);
    expect(templates[0].templateId).toBe("tpl_new");
  });

  it("prepends a genuinely new template that matches neither key", () => {
    useTemplateStore.getState().setTemplates([template("db_1", "tpl_1")]);
    useTemplateStore.getState().upsertTemplate(template("db_2", "tpl_2"));
    expect(useTemplateStore.getState().templates.map((t) => t._id)).toEqual([
      "db_2",
      "db_1"
    ]);
  });
});

describe("removeTemplate", () => {
  it("removes a template matching either its templateId or its _id", () => {
    useTemplateStore
      .getState()
      .setTemplates([template("db_1", "tpl_1"), template("db_2", "tpl_2")]);
    useTemplateStore.getState().removeTemplate("tpl_1");
    expect(useTemplateStore.getState().templates.map((t) => t._id)).toEqual([
      "db_2"
    ]);

    useTemplateStore.getState().removeTemplate("db_2");
    expect(useTemplateStore.getState().templates).toEqual([]);
  });
});
