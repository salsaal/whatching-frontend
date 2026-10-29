"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { loginUser, resendVerification } from "@/client-api/functions/auth";
import { useRouter } from "next/router";
import { AxiosError } from "axios";
import AuthLayout from "@/layouts/AuthLayout";
import {
  AuthAlt,
  AuthField,
  AuthFormError,
  AuthHeader,
  AuthInput,
  AuthSubmit,
  authLinkClass,
  PasswordInput
} from "@/components/auth/AuthUI";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { useAuthStore } from "@/stores/authStore";

// 🔥 ZOD SCHEMA
const loginSchema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(6, "Password must be at least 6 characters")
});

type LoginForm = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const [formError, setFormError] = useState("");
  const [shakeKey, setShakeKey] = useState(0);
  const router = useRouter();
  const queryClient = useQueryClient();
  const setAuth = useAuthStore((state) => state.setAuth);
  const {
    register,
    handleSubmit,
    formState: { errors }
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema)
  });
  const onSubmit = (data: LoginForm) => {
    setFormError("");
    mutate(data);
  };
  const { mutate, isPending } = useMutation({
    mutationFn: loginUser,

    onSuccess: (data) => {
      setAuth({
        token: data.token,
        user: data.data.user
      });
      queryClient.clear();

      toast.success("Login successful");

      // 🔥 REDIRECT
      router.push((router.query.next as string) || "/organisations");
    },

    onError: async (error: AxiosError<{ message?: string }>, variables) => {
      const message = error.response?.data?.message || "Login failed";

      if (message === "Please verify your email to log in.") {
        try {
          const response = await resendVerification({ email: variables.email });
          toast.success(
            response.message || "Verification link sent. Check your email."
          );
        } catch (resendError) {
          const resendMessage =
            resendError instanceof AxiosError
              ? resendError.response?.data?.message
              : undefined;
          toast.error(resendMessage || "Unable to send verification link.");
        } finally {
          router.push({
            pathname: "/auth/verify",
            query: { email: variables.email, resent: "1" }
          });
        }
        return;
      }

      // Shown in the card (with a shake) rather than as a toast.
      setFormError(message);
      setShakeKey((current) => current + 1);
    }
  });

  return (
    <AuthLayout shakeKey={shakeKey}>
      <AuthHeader
        title="Welcome back"
        subtitle="Your conversations are waiting."
        live
      />

      <form
        onSubmit={handleSubmit(onSubmit, () =>
          setShakeKey((current) => current + 1)
        )}
        className="mt-6 grid gap-4"
        noValidate
      >
        <AuthField
          label="Email"
          htmlFor="login-email"
          error={errors.email?.message}
          delay={0.18}
        >
          <AuthInput
            id="login-email"
            type="email"
            autoComplete="email"
            placeholder="you@company.com"
            aria-invalid={Boolean(errors.email)}
            {...register("email")}
          />
        </AuthField>

        <AuthField
          label="Password"
          htmlFor="login-password"
          error={errors.password?.message}
          delay={0.26}
          aside={
            <Link
              href="/auth/forgot-password"
              className={cn(authLinkClass, "text-[13px]")}
            >
              Forgot?
            </Link>
          }
        >
          <PasswordInput
            id="login-password"
            autoComplete="current-password"
            placeholder="Your password"
            aria-invalid={Boolean(errors.password)}
            {...register("password")}
          />
        </AuthField>

        <AuthFormError message={formError} />

        <AuthSubmit isLoading={isPending}>Log in</AuthSubmit>
      </form>

      <AuthAlt>
        New here?{" "}
        <Link href="/auth/signup" className={authLinkClass}>
          Create an account
        </Link>
      </AuthAlt>
    </AuthLayout>
  );
}
