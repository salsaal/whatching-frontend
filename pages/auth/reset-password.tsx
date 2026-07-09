"use client";

import { useState } from "react";
import { Eye, EyeOff, Lock, KeyRound } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { resetPassword } from "@/api/functions/auth";
import { useRouter } from "next/router";
import { AxiosError } from "axios";
import AuthLayout from "@/layouts/AuthLayout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
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
  const [show, setShow] = useState(false);
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
      toast.error(error.response?.data?.message || "Reset failed");
    }
  });

  const onSubmit = (data: ResetForm) => {
    if (!token) {
      toast.error("Invalid or missing reset token");
      return;
    }

    mutate({
      token,
      payload: {
        password: data.password,
        passwordConfirm: data.confirmPassword
      }
    });
  };
  return (
    <AuthLayout>
      <div className="max-w-md mx-auto">
        {/* 🔥 TOP ICON */}
        <div className="flex justify-center mb-3">
          <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
            <KeyRound className="text-primary size-7" />
          </div>
        </div>

        {/* 🔥 HEADER */}
        <div className="text-center mb-10">
          <h1 className="text-4xl font-heading max-sm:text-3xl">
            Reset password
          </h1>
          <p className="text-muted-foreground mt-2">
            Enter your new password below
          </p>
        </div>

        {/* 🔥 FORM */}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          {/* PASSWORD */}
          <div className="relative">
            <Lock className="absolute left-3 top-3.5 size-4 text-muted-foreground" />
            <Input
              type={show ? "text" : "password"}
              placeholder="New password"
              className="pl-9 pr-9"
              {...register("password")}
            />
            <span
              onClick={() => setShow(!show)}
              className="absolute right-3 top-3 cursor-pointer text-muted-foreground"
            >
              {show ? <EyeOff size={18} /> : <Eye size={18} />}
            </span>
            <p className="text-xs text-red-500 mt-1">
              {errors.password?.message}
            </p>
          </div>

          {/* CONFIRM PASSWORD */}
          <div className="relative">
            <Lock className="absolute left-3 top-3.5 size-4 text-muted-foreground" />
            <Input
              type={show ? "text" : "password"}
              placeholder="Confirm password"
              className="pl-9"
              {...register("confirmPassword")}
            />
            <p className="text-xs text-red-500 mt-1">
              {errors.confirmPassword?.message}
            </p>
          </div>

          {/* SUBMIT */}
          <Button type="submit" className="w-full" isLoading={isPending}>
            <KeyRound className="size-4" />
            Reset password
          </Button>
        </form>
      </div>
    </AuthLayout>
  );
}
