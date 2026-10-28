"use client";

import {
  AlertTriangle,
  Loader2,
  Mail,
  Pencil,
  Phone,
  ShieldCheck,
  Trash2,
  UserPlus,
  UsersRound
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { AxiosError } from "axios";
import { toast } from "sonner";

import {
  addAgent,
  checkAgentEmail,
  getTeam,
  removeTeamMember,
  updateTeamMemberPermissions
} from "@/client-api/functions/organizations";
import {
  CheckAgentEmailResponse,
  PermissionAccessLevel,
  PermissionAccessState,
  PermissionGroup,
  TeamMember
} from "@/client-api/types/organizations.type";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from "@/components/ui/alert-dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { QueryErrorState } from "@/components/shared/QueryErrorState";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import PhoneNumberInput, {
  buildInternationalPhoneNumber
} from "@/components/ui/phone-number-input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { SettingsBackLink } from "@/components/settings/SettingsBackLink";
import { useCurrentMembership } from "@/hooks/useCurrentMembership";
import AppLayout from "@/layouts/AppLayout";
import { useOrganizationStore } from "@/stores/organizationStore";
import { PermissionGate } from "@/components/common/NoAccess";

const initials = (name?: string) =>
  (name || "A")
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

// "member" = already an active member: nothing to submit, so it's blocked.
type AgentFormStep = "email" | "new" | "existing" | "member";

function AgentForm({
  onSubmit,
  isSaving,
  permissionSchema,
  defaultPermissionAccess
}: {
  onSubmit: (payload: {
    name?: string;
    email: string;
    phoneNumber?: string;
    countryIso?: string;
    password?: string;
    permissionAccess?: PermissionAccessState;
  }) => void;
  isSaving: boolean;
  permissionSchema: PermissionGroup[];
  defaultPermissionAccess: PermissionAccessState;
}) {
  const [step, setStep] = useState<AgentFormStep>("email");
  const [emailCheck, setEmailCheck] = useState<
    CheckAgentEmailResponse["data"] | null
  >(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [countryCode, setCountryCode] = useState("+91");
  const [countryIso, setCountryIso] = useState("IN");
  const [password, setPassword] = useState("");
  const [permissionAccess, setPermissionAccess] =
    useState<PermissionAccessState>(defaultPermissionAccess);

  useEffect(() => {
    setPermissionAccess(defaultPermissionAccess || {});
  }, [defaultPermissionAccess]);

  const { mutate: checkEmailMutate, isPending: isCheckingEmail } = useMutation({
    mutationFn: checkAgentEmail,
    meta: { showToast: false },
    onSuccess: (response) => {
      setEmailCheck(response.data);
      setStep(
        response.data.alreadyMember
          ? "member"
          : response.data.exists
            ? "existing"
            : "new"
      );
    },
    onError: (error: AxiosError<{ message?: string }>) => {
      toast.error(
        error.response?.data?.message || "Couldn't check that email. Try again."
      );
    }
  });

  const handleEmailSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!email.trim()) {
      toast.error("Enter an email address.");
      return;
    }
    checkEmailMutate(email.trim());
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (step === "member") return;
    const permissionPayload = permissionSchema.length
      ? { permissionAccess }
      : {};

    // Existing accounts only need the email + permissions -- the backend
    // never reads name/phone/password when linking or restoring access.
    if (step === "existing") {
      onSubmit({ email: email.trim(), ...permissionPayload });
      return;
    }

    if (!name.trim() || !phoneNumber.trim() || !password) {
      toast.error("Add a name, phone number, and temporary password.");
      return;
    }
    onSubmit({
      name: name.trim(),
      email: email.trim(),
      phoneNumber: buildInternationalPhoneNumber(countryCode, phoneNumber),
      countryIso,
      password,
      ...permissionPayload
    });
  };

  const setGroupAccess = (groupKey: string, access: PermissionAccessLevel) => {
    setPermissionAccess((current) => ({
      ...current,
      [groupKey]: {
        access,
        capabilities: current?.[groupKey]?.capabilities || {}
      }
    }));
  };

  const toggleCapability = (groupKey: string, capabilityKey: string) => {
    setPermissionAccess((current) => {
      const group = current?.[groupKey] || {
        access: "none" as const,
        capabilities: {}
      };
      return {
        ...current,
        [groupKey]: {
          ...group,
          capabilities: {
            ...group.capabilities,
            [capabilityKey]: !group.capabilities?.[capabilityKey]
          }
        }
      };
    });
  };

  if (step === "email") {
    return (
      <form className="space-y-4" onSubmit={handleEmailSubmit}>
        <div className="space-y-1.5">
          <Label>Email</Label>
          <Input
            type="email"
            value={email}
            placeholder="staff@whatching.com"
            onChange={(event) => setEmail(event.target.value)}
          />
        </div>
        <Button type="submit" className="w-full" isLoading={isCheckingEmail}>
          Continue
        </Button>
      </form>
    );
  }

  const personLabel = emailCheck?.name || email;

  if (step === "member") {
    return (
      <div className="space-y-4">
        <div className="rounded-lg border bg-muted/30 p-3 text-sm">
          <p className="font-medium">{personLabel} is already on your team.</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Manage their access from the team list instead.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          className="w-full"
          onClick={() => setStep("email")}
        >
          Use a different email
        </Button>
      </div>
    );
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      {step === "existing" && (
        <div className="rounded-lg border bg-muted/30 p-3 text-sm">
          <p className="font-medium">
            {emailCheck?.membershipStatus === "disabled"
              ? `Restore ${personLabel}'s access`
              : `Add ${personLabel} to your team`}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {emailCheck?.membershipStatus === "disabled"
              ? "They were removed earlier. Restoring brings them back as an agent with the permissions below."
              : "They already have a Whatching account, so no password is needed -- just choose their permissions."}
          </p>
        </div>
      )}
      {step === "new" && (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Name</Label>
            <Input
              value={name}
              placeholder="Staff Member"
              onChange={(event) => setName(event.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Phone number</Label>
            <PhoneNumberInput
              countryCode={countryCode}
              countryIso={countryIso}
              phoneNumber={phoneNumber}
              placeholder="8777019926"
              onCountryCodeChange={setCountryCode}
              onCountryIsoChange={setCountryIso}
              onPhoneNumberChange={setPhoneNumber}
            />
          </div>
        </div>
      )}
      {step === "new" && (
        <div className="space-y-1.5">
          <Label>Temporary password</Label>
          <Input
            type="password"
            value={password}
            placeholder="temporaryPassword123"
            onChange={(event) => setPassword(event.target.value)}
          />
        </div>
      )}
      {permissionSchema.length > 0 && (
        <div className="space-y-3 rounded-lg border bg-muted/20 p-4">
          <div>
            <p className="text-sm font-medium">Agent permissions</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Owners and admins keep full access. These permissions apply to the
              new agent account.
            </p>
          </div>
          <div className="grid max-h-72 gap-4 overflow-y-auto pr-1 sm:grid-cols-2">
            {permissionSchema.map((group) => {
              const levels = group.accessControl?.levels || [];
              const capabilities = group.capabilities || [];
              const selectedAccess =
                permissionAccess?.[group.key]?.access || "none";

              return (
                <div
                  key={group.key}
                  className="space-y-3 rounded-md border bg-white p-3"
                >
                  <div>
                    <p className="text-sm font-medium">{group.label}</p>
                    {group.description && (
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {group.description}
                      </p>
                    )}
                  </div>
                  {levels.length > 0 && (
                    <Select
                      value={selectedAccess}
                      onValueChange={(value) =>
                        setGroupAccess(
                          group.key,
                          value as PermissionAccessLevel
                        )
                      }
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {levels.map((level) => (
                          <SelectItem key={level.value} value={level.value}>
                            {level.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  {capabilities.length > 0 && (
                    <div className="space-y-1">
                      {capabilities.map((capability) => (
                        <label
                          key={capability.key}
                          className="flex cursor-pointer items-center gap-2 rounded-sm p-1.5 text-sm hover:bg-muted/50"
                        >
                          <Checkbox
                            checked={Boolean(
                              permissionAccess?.[group.key]?.capabilities?.[
                                capability.key
                              ]
                            )}
                            onCheckedChange={() =>
                              toggleCapability(group.key, capability.key)
                            }
                          />
                          <span>{capability.label}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => setStep("email")}
        >
          Back
        </Button>
        <Button type="submit" className="flex-1" isLoading={isSaving}>
          <UserPlus className="size-4" />
          {step === "existing"
            ? emailCheck?.membershipStatus === "disabled"
              ? "Restore access"
              : "Add to team"
            : "Add agent"}
        </Button>
      </div>
    </form>
  );
}

function TeamSkeleton() {
  return (
    <div className="grid gap-3">
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index} className="rounded-lg bg-white p-4 shadow-xs">
          <div className="flex items-center gap-3">
            <Skeleton className="size-10 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3 w-56" />
            </div>
            <Skeleton className="h-9 w-20" />
          </div>
        </div>
      ))}
    </div>
  );
}

function PermissionEditor({
  member,
  permissionSchema,
  isSaving,
  onSave
}: {
  member: TeamMember;
  permissionSchema: PermissionGroup[];
  isSaving: boolean;
  onSave: (permissionAccess: PermissionAccessState) => void;
}) {
  const [permissionAccess, setPermissionAccess] =
    useState<PermissionAccessState>(member.permissionAccess || {});

  useEffect(() => {
    setPermissionAccess(member.permissionAccess || {});
  }, [member]);

  return (
    <div className="space-y-4">
      <div className="grid max-h-[55vh] gap-4 overflow-y-auto pr-1 sm:grid-cols-2">
        {permissionSchema.map((group) => {
          const levels = group.accessControl?.levels || [];
          const capabilities = group.capabilities || [];
          return (
            <div
              key={group.key}
              className="space-y-3 rounded-md border bg-white p-3"
            >
              <div>
                <p className="text-sm font-medium">{group.label}</p>
                {group.description && (
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {group.description}
                  </p>
                )}
              </div>
              {levels.length > 0 && (
                <Select
                  value={permissionAccess[group.key]?.access || "none"}
                  onValueChange={(value) =>
                    setPermissionAccess((current) => ({
                      ...current,
                      [group.key]: {
                        access: value as PermissionAccessLevel,
                        capabilities: current[group.key]?.capabilities || {}
                      }
                    }))
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {levels.map((level) => (
                      <SelectItem key={level.value} value={level.value}>
                        {level.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {capabilities.map((capability) => (
                <label
                  key={capability.key}
                  className="flex cursor-pointer items-center gap-2 rounded-sm p-1.5 text-sm hover:bg-muted/50"
                >
                  <Checkbox
                    checked={Boolean(
                      permissionAccess[group.key]?.capabilities?.[
                        capability.key
                      ]
                    )}
                    onCheckedChange={() =>
                      setPermissionAccess((current) => ({
                        ...current,
                        [group.key]: {
                          access: current[group.key]?.access || "none",
                          capabilities: {
                            ...current[group.key]?.capabilities,
                            [capability.key]:
                              !current[group.key]?.capabilities?.[
                                capability.key
                              ]
                          }
                        }
                      }))
                    }
                  />
                  <span>{capability.label}</span>
                </label>
              ))}
            </div>
          );
        })}
      </div>
      <Button
        type="button"
        className="w-full"
        isLoading={isSaving}
        onClick={() => onSave(permissionAccess)}
      >
        Save permissions
      </Button>
    </div>
  );
}

function AgentsSettingsPageContent() {
  const activeOrganization = useOrganizationStore(
    (state) => state.activeOrganization
  );
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<TeamMember | null>(null);
  // Adding, editing, and removing members are owner-only on the backend.
  // While membership loads, `isOwner` is false, so the controls stay hidden
  // rather than flashing in and back out.
  const { isOwner, isLoading: isMembershipLoading } = useCurrentMembership();
  const [removeTarget, setRemoveTarget] = useState<TeamMember | null>(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["team", activeOrganization?._id],
    queryFn: getTeam,
    enabled: Boolean(activeOrganization?._id),
    refetchOnMount: "always"
  });

  const team = useMemo(() => data?.data.team || [], [data]);
  const permissionSchema = useMemo(
    () => data?.data.permissionSchema || [],
    [data?.data.permissionSchema]
  );
  const defaultPermissionAccess = useMemo(
    () => data?.data.defaultAgentPermissionAccess || {},
    [data?.data.defaultAgentPermissionAccess]
  );
  const agentCount = useMemo(
    () => team.filter((member) => member.role === "agent").length,
    [team]
  );

  const { mutate: createAgent, isPending: isAdding } = useMutation({
    mutationFn: addAgent,
    // Local toast already covers success/error messaging below -- suppress
    // the global MutationCache toast (pages/_app.tsx) to avoid duplicates.
    meta: { showToast: false },
    onSuccess: async (response) => {
      toast.success(response.message || "Agent added.");
      setIsAddOpen(false);
      await refetch();
    },
    onError: (error: AxiosError<{ message?: string }>) => {
      toast.error(error.response?.data?.message || "Couldn't add agent.");
    }
  });

  const { mutate: deleteMember, isPending: isRemoving } = useMutation({
    mutationFn: removeTeamMember,
    meta: { showToast: false },
    onSuccess: async () => {
      toast.success("Team member removed.");
      setRemoveTarget(null);
      await refetch();
    },
    onError: (error: AxiosError<{ message?: string }>) => {
      toast.error(
        error.response?.data?.message || "Couldn't remove team member."
      );
    }
  });
  const { mutate: savePermissions, isPending: isSavingPermissions } =
    useMutation({
      mutationFn: updateTeamMemberPermissions,
      meta: { showToast: false },
      onSuccess: async () => {
        toast.success("Agent permissions updated.");
        setEditTarget(null);
        await refetch();
      },
      onError: (error: AxiosError<{ message?: string }>) => {
        toast.error(
          error.response?.data?.message || "Couldn't update permissions."
        );
      }
    });

  return (
    <AppLayout>
      <div className="mx-auto max-w-7xl space-y-6">
        <SettingsBackLink />
        <section className="flex flex-col gap-4 rounded-lg bg-white p-5 shadow-xs lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-sm bg-primary/10 text-primary">
              <UsersRound className="size-5" />
            </div>
            <div>
              <p className="text-sm font-medium text-primary">Settings</p>
              <h1 className="font-heading text-3xl font-semibold">Agents</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {isOwner || isMembershipLoading
                  ? "Add staff accounts so conversations can be assigned and handled by your team."
                  : "Only the organization owner can add, edit or remove members."}
              </p>
            </div>
          </div>
          {isOwner && (
            <Button
              onClick={() => setIsAddOpen(true)}
              tooltip="Add a staff account to this organization"
            >
              <UserPlus className="size-4" />
              Add agent
            </Button>
          )}
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          <Card className="rounded-lg py-0">
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">Total members</p>
              <p className="mt-2 font-heading text-3xl font-semibold">
                {team.length}
              </p>
            </CardContent>
          </Card>
          <Card className="rounded-lg py-0">
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">Agents</p>
              <p className="mt-2 font-heading text-3xl font-semibold">
                {agentCount}
              </p>
            </CardContent>
          </Card>
          <Card className="rounded-lg py-0">
            <CardContent className="flex gap-3 p-4">
              <ShieldCheck className="mt-1 size-5 text-primary" />
              <div>
                <p className="font-medium">Owner protected</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Backend prevents removing the organization owner.
                </p>
              </div>
            </CardContent>
          </Card>
        </section>

        {isError && (
          <QueryErrorState message="Team members could not be loaded for this organisation." />
        )}

        {isLoading ? (
          <TeamSkeleton />
        ) : (
          <section className="grid gap-3">
            {team.map((member) => (
              <div
                key={member._id}
                className="flex flex-col gap-3 rounded-lg bg-white p-4 shadow-xs sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <Avatar className="size-11">
                    <AvatarFallback className="bg-primary/10 text-primary">
                      {initials(member.userId?.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate font-medium">
                        {member.userId?.name || "Team member"}
                      </p>
                      <Badge
                        variant={
                          member.role === "owner" ? "default" : "secondary"
                        }
                      >
                        {member.role}
                      </Badge>
                      <Badge variant="outline">{member.status}</Badge>
                    </div>
                    <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <Mail className="size-3.5" />
                        {member.userId?.email}
                      </span>
                      {member.userId?.phoneNumber && (
                        <span className="inline-flex items-center gap-1">
                          <Phone className="size-3.5" />
                          {member.userId.phoneNumber}
                        </span>
                      )}
                    </div>
                    {member.role === "agent" &&
                    member.effectivePermissionGrants?.length ? (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {member.effectivePermissionGrants
                          .slice(0, 5)
                          .map((permission) => (
                            <Badge
                              key={permission}
                              variant="outline"
                              className="text-[10px]"
                            >
                              {permission}
                            </Badge>
                          ))}
                        {member.effectivePermissionGrants.length > 5 && (
                          <Badge variant="outline" className="text-[10px]">
                            +{member.effectivePermissionGrants.length - 5}
                          </Badge>
                        )}
                      </div>
                    ) : null}
                  </div>
                </div>
                {isOwner && (
                  <div className="flex gap-2">
                    {member.role === "agent" && (
                      <Button
                        variant="outline"
                        tooltip="Edit this agent's permissions"
                        onClick={() => setEditTarget(member)}
                      >
                        <Pencil className="size-4" />
                        Edit
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      className="text-destructive hover:text-destructive"
                      disabled={member.role === "owner"}
                      tooltip={
                        member.role === "owner"
                          ? "The organization owner cannot be removed"
                          : "Remove this member's organization access"
                      }
                      onClick={() => setRemoveTarget(member)}
                    >
                      <Trash2 className="size-4" />
                      Remove
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </section>
        )}
      </div>

      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Add agent</DialogTitle>
          </DialogHeader>
          <div className="rounded-lg bg-muted/40 p-3 text-sm text-muted-foreground">
            The backend creates a verified staff account or links an existing
            Whatching user to this organization as an agent.
          </div>
          <AgentForm
            onSubmit={createAgent}
            isSaving={isAdding}
            permissionSchema={permissionSchema}
            defaultPermissionAccess={defaultPermissionAccess}
          />
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(editTarget)}
        onOpenChange={(open) => !open && setEditTarget(null)}
      >
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              Edit permissions for {editTarget?.userId?.name || "agent"}
            </DialogTitle>
          </DialogHeader>
          {editTarget && (
            <PermissionEditor
              key={editTarget._id}
              member={editTarget}
              permissionSchema={permissionSchema}
              isSaving={isSavingPermissions}
              onSave={(permissionAccess) =>
                savePermissions({
                  membershipId: editTarget._id,
                  permissionAccess
                })
              }
            />
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={Boolean(removeTarget)}
        onOpenChange={(open) => !open && setRemoveTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove team member?</AlertDialogTitle>
            <AlertDialogDescription>
              This revokes access for{" "}
              {removeTarget?.userId?.name || "this user"}. Existing conversation
              history remains intact.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex gap-3 rounded-sm bg-amber-50 p-3 text-sm text-amber-800">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            Assigned conversations should be reassigned after removing an agent.
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep member</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              disabled={isRemoving || !removeTarget}
              onClick={() => removeTarget && deleteMember(removeTarget._id)}
            >
              {isRemoving && <Loader2 className="size-4 animate-spin" />}
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}

export default function AgentsSettingsPage() {
  return (
    <PermissionGate permission="team:view" feature="Agents & permissions">
      <AgentsSettingsPageContent />
    </PermissionGate>
  );
}
