"use client";

import Link from "next/link";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { useMutation } from "@tanstack/react-query";
import { forgotPassword } from "@/client-api/functions/auth";
import { AxiosError } from "axios";
import AuthLayout from "@/layouts/AuthLayout";
import {
  AuthAlt,
  AuthField,
  AuthFormError,
  AuthHeader,
  AuthInput,
  AuthSubmit,
  authLinkClass
} from "@/components/auth/AuthUI";
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
  const [formError, setFormError] = useState("");
  const [shakeKey, setShakeKey] = useState(0);
  const shake = () => setShakeKey((current) => current + 1);

  // 🔥 MUTATION
  const { mutate, isPending } = useMutation({
    mutationFn: forgotPassword,

    onSuccess: (res) => {
      toast.success(res.message || "Reset link sent 📩");
      setTimer(30); // 🔥 start timer
    },

    onError: (error: AxiosError<{ message?: string }>) => {
      setFormError(error.response?.data?.message || "Something went wrong");
      shake();
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
    setFormError("");
    mutate(data);
  };

  return (
    <AuthLayout shakeKey={shakeKey}>
      <AuthHeader
        title="Forgot your password?"
        subtitle="We'll email you a link to reset it."
      />

      <form
        onSubmit={handleSubmit(onSubmit, shake)}
        className="mt-6 grid gap-4"
        noValidate
      >
        <AuthField
          label="Email"
          htmlFor="forgot-email"
          error={errors.email?.message}
          delay={0.18}
        >
          <AuthInput
            id="forgot-email"
            type="email"
            autoComplete="email"
            placeholder="you@company.com"
            aria-invalid={Boolean(errors.email)}
            {...register("email")}
          />
        </AuthField>

        <AuthFormError message={formError} />

        <AuthSubmit isLoading={isPending} disabled={timer > 0} delay={0.26}>
          {timer > 0 ? "Link sent" : "Send reset link"}
        </AuthSubmit>

        {timer > 0 ? (
          <p className="text-center text-sm text-muted-foreground">
            Didn&apos;t get it? You can resend in{" "}
            <span className="font-medium text-foreground">{timer}s</span>
          </p>
        ) : (
          getValues("email") && (
            <button
              type="button"
              onClick={() => mutate({ email: getValues("email") })}
              disabled={isPending}
              className={`${authLinkClass} w-full cursor-pointer text-center text-sm`}
            >
              Resend reset link
            </button>
          )
        )}
      </form>

      <AuthAlt delay={0.34}>
        Remembered it?{" "}
        <Link href="/auth/login" className={authLinkClass}>
          Log in
        </Link>
      </AuthAlt>
    </AuthLayout>
  );
}
