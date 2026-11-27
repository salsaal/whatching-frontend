import { Organization, useOrganizationStore } from "@/stores/organizationStore";

/**
 * A Whatching admin can pause a workspace (for example unpaid or misuse).
 * While paused nothing is sent -- bot, broadcasts, drips, store messages,
 * team replies -- but people can still log in and customers' messages
 * still arrive. Sends answer 403 with their own message, shown as-is.
 */
export const WORKSPACE_PAUSED_TEXT =
  "Your workspace is paused. Nothing is being sent to your customers. Please contact support.";

export const isWorkspacePaused = (
  organization?: Pick<Organization, "pausedAt"> | null
) => Boolean(organization?.pausedAt);

/** For send buttons: true while the active workspace is paused. */
export const useWorkspacePaused = () =>
  useOrganizationStore((state) => isWorkspacePaused(state.activeOrganization));
