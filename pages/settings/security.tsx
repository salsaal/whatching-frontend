"use client";

import { KeyRound, ShieldCheck } from "lucide-react";
import { FormEvent, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { AxiosError } from "axios";
import { toast } from "sonner";

import { updatePassword } from "@/client-api/functions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SettingsBackLink } from "@/components/settings/SettingsBackLink";
import AppLayout from "@/layouts/AppLayout";
import { useAuthStore } from "@/stores/authStore";

const MIN_PASSWORD_LENGTH = 8;

export default function SecuritySettingsPage() {
  const setToken = useAuthStore((state) => state.setToken);
  const [currentPassword, setCurrentPassword] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [formError, setFormError] = useState("");

  const { mutate: changePassword, isPending } = useMutation({
    mutationFn: updatePassword,
    meta: { showToast: false },
    onSuccess: (response) => {
      // Changing the password invalidates every token issued before it, so
      // the very next request would 401 without swapping in the new one.
      setToken(response.token);
      setCurrentPassword("");
      setPassword("");
      setPasswordConfirm("");
      setFormError("");
      toast.success("Password updated.");
    },
    onError: (error: AxiosError<{ message?: string }>) => {
      const status = error.response?.status;
      const message =
        status === 401
          ? "Your current password is incorrect."
          : status === 429
            ? "Too many attempts. Please wait a while before trying again."
            : error.response?.data?.message ||
              "Couldn't update your password. Try again.";
      setFormError(message);
    }
  });

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!currentPassword) {
      setFormError("Enter your current password.");
      return;
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      setFormError(
        `New password must be at least ${MIN_PASSWORD_LENGTH} characters.`
      );
      return;
    }
    if (password !== passwordConfirm) {
      setFormError("New passwords don't match.");
      return;
    }
    if (password === currentPassword) {
      setFormError("New password must be different from your current one.");
      return;
    }
    setFormError("");
    changePassword({ currentPassword, password, passwordConfirm });
  };

  return (
    <AppLayout>
      <div className="mx-auto max-w-3xl space-y-4">
        <SettingsBackLink />
        <section className="rounded-lg bg-white p-5 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-sm bg-primary/10 text-primary">
              <ShieldCheck className="size-5" />
            </div>
            <div>
              <h1 className="font-heading text-xl font-semibold">Security</h1>
              <p className="text-sm text-muted-foreground">
                Manage the password for your own login.
              </p>
            </div>
          </div>
        </section>

        <form
          onSubmit={handleSubmit}
          className="space-y-4 rounded-lg bg-white p-5 shadow-xs"
        >
          <h2 className="font-heading text-base font-semibold">
            Change password
          </h2>
          <div className="space-y-1.5">
            <Label htmlFor="current-password">Current password</Label>
            <Input
              id="current-password"
              type="password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="new-password">New password</Label>
              <Input
                id="new-password"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                At least {MIN_PASSWORD_LENGTH} characters.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="confirm-password">Confirm new password</Label>
              <Input
                id="confirm-password"
                type="password"
                autoComplete="new-password"
                value={passwordConfirm}
                onChange={(event) => setPasswordConfirm(event.target.value)}
              />
            </div>
          </div>
          {formError && (
            <p className="rounded-sm bg-destructive/10 p-3 text-sm text-destructive">
              {formError}
            </p>
          )}
          <Button type="submit" isLoading={isPending}>
            <KeyRound className="size-4" />
            Update password
          </Button>
        </form>
      </div>
    </AppLayout>
  );
}
