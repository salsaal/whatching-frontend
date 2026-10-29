"use client";

import { useState } from "react";
import { ArrowRight, Eye, EyeOff } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { loginUser, resendVerification } from "@/client-api/functions/auth";
import { useRouter } from "next/router";
import { AxiosError } from "axios";
import AuthLayout from "@/layouts/AuthLayout";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { useAuthStore } from "@/stores/authStore";

// 🔥 ZOD SCHEMA
const loginSchema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(6, "Password must be at least 6 characters")
});

type LoginForm = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const [showPassword, setShowPassword] = useState(false);
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

      toast.error(message);
    }
  });

  return (
    <AuthLayout>
      <div className="w-full">
        <div className="mb-8">
          <h1 className="font-heading text-3xl font-semibold tracking-tight">
            Welcome back
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Log in to your Whatching workspace.
          </p>
        </div>

        <form
          onSubmit={handleSubmit(onSubmit)}
          className="space-y-5"
          noValidate
        >
          <div className="space-y-1.5">
            <Label htmlFor="login-email">Email</Label>
            <Input
              id="login-email"
              type="email"
              autoComplete="email"
              placeholder="you@company.com"
              aria-invalid={Boolean(errors.email)}
              className="bg-white"
              {...register("email")}
            />
            {errors.email && (
              <p className="text-xs text-destructive">{errors.email.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="login-password">Password</Label>
              <Link
                href="/auth/forgot-password"
                className="text-xs font-medium text-primary hover:underline"
              >
                Forgot password?
              </Link>
            </div>
            <div className="relative">
              <Input
                id="login-password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                placeholder="Your password"
                aria-invalid={Boolean(errors.password)}
                className="bg-white pr-11"
                {...register("password")}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                className="absolute inset-y-0 right-0 flex w-11 cursor-pointer items-center justify-center text-muted-foreground outline-none hover:text-foreground focus-visible:text-foreground"
              >
                {showPassword ? (
                  <EyeOff className="size-4" />
                ) : (
                  <Eye className="size-4" />
                )}
              </button>
            </div>
            {errors.password && (
              <p className="text-xs text-destructive">
                {errors.password.message}
              </p>
            )}
          </div>

          <Button type="submit" className="w-full" isLoading={isPending}>
            Log in
            <ArrowRight className="size-4" />
          </Button>
        </form>

        <p className="mt-8 text-center text-sm text-muted-foreground">
          New to Whatching?{" "}
          <Link
            href="/auth/signup"
            className="font-medium text-primary hover:underline"
          >
            Create an account
          </Link>
        </p>
      </div>
    </AuthLayout>
  );
}
