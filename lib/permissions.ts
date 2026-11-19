import {
  PermissionAccessState,
  PermissionGroup
} from "@/client-api/types/organizations.type";

// Mirrors the backend's hasMembershipPermission: owners and admins always
// pass, agents only with an explicit (effective) grant.
export const hasMembershipPermission = (
  role: string | null | undefined,
  effectivePermissionGrants: string[] | undefined,
  permission: string
) => {
  if (role === "owner" || role === "admin") return true;
  return Boolean(effectivePermissionGrants?.includes(permission));
};

// Turns a permission key into the wording the owner sees on the agents page,
// e.g. "broadcasts:manage" -> "Broadcasts → View and manage". Falls back to
// the raw key when the schema isn't available or doesn't mention it.
export const describePermission = (
  permission: string,
  schema?: PermissionGroup[] | null
) => {
  for (const group of schema || []) {
    const level = group.accessControl?.levels?.find((item) =>
      item.grants?.includes(permission)
    );
    if (level) return `${group.label} → ${level.label}`;

    const capability = group.capabilities?.find(
      (item) => item.permission === permission
    );
    if (capability) return `${group.label} → ${capability.label}`;
  }
  return permission;
};

/**
 * What an agent can do, in the owner's words: one entry per area they can
 * use ("Conversations: View and reply"), then each extra they were given
 * ("Assign conversations"). Without access data or a schema, the grants are
 * described one by one instead.
 */
export const summarizeAgentAccess = (
  access: PermissionAccessState | undefined,
  schema: PermissionGroup[] | null | undefined,
  grants: string[] = []
) => {
  if (!access || !schema?.length) {
    return grants.map((grant) => describePermission(grant, schema));
  }
  const areas: string[] = [];
  const extras: string[] = [];
  for (const group of schema) {
    const entry = access[group.key];
    if (!entry) continue;
    const level = group.accessControl?.levels?.find(
      (item) => item.value === entry.access
    );
    if (level && entry.access !== "none") {
      areas.push(`${group.label}: ${level.label}`);
    }
    for (const capability of group.capabilities || []) {
      if (entry.capabilities?.[capability.key]) extras.push(capability.label);
    }
  }
  return [...areas, ...extras];
};

const MEMBER_LABELS: Record<string, string> = {
  owner: "Owner",
  admin: "Admin",
  agent: "Agent",
  active: "Active",
  invited: "Invited",
  disabled: "Disabled"
};

/** "agent" is "Agent", "invited" is "Invited"; anything else is capitalised. */
export const formatMemberLabel = (value?: string | null) => {
  const key = (value || "").trim().toLowerCase();
  if (!key) return "";
  return MEMBER_LABELS[key] || key.charAt(0).toUpperCase() + key.slice(1);
};
