import { PermissionGroup } from "@/client-api/types/organizations.type";

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
