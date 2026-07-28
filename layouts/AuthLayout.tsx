import assets from "@/json/assets";
import { ArrowUpRight, Check, MessageCircleMore } from "lucide-react";
import Image from "next/image";
import React from "react";

interface AuthLayoutProps {
  children: React.ReactNode;
}

export default function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <div className="grid min-h-dvh grid-cols-1 bg-white lg:h-dvh lg:grid-cols-2 lg:overflow-hidden">
      <div className="relative hidden h-dvh overflow-hidden bg-[#063d32] lg:block">
        <div className="auth-gradient-field absolute inset-0" />
        <div className="auth-grid-field absolute inset-0 opacity-35" />
        <div className="auth-flow-line absolute -left-24 top-[18%] h-44 w-[125%] rotate-[-7deg] border-y border-white/10 bg-white/[0.025]" />
        <div className="auth-flow-line auth-flow-line-delayed absolute -left-20 top-[58%] h-32 w-[125%] rotate-[9deg] border-y border-emerald-200/10 bg-black/[0.035]" />
        <div className="relative z-10 flex h-full flex-col px-14 py-12 text-white xl:px-20 xl:py-16">
          <div className="flex items-center justify-between">
            <Image
              src={assets.whatchingLogo}
              alt="Whatching"
              width={178}
              height={44}
              priority
              className="h-auto w-36 brightness-0 invert"
            />
            <span className="inline-flex items-center gap-2 text-xs font-medium text-emerald-50/75">
              <span className="size-2 rounded-full bg-emerald-300" />
              Customer operations
            </span>
          </div>

          <div className="my-auto max-w-2xl">
            <p className="mb-6 flex items-center gap-2 text-sm font-medium text-emerald-200">
              <MessageCircleMore className="size-4" />
              One workspace for every conversation
            </p>
            <h1 className="font-heading text-5xl font-semibold leading-[1.08] tracking-normal xl:text-6xl">
              Turn customer messages into clear, timely action.
            </h1>
            <p className="mt-7 max-w-xl text-lg leading-8 text-emerald-50/72">
              Coordinate WhatsApp and Instagram, automate routine replies, and
              hand conversations to your team with context intact.
            </p>
            <div className="mt-10 grid max-w-xl gap-4 sm:grid-cols-2">
              {[
                "Build and publish message flows",
                "Keep agents and automation aligned",
                "Send targeted broadcasts",
                "Track every customer handoff"
              ].map((item) => (
                <div
                  key={item}
                  className="flex items-center gap-3 border-t border-white/15 pt-3 text-sm text-emerald-50/90"
                >
                  <Check className="size-4 shrink-0 text-emerald-300" />
                  {item}
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between border-t border-white/15 pt-5 text-xs text-emerald-50/65">
            <span>Inbox · Flows · Broadcasts · Analytics</span>
            <ArrowUpRight className="size-4" />
          </div>
        </div>
      </div>

      <div className="min-h-dvh border-l border-slate-100 bg-[#fdfefd] lg:h-dvh lg:overflow-y-auto">
        <div className="mx-auto flex min-h-full w-full max-w-xl flex-col px-6 py-8 sm:px-10 lg:px-14 xl:px-16">
          <Image
            src={assets.whatchingLogo}
            alt="Whatching"
            width={168}
            height={35}
            priority
            className="h-auto w-40 object-contain"
          />
          <div className="flex flex-1 items-center">
            <div className="w-full max-w-md">{children}</div>
          </div>
          <p className="mt-9 text-center text-[11px] text-slate-400">
            Secure access to your Whatching workspace
          </p>
        </div>
      </div>
    </div>
  );
}
