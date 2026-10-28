import { describe, expect, it } from "vitest";

import { PermissionGroup } from "@/client-api/types/organizations.type";

import { describePermission, hasMembershipPermission } from "./permissions";

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
