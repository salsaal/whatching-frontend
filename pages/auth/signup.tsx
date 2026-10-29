"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { MailCheck, RefreshCcw } from "lucide-react";
import { toast } from "sonner";
import AuthLayout from "@/layouts/AuthLayout";
import { cn } from "@/lib/utils";
import {
  AuthAlt,
  AuthField,
  AuthFormError,
  AuthHeader,
  AuthInput,
  AuthSubmit,
  authInputClass,
  authLinkClass,
  enter,
  PasswordInput
} from "@/components/auth/AuthUI";
import PhoneNumberInput, {
  buildInternationalPhoneNumber
} from "@/components/ui/phone-number-input";
import { useMutation } from "@tanstack/react-query";
import { resendVerification, signupUser } from "@/client-api/functions/auth";
import Link from "next/link";
import { AxiosError } from "axios";
const signupSchema = z
  .object({
    firstName: z.string().min(2, "First name is required"),
    lastName: z.string().trim().optional(),
    email: z.string().email("Invalid email"),
    phone: z.string().min(8, "Invalid phone number"),
    password: z.string().min(8, "Minimum 8 characters"),
    confirmPassword: z.string()
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"]
  });

type SignupForm = z.infer<typeof signupSchema>;

export default function SignupPage() {
  const [formError, setFormError] = useState("");
  const [shakeKey, setShakeKey] = useState(0);
  const shake = () => setShakeKey((current) => current + 1);
  const [isEmailSent, setIsEmailSent] = useState(false);
  const [userEmail, setUserEmail] = useState("");
  const [timer, setTimer] = useState(30);
  const [countryCode, setCountryCode] = useState("+91");
  const [countryIso, setCountryIso] = useState("IN");
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors }
  } = useForm<SignupForm>({
    resolver: zodResolver(signupSchema)
  });
  const watchedPhone = watch("phone") || "";

  useEffect(() => {
    if (!isEmailSent || timer === 0) return;

    const interval = setInterval(() => {
      setTimer((prev) => prev - 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [isEmailSent, timer]);

  const onSubmit = (data: SignupForm) => {
    setFormError("");
    mutate({
      name: [data.firstName, data.lastName].filter(Boolean).join(" "),
      email: data.email,
      phoneNumber: buildInternationalPhoneNumber(countryCode, data.phone),
      countryIso,
      password: data.password,
      passwordConfirm: data.confirmPassword
    });
  };
  const { mutate, isPending } = useMutation({
    mutationFn: signupUser,
    onSuccess: (data, variables) => {
      toast.success(data.message);

      setUserEmail(variables.email);
      setIsEmailSent(true);
    },
    onError: (error: AxiosError<{ message?: string }>) => {
      setFormError(error?.response?.data?.message || "Signup failed");
      shake();
    }
  });

  const { mutate: resendMutate, isPending: isResending } = useMutation({
    mutationFn: resendVerification, // you already created earlier
    onSuccess: (data) => {
      toast.success(data.message || "Verification link sent");
      setTimer(30); // 🔥 reset timer
    },
    onError: (error: AxiosError<{ message?: string }>) => {
      toast.error(error?.response?.data?.message || "Failed to resend");
    }
  });
  const phoneMotion = enter(0.3);

  return (
    <AuthLayout shakeKey={shakeKey}>
      {!isEmailSent ? (
        <>
          <AuthHeader
            title="Create your account"
            subtitle="Start free, no credit card needed."
            live
          />

          <form
            onSubmit={handleSubmit(onSubmit, shake)}
            className="mt-6 grid gap-4"
            noValidate
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <AuthField
                label="First name"
                htmlFor="signup-first-name"
                error={errors.firstName?.message}
                delay={0.18}
              >
                <AuthInput
                  id="signup-first-name"
                  autoComplete="given-name"
                  placeholder="Aisha"
                  aria-invalid={Boolean(errors.firstName)}
                  {...register("firstName")}
                />
              </AuthField>
              <AuthField
                label="Last name"
                htmlFor="signup-last-name"
                error={errors.lastName?.message}
                delay={0.18}
                aside={
                  <span className="text-xs text-muted-foreground">
                    Optional
                  </span>
                }
              >
                <AuthInput
                  id="signup-last-name"
                  autoComplete="family-name"
                  placeholder="Khan"
                  {...register("lastName")}
                />
              </AuthField>
            </div>

            <AuthField
              label="Work email"
              htmlFor="signup-email"
              error={errors.email?.message}
              delay={0.22}
            >
              <AuthInput
                id="signup-email"
                type="email"
                autoComplete="email"
                placeholder="you@company.com"
                aria-invalid={Boolean(errors.email)}
                {...register("email")}
              />
            </AuthField>

            <div
              className={cn("grid gap-[7px]", phoneMotion.className)}
              style={phoneMotion.style}
            >
              <label
                htmlFor="signup-phone"
                className="text-[13.5px] font-semibold"
              >
                Phone
              </label>
              <PhoneNumberInput
                id="signup-phone"
                inputClassName={authInputClass}
                selectClassName={cn(authInputClass, "px-2")}
                countryCode={countryCode}
                countryIso={countryIso}
                phoneNumber={watchedPhone}
                placeholder="9876543210"
                onCountryCodeChange={setCountryCode}
                onCountryIsoChange={setCountryIso}
                onPhoneNumberChange={(value) =>
                  setValue("phone", value, { shouldValidate: true })
                }
              />
              <input type="hidden" {...register("phone")} />
              {errors.phone && (
                <p className="text-xs text-destructive">
                  {errors.phone.message}
                </p>
              )}
            </div>

            <AuthField
              label="Password"
              htmlFor="signup-password"
              error={errors.password?.message}
              delay={0.26}
            >
              <PasswordInput
                id="signup-password"
                autoComplete="new-password"
                placeholder="At least 8 characters"
                aria-invalid={Boolean(errors.password)}
                {...register("password")}
              />
            </AuthField>

            <AuthField
              label="Confirm password"
              htmlFor="signup-confirm-password"
              error={errors.confirmPassword?.message}
              delay={0.3}
            >
              <PasswordInput
                id="signup-confirm-password"
                autoComplete="new-password"
                placeholder="Type it again"
                aria-invalid={Boolean(errors.confirmPassword)}
                {...register("confirmPassword")}
              />
            </AuthField>

            <AuthFormError message={formError} />

            <AuthSubmit isLoading={isPending}>Create account</AuthSubmit>
          </form>

          <AuthAlt>
            Already have an account?{" "}
            <Link href="/auth/login" className={authLinkClass}>
              Log in
            </Link>
          </AuthAlt>
        </>
      ) : (
        <div className="text-center">
          <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-accent text-primary">
            <MailCheck className="size-6" />
          </span>
          <div className="mt-4">
            <AuthHeader
              title="Check your email"
              subtitle={
                <span className="mx-auto">
                  We sent a verification link to{" "}
                  <span className="font-medium text-foreground">
                    {userEmail}
                  </span>
                </span>
              }
            />
          </div>
          <div className="mt-6 text-sm">
            {timer > 0 ? (
              <p className="text-muted-foreground">
                Resend link in{" "}
                <span className="font-medium text-foreground">{timer}s</span>
              </p>
            ) : (
              <button
                type="button"
                onClick={() => resendMutate({ email: userEmail })}
                disabled={isResending}
                className={`${authLinkClass} inline-flex cursor-pointer items-center gap-2`}
              >
                <RefreshCcw className="size-4" />
                Resend verification link
              </button>
            )}
          </div>
        </div>
      )}
    </AuthLayout>
  );
}
