import { describe, expect, it } from "vitest";

import {
  BroadcastVariableMapping,
  buildBroadcastComponents,
  defaultVariableMapping,
  getTemplateBodyExample,
  getTemplateBodyText,
  getTemplateBodyVariables
} from "./broadcastComponents";
import type { MessageTemplate } from "@/client-api/types/templates.type";

const template = (overrides: Partial<MessageTemplate> = {}): MessageTemplate => ({
  _id: "tpl_1",
  templateId: "tpl_1",
  orgId: "org_1",
  name: "order_update",
  language: "en",
  category: "UTILITY",
  status: "APPROVED",
  components: [
    {
      type: "BODY",
      text: "Hi {{1}}, your order {{2}} is on the way.",
      example: { body_text: [["Asha", "ORD123"]] }
    }
  ],
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  ...overrides
});

describe("getTemplateBodyText / getTemplateBodyVariables", () => {
  it("extracts the body text and its numbered variables in order", () => {
    const t = template();
    expect(getTemplateBodyText(t)).toBe("Hi {{1}}, your order {{2}} is on the way.");
    expect(getTemplateBodyVariables(t)).toEqual(["1", "2"]);
  });

  it("returns an empty variable list for a template with no body placeholders", () => {
    expect(
      getTemplateBodyVariables(template({ components: [{ type: "BODY", text: "Hello!" }] }))
    ).toEqual([]);
  });
});

describe("getTemplateBodyExample", () => {
  it("reads the Meta-provided sample value for a given variable key", () => {
    expect(getTemplateBodyExample(template(), "1")).toBe("Asha");
    expect(getTemplateBodyExample(template(), "2")).toBe("ORD123");
  });

  it("returns an empty string when no example is provided", () => {
    expect(
      getTemplateBodyExample(
        template({ components: [{ type: "BODY", text: "Hi {{1}}" }] }),
        "1"
      )
    ).toBe("");
  });
});

describe("defaultVariableMapping", () => {
  it("defaults {{1}} to the subscriber's first name and every other variable to a blank literal", () => {
    expect(defaultVariableMapping("1")).toEqual({
      source: "subscriber_field",
      path: "firstName",
      fallback: "Valued Customer",
      literal: ""
    });
    expect(defaultVariableMapping("2")).toEqual({
      source: "literal",
      path: "",
      fallback: "",
      literal: ""
    });
  });
});

describe("buildBroadcastComponents", () => {
  it("returns an empty component list when the template has no variables", () => {
    expect(buildBroadcastComponents([], {})).toEqual({ ok: true, components: [] });
  });

  it("builds a body component with one parameter per variable, in order", () => {
    const mappings: Record<string, BroadcastVariableMapping> = {
      "1": { source: "subscriber_field", path: "firstName", fallback: "Friend", literal: "" },
      "2": { source: "literal", path: "", fallback: "", literal: "ORD123" }
    };
    const result = buildBroadcastComponents(["1", "2"], mappings);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected ok result");
    expect(result.components).toEqual([
      {
        type: "body",
        parameters: [
          {
            type: "text",
            value: { source: "subscriber_field", path: "firstName", fallback: "Friend" }
          },
          { type: "text", value: { source: "literal", text: "ORD123" } }
        ]
      }
    ]);
  });

  it("resolves a metadata_field mapping with a trimmed path and optional fallback", () => {
    const result = buildBroadcastComponents("1".split(""), {
      "1": { source: "metadata_field", path: " orderId ", fallback: "", literal: "" }
    });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected ok result");
    expect(result.components[0].parameters).toEqual([
      { type: "text", value: { source: "metadata_field", path: "orderId", fallback: undefined } }
    ]);
  });

  it("fails with a specific error when a literal variable is left blank", () => {
    const result = buildBroadcastComponents(["1"], {
      "1": { source: "literal", path: "", fallback: "", literal: "   " }
    });
    expect(result).toEqual({ ok: false, error: "Add a value for {{1}}" });
  });

  it("fails with a specific error when a metadata_field variable has no path", () => {
    const result = buildBroadcastComponents(["1"], {
      "1": { source: "metadata_field", path: "  ", fallback: "", literal: "" }
    });
    expect(result).toEqual({ ok: false, error: "Add a metadata path for {{1}}" });
  });

  it("falls back to defaultVariableMapping for a variable with no explicit mapping", () => {
    const result = buildBroadcastComponents(["1"], {});
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected ok result");
    expect(result.components[0].parameters).toEqual([
      {
        type: "text",
        value: { source: "subscriber_field", path: "firstName", fallback: "Valued Customer" }
      }
    ]);
  });
});
