"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { resetPassword } from "@/client-api/functions/auth";
import { useRouter } from "next/router";
import { AxiosError } from "axios";
import AuthLayout from "@/layouts/AuthLayout";
import {
  AuthAlt,
  AuthField,
  AuthFormError,
  AuthHeader,
  AuthSubmit,
  authLinkClass,
  PasswordInput
} from "@/components/auth/AuthUI";
import { useAuthStore } from "@/stores/authStore";

// 🔥 ZOD SCHEMA
const resetSchema = z
  .object({
    password: z.string().min(6, "Password must be at least 6 characters"),
    confirmPassword: z.string()
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"]
  });

type ResetForm = z.infer<typeof resetSchema>;

export default function ResetPassword() {
  const [formError, setFormError] = useState("");
  const [shakeKey, setShakeKey] = useState(0);
  const shake = () => setShakeKey((current) => current + 1);
  const router = useRouter();
  const queryClient = useQueryClient();
  const setAuth = useAuthStore((state) => state.setAuth);
  const { token } = router.query as { token?: string };
  const {
    register,
    handleSubmit,
    formState: { errors }
  } = useForm<ResetForm>({
    resolver: zodResolver(resetSchema)
  });

  const { mutate, isPending } = useMutation({
    mutationFn: resetPassword,

    onSuccess: (res) => {
      setAuth({
        token: res.token,
        user: res.data.user
      });
      queryClient.clear();

      toast.success("Password reset successful 🔐");

      router.push("/organisations");
    },

    onError: (error: AxiosError<{ message?: string }>) => {
      setFormError(error.response?.data?.message || "Reset failed");
      shake();
    }
  });

  const onSubmit = (data: ResetForm) => {
    if (!token) {
      setFormError("This reset link is invalid. Request a new one.");
      shake();
      return;
    }
    setFormError("");

    mutate({
      token,
      payload: {
        password: data.password,
        passwordConfirm: data.confirmPassword
      }
    });
  };
  return (
    <AuthLayout shakeKey={shakeKey}>
      <AuthHeader
        title="Set a new password"
        subtitle="Choose something you haven't used before."
      />

      <form
        onSubmit={handleSubmit(onSubmit, shake)}
        className="mt-6 grid gap-4"
        noValidate
      >
        <AuthField
          label="New password"
          htmlFor="reset-password"
          error={errors.password?.message}
          delay={0.18}
        >
          <PasswordInput
            id="reset-password"
            autoComplete="new-password"
            placeholder="At least 6 characters"
            aria-invalid={Boolean(errors.password)}
            {...register("password")}
          />
        </AuthField>

        <AuthField
          label="Confirm password"
          htmlFor="reset-confirm-password"
          error={errors.confirmPassword?.message}
          delay={0.26}
        >
          <PasswordInput
            id="reset-confirm-password"
            autoComplete="new-password"
            placeholder="Type it again"
            aria-invalid={Boolean(errors.confirmPassword)}
            {...register("confirmPassword")}
          />
        </AuthField>

        <AuthFormError message={formError} />

        <AuthSubmit isLoading={isPending}>Reset password</AuthSubmit>
      </form>

      <AuthAlt>
        <Link href="/auth/login" className={authLinkClass}>
          Back to log in
        </Link>
      </AuthAlt>
    </AuthLayout>
  );
}
