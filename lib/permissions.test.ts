import { describe, expect, it } from "vitest";

import { PermissionGroup } from "@/client-api/types/organizations.type";

import {
  describePermission,
  formatMemberLabel,
  hasMembershipPermission,
  summarizeAgentAccess
} from "./permissions";

describe("hasMembershipPermission", () => {
  it("lets owners and admins through regardless of grants", () => {
    expect(hasMembershipPermission("owner", [], "broadcasts:manage")).toBe(
      true
    );
    expect(hasMembershipPermission("admin", undefined, "team:view")).toBe(true);
  });

  it("only lets agents through with the exact grant", () => {
    expect(
      hasMembershipPermission(
        "agent",
        ["conversations:view"],
        "conversations:view"
      )
    ).toBe(true);
    expect(
      hasMembershipPermission(
        "agent",
        ["conversations:view"],
        "broadcasts:manage"
      )
    ).toBe(false);
  });

  it("denies when the role is unknown", () => {
    expect(hasMembershipPermission(undefined, [], "contacts:view")).toBe(false);
    expect(hasMembershipPermission(null, undefined, "contacts:view")).toBe(
      false
    );
  });
});

describe("describePermission", () => {
  const schema: PermissionGroup[] = [
    {
      key: "conversations",
      label: "Conversations",
      accessControl: {
        type: "level",
        levels: [
          { value: "none", label: "No access", grants: [] },
          {
            value: "view",
            label: "View only",
            grants: ["conversations:view"]
          }
        ]
      },
      capabilities: [
        {
          key: "assign",
          label: "Assign conversations",
          permission: "conversations:assign"
        }
      ]
    }
  ];

  it("names a level grant", () => {
    expect(describePermission("conversations:view", schema)).toBe(
      "Conversations → View only"
    );
  });

  it("names a capability grant", () => {
    expect(describePermission("conversations:assign", schema)).toBe(
      "Conversations → Assign conversations"
    );
  });

  it("falls back to the raw key without a schema or a match", () => {
    expect(describePermission("broadcasts:manage")).toBe("broadcasts:manage");
    expect(describePermission("broadcasts:manage", schema)).toBe(
      "broadcasts:manage"
    );
  });
});

describe("summarizeAgentAccess", () => {
  const schema: PermissionGroup[] = [
    {
      key: "conversations",
      label: "Conversations",
      accessControl: {
        type: "level",
        levels: [
          { value: "none", label: "No access", grants: [] },
          {
            value: "reply",
            label: "View and reply",
            grants: ["conversations:reply"]
          }
        ]
      },
      capabilities: [
        {
          key: "assign",
          label: "Assign conversations",
          permission: "conversations:assign"
        }
      ]
    },
    {
      key: "broadcasts",
      label: "Broadcasts",
      accessControl: {
        type: "level",
        levels: [
          { value: "none", label: "No access", grants: [] },
          { value: "manage", label: "Manage", grants: ["broadcasts:manage"] }
        ]
      }
    }
  ];

  it("names each area, then each extra", () => {
    expect(
      summarizeAgentAccess(
        {
          conversations: { access: "reply", capabilities: { assign: true } },
          broadcasts: { access: "none", capabilities: {} }
        },
        schema
      )
    ).toEqual(["Conversations: View and reply", "Assign conversations"]);
  });

  it("is empty when nothing is granted", () => {
    expect(
      summarizeAgentAccess(
        { broadcasts: { access: "none", capabilities: {} } },
        schema
      )
    ).toEqual([]);
  });

  it("falls back to describing the grants without access data", () => {
    expect(
      summarizeAgentAccess(undefined, schema, ["broadcasts:manage"])
    ).toEqual(["Broadcasts → Manage"]);
  });
});

describe("formatMemberLabel", () => {
  it("capitalises roles and statuses", () => {
    expect(formatMemberLabel("agent")).toBe("Agent");
    expect(formatMemberLabel("active")).toBe("Active");
    expect(formatMemberLabel("suspended")).toBe("Suspended");
    expect(formatMemberLabel(undefined)).toBe("");
  });
});
