"use client";

import {
  AlertTriangle,
  Loader2,
  Mail,
  Phone,
  ShieldCheck,
  Trash2,
  UserPlus,
  UsersRound
} from "lucide-react";
import { FormEvent, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

import {
  addAgent,
  getTeam,
  removeTeamMember
} from "@/client-api/functions/organizations";
import { TeamMember } from "@/client-api/types/organizations.type";
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
import { Card, CardContent } from "@/components/ui/card";
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
import { Skeleton } from "@/components/ui/skeleton";
import AppLayout from "@/layouts/AppLayout";
import { useOrganizationStore } from "@/stores/organizationStore";

const initials = (name?: string) =>
  (name || "A")
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

function AgentForm({
  onSubmit,
  isSaving
}: {
  onSubmit: (payload: {
    name: string;
    email: string;
    phoneNumber: string;
    countryIso: string;
    password: string;
  }) => void;
  isSaving: boolean;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [countryCode, setCountryCode] = useState("+91");
  const [countryIso, setCountryIso] = useState("IN");
  const [password, setPassword] = useState("");

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim() || !email.trim() || !phoneNumber.trim() || !password) {
      toast.error("Add name, email, phone number, and temporary password.");
      return;
    }
    onSubmit({
      name: name.trim(),
      email: email.trim(),
      phoneNumber: buildInternationalPhoneNumber(countryCode, phoneNumber),
      countryIso,
      password
    });
  };

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
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
          <Label>Email</Label>
          <Input
            type="email"
            value={email}
            placeholder="staff@whatching.com"
            onChange={(event) => setEmail(event.target.value)}
          />
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
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
        <div className="space-y-1.5">
          <Label>Temporary password</Label>
          <Input
            type="password"
            value={password}
            placeholder="temporaryPassword123"
            onChange={(event) => setPassword(event.target.value)}
          />
        </div>
      </div>
      <Button type="submit" className="w-full" isLoading={isSaving}>
        <UserPlus className="size-4" />
        Add agent
      </Button>
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

export default function AgentsSettingsPage() {
  const activeOrganization = useOrganizationStore(
    (state) => state.activeOrganization
  );
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<TeamMember | null>(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["team", activeOrganization?._id],
    queryFn: getTeam,
    enabled: Boolean(activeOrganization?._id),
    refetchOnMount: "always"
  });

  const team = useMemo(() => data?.data.team || [], [data]);
  const agentCount = useMemo(
    () => team.filter((member) => member.role === "agent").length,
    [team]
  );

  const { mutate: createAgent, isPending: isAdding } = useMutation({
    mutationFn: addAgent,
    onSuccess: async (response) => {
      toast.success(response.message || "Agent added.");
      setIsAddOpen(false);
      await refetch();
    }
  });

  const { mutate: deleteMember, isPending: isRemoving } = useMutation({
    mutationFn: removeTeamMember,
    onSuccess: async () => {
      toast.success("Team member removed.");
      setRemoveTarget(null);
      await refetch();
    }
  });

  return (
    <AppLayout>
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="flex flex-col gap-4 rounded-lg bg-white p-5 shadow-xs lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-sm bg-primary/10 text-primary">
              <UsersRound className="size-5" />
            </div>
            <div>
              <p className="text-sm font-medium text-primary">Settings</p>
              <h1 className="font-heading text-3xl font-semibold">Agents</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Add staff accounts so conversations can be assigned and handled
                by your team.
              </p>
            </div>
          </div>
          <Button onClick={() => setIsAddOpen(true)}>
            <UserPlus className="size-4" />
            Add agent
          </Button>
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
                        variant={member.role === "owner" ? "default" : "secondary"}
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
                  </div>
                </div>
                <Button
                  variant="outline"
                  className="text-destructive hover:text-destructive"
                  disabled={member.role === "owner"}
                  onClick={() => setRemoveTarget(member)}
                >
                  <Trash2 className="size-4" />
                  Remove
                </Button>
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
          <AgentForm onSubmit={createAgent} isSaving={isAdding} />
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
              This revokes access for {removeTarget?.userId?.name || "this user"}
              . Existing conversation history remains intact.
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
