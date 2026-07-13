"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Eye,
  EyeOff,
  Mail,
  User,
  Lock,
  LogIn,
  UserPlus,
  RefreshCcw
} from "lucide-react";
import { toast } from "sonner";
import AuthLayout from "@/layouts/AuthLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import PhoneNumberInput, {
  buildInternationalPhoneNumber
} from "@/components/ui/phone-number-input";
import { useMutation } from "@tanstack/react-query";
import { resendVerification, signupUser } from "@/api/functions/auth";
import Link from "next/link";
import { AxiosError } from "axios";
const signupSchema = z
  .object({
    firstName: z.string().min(2, "First name is required"),
    lastName: z.string().min(2, "Last name is required"),
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
  const [showPassword, setShowPassword] = useState(false);
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
    mutate({
      name: `${data.firstName} ${data.lastName}`,
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
      console.log("SIGNUP ERROR:", error);
      console.log("RESPONSE:", error?.response);

      toast.error(error?.response?.data?.message || "Signup failed");
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
  return (
    <AuthLayout>
      <div className="w-full max-w-md mx-auto">
        {/* 🔥 TOP ICON */}
        <div className="flex justify-center mb-3 max-sm:mt-10">
          <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
            <User className="text-primary size-7 font-bold" />
          </div>
        </div>

        {/* 🔥 HEADER */}
        {!isEmailSent && (
          <div className="mb-10 text-center">
            <h1 className="font-heading text-4xl max-sm:text-3xl font-medium leading-tight">
              Create account
            </h1>
            <p className="mt-3 text-base text-muted-foreground font-body">
              Start building WhatsApp flows & capturing leads
            </p>
          </div>
        )}

        {/* 🔥 FORM */}
        {!isEmailSent ? (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            {/* NAME */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="relative">
                <User className="absolute left-3 top-3.5 size-4 text-muted-foreground" />
                <Input
                  placeholder="First name"
                  className="pl-9"
                  {...register("firstName")}
                />
                <p className="text-xs text-red-500 mt-1">
                  {errors.firstName?.message}
                </p>
              </div>

              <div className="relative">
                <User className="absolute left-3 top-3.5 size-4 text-muted-foreground" />
                <Input
                  placeholder="Last name"
                  className="pl-9"
                  {...register("lastName")}
                />
                <p className="text-xs text-red-500 mt-1">
                  {errors.lastName?.message}
                </p>
              </div>
            </div>

            {/* EMAIL */}
            <div className="relative">
              <Mail className="absolute left-3 top-3.5 size-4 text-muted-foreground" />
              <Input
                type="email"
                placeholder="Email address"
                className="pl-9"
                {...register("email")}
              />
              <p className="text-xs text-red-500 mt-1">
                {errors.email?.message}
              </p>
            </div>

            {/* PHONE */}
            <div>
              <PhoneNumberInput
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
              <p className="text-xs text-red-500 mt-1">
                {errors.phone?.message}
              </p>
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

            {/* CONFIRM PASSWORD */}
            <div className="relative">
              <Lock className="absolute left-3 top-3.5 size-4 text-muted-foreground" />
              <Input
                type={showPassword ? "text" : "password"}
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
              <UserPlus className="size-4" />
              Create account
            </Button>

            {/* LOGIN LINK */}
            <div className="text-center text-sm mt-4 font-body">
              <span className="inline-flex items-center gap-2 justify-center">
                <LogIn className="size-4 text-muted-foreground" />
                <span>
                  Already have an account?{" "}
                  <Link href={"/auth/login"}>
                    <span className="text-primary font-medium cursor-pointer hover:underline">
                      Login
                    </span>
                  </Link>
                </span>
              </span>
            </div>
          </form>
        ) : (
          // ✅ SUCCESS STATE
          <div className="text-center mt-6">
            <h2 className="text-2xl font-heading font-medium">
              Check your email 📩
            </h2>

            <p className="text-muted-foreground mt-3 text-sm">
              We’ve sent a verification link to
            </p>

            <p className="font-medium mt-1">{userEmail}</p>

            {/* 🔥 TIMER / RESEND */}
            <div className="mt-6 text-sm">
              {timer > 0 ? (
                <p className="text-muted-foreground">
                  Resend link in{" "}
                  <span className="font-medium text-foreground">{timer}s</span>
                </p>
              ) : (
                <button
                  onClick={() => resendMutate({ email: userEmail })}
                  disabled={isResending}
                  className="text-primary cursor-pointer font-medium hover:underline inline-flex items-center gap-2"
                >
                  <RefreshCcw className="size-4" />
                  Resend verification link
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </AuthLayout>
  );
}
