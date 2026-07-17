"use client";

import { useState } from "react";
import { Eye, EyeOff, Mail, Lock, LogIn, User } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { loginUser } from "@/client-api/functions/auth";
import { useRouter } from "next/router";
import { AxiosError } from "axios";
import AuthLayout from "@/layouts/AuthLayout";
import { Input } from "@/components/ui/input";
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

    onError: (error: AxiosError<{ message?: string }>) => {
      toast.error(error.response?.data?.message || "Login failed");
    }
  });

  return (
    <AuthLayout>
      <div className="w-full max-w-md mx-auto">
        {/* ICON */}
        <div className="flex justify-center mb-3">
          <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
            <LogIn className="text-primary size-7" />
          </div>
        </div>

        {/* HEADER */}
        <div className="mb-10 text-center">
          <h1 className="font-heading text-4xl max-sm:text-3xl">
            Welcome back
          </h1>
          <p className="mt-3 text-muted-foreground">
            Login to continue building your flows
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          {/* EMAIL */}
          <div className="relative">
            <Mail className="absolute left-3 top-3.5 size-4 text-muted-foreground" />
            <Input
              placeholder="Email address"
              className="pl-9"
              {...register("email")}
            />
            <p className="text-xs text-red-500 mt-1">{errors.email?.message}</p>
          </div>

          {/* PASSWORD */}
          <div className="relative">
            <Lock className="absolute left-3 top-3.5 size-4 text-muted-foreground" />
            <Input
              type={showPassword ? "text" : "password"}
              placeholder="Password"
              className="pl-9 pr-9"
              {...register("password")}
            />
            <span
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-3 cursor-pointer text-muted-foreground"
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </span>
            <p className="text-xs text-red-500 mt-1">
              {errors.password?.message}
            </p>
          </div>

          {/* FORGOT */}
          <Link href="/auth/forgot-password" className="flex justify-end">
            <span className="text-sm text-primary cursor-pointer hover:underline">
              Forgot password?
            </span>
          </Link>

          {/* SUBMIT */}
          <Button type="submit" className="w-full" isLoading={isPending}>
            <LogIn className="size-4" />
            Login
          </Button>
          {/* Signup LINK */}
          <div className="text-center text-sm mt-4 font-body">
            <span className="inline-flex items-center gap-2 justify-center">
              <User className="size-4 text-muted-foreground" />
              <span>
                Don&apos;t have an account?{" "}
                <Link href={"/auth/signup"}>
                  <span className="text-primary font-medium cursor-pointer hover:underline">
                    Create Account
                  </span>
                </Link>
              </span>
            </span>
          </div>
        </form>
      </div>
    </AuthLayout>
  );
}
