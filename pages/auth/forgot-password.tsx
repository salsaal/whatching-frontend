"use client";

import { Mail, KeyRound } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { useMutation } from "@tanstack/react-query";
import { forgotPassword } from "@/client-api/functions/auth";
import { AxiosError } from "axios";
import AuthLayout from "@/layouts/AuthLayout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";

// 🔥 ZOD SCHEMA
const forgotPasswordSchema = z.object({
  email: z.string().email("Enter a valid email")
});

type ForgotPasswordForm = z.infer<typeof forgotPasswordSchema>;

export default function ForgotPassword() {
  const {
    register,
    handleSubmit,
    formState: { errors },
    getValues
  } = useForm<ForgotPasswordForm>({
    resolver: zodResolver(forgotPasswordSchema)
  });

  const [timer, setTimer] = useState(0);

  // 🔥 MUTATION
  const { mutate, isPending } = useMutation({
    mutationFn: forgotPassword,

    onSuccess: (res) => {
      toast.success(res.message || "Reset link sent 📩");
      setTimer(30); // 🔥 start timer
    },

    onError: (error: AxiosError<{ message?: string }>) => {
      toast.error(error.response?.data?.message || "Something went wrong");
    }
  });

  // 🔥 TIMER LOGIC
  useEffect(() => {
    if (timer === 0) return;

    const interval = setInterval(() => {
      setTimer((prev) => prev - 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [timer]);

  // 🔥 SUBMIT
  const onSubmit = (data: ForgotPasswordForm) => {
    mutate(data);
  };

  return (
    <AuthLayout>
      <div className="max-w-md mx-auto">
        {/* ICON */}
        <div className="flex justify-center mb-3">
          <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
            <KeyRound className="text-primary size-7" />
          </div>
        </div>

        {/* HEADER */}
        <div className="text-center mb-10">
          <h1 className="text-4xl max-sm:text-3xl font-heading">
            Forgot password
          </h1>
          <p className="text-muted-foreground mt-2">
            Enter your email to receive a reset link
          </p>
        </div>

        {/* FORM */}
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

          {/* SUBMIT BUTTON */}
          <Button
            type="submit"
            className="w-full"
            isLoading={isPending}
            disabled={timer > 0}
          >
            <KeyRound className="size-4" />
            {timer > 0 ? "Plesae Wait..." : "Send reset link"}
          </Button>

          {/* TIMER / RESEND */}
          {timer > 0 ? (
            <p className="text-sm text-muted-foreground text-center mt-2">
              Resend in{" "}
              <span className="font-medium text-foreground">{timer}s</span>
            </p>
          ) : (
            <button
              type="button"
              onClick={() => mutate({ email: getValues("email") })}
              disabled={isPending}
              className="text-sm text-primary text-center w-full mt-2 hover:underline"
            >
              Resend reset link
            </button>
          )}
        </form>
      </div>
    </AuthLayout>
  );
}
