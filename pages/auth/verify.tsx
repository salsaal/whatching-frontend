"use client";

import { useEffect, useRef, useState } from "react";
import { ShieldCheck, Loader2, ArrowRight, RefreshCcw } from "lucide-react";
import { useRouter } from "next/router";
import { toast } from "sonner";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import AuthLayout from "@/layouts/AuthLayout";
import { Button } from "@/components/ui/button";
import { verifyEmail, resendVerification } from "@/api/functions/auth";
import { useAuthStore } from "@/stores/authStore";
import { AxiosError } from "axios";

export default function VerifyPage() {
  const router = useRouter();
  const token = Array.isArray(router.query.token)
    ? router.query.token[0]
    : router.query.token;
  const email = Array.isArray(router.query.email)
    ? router.query.email[0]
    : router.query.email;

  const [status, setStatus] = useState<"loading" | "success" | "error">(
    "loading"
  );
  const queryClient = useQueryClient();
  const setAuth = useAuthStore((state) => state.setAuth);
  const verifiedTokenRef = useRef<string | null>(null);
  const missingTokenHandledRef = useRef(false);

  // 🔥 VERIFY MUTATION
  const { mutate: verifyMutate } = useMutation({
    mutationFn: verifyEmail,
    onSuccess: (data) => {
      const accessToken = data.token;

      if (accessToken) {
        setAuth({
          token: accessToken,
          user: data.data.user
        });
        queryClient.clear();
      }

      toast.success(data.message || "Email verified successfully");
      setStatus("success");
    },
    onError: (error: AxiosError<{ message?: string }>) => {
      toast.error(error?.response?.data?.message || "Verification failed");
      setStatus("error");
    }
  });

  // 🔥 RESEND MUTATION
  const { mutate: resendMutate, isPending: isResending } = useMutation({
    mutationFn: resendVerification,
    onSuccess: (data) => {
      toast.success(data.message || "Verification link sent");
    },
    onError: (error: AxiosError<{ message?: string }>) => {
      toast.error(error?.response?.data?.message || "Failed to resend");
    }
  });

  // 🔥 HANDLE VERIFY ON LOAD
  useEffect(() => {
    if (!router.isReady) return;

    // ❌ NO TOKEN → ERROR STATE
    if (!token) {
      if (missingTokenHandledRef.current) return;

      missingTokenHandledRef.current = true;
      setStatus("error");
      toast.error("Invalid or missing verification link");
      return;
    }

    if (verifiedTokenRef.current === token) return;

    verifiedTokenRef.current = token;
    verifyMutate(token);
  }, [router.isReady, token, verifyMutate]);

  return (
    <AuthLayout>
      <div className="max-w-md mx-auto text-center">
        {/* ICON */}
        <div className="mb-6 flex justify-center">
          <div className="h-16 w-16 bg-primary/10 rounded-full flex items-center justify-center">
            {status === "loading" ? (
              <Loader2 className="animate-spin text-primary size-7" />
            ) : (
              <ShieldCheck className="text-primary size-7" />
            )}
          </div>
        </div>

        {/* 🔄 LOADING */}
        {status === "loading" && (
          <>
            <h1 className="text-4xl font-heading max-sm:text-3xl">
              Verifying your email...
            </h1>
            <p className="text-muted-foreground mt-3">
              Please wait while we verify your account
            </p>
          </>
        )}

        {/* ✅ SUCCESS */}
        {status === "success" && (
          <>
            <h1 className="text-4xl font-heading max-sm:text-3xl">
              Email verified 🎉
            </h1>
            <p className="text-muted-foreground mt-3 mb-6">
              Your account is now active
            </p>

            <Button
              className="w-full"
              onClick={() => router.push("/organisations")}
            >
              Go to dashboard
              <ArrowRight className="size-4" />
            </Button>
          </>
        )}

        {/* ❌ ERROR */}
        {status === "error" && (
          <>
            <h1 className="text-4xl font-heading max-sm:text-3xl">
              Verification failed
            </h1>

            <p className="text-muted-foreground mt-3 mb-6">
              The link may be expired or invalid
            </p>

            {/* 🔥 RESEND BUTTON */}
            {email && (
              <Button
                variant="outline"
                className="w-full mb-3"
                isLoading={isResending}
                onClick={() => resendMutate({ email })}
              >
                <RefreshCcw className="size-4" />
                Resend verification link
              </Button>
            )}

            {/* BACK */}
            <Button
              variant="ghost"
              className="w-full"
              onClick={() => router.push("/auth/signup")}
            >
              Back to signup
            </Button>
          </>
        )}
      </div>
    </AuthLayout>
  );
}
