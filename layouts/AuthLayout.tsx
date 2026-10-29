import assets from "@/json/assets";
import { Bot, UserRound } from "lucide-react";
import Image from "next/image";
import React from "react";

interface AuthLayoutProps {
  children: React.ReactNode;
}

// A decorative glimpse of the product: a customer question, the bot's
// answer with quick replies, and a handoff to a teammate.
function ChatPreview() {
  return (
    <div
      aria-hidden
      className="w-full max-w-sm rounded-2xl border border-white/15 bg-white/[0.07] p-4 shadow-2xl shadow-black/20 backdrop-blur-md"
    >
      <div className="flex items-center gap-3 border-b border-white/10 pb-3">
        <span className="flex size-9 items-center justify-center rounded-full bg-emerald-200/90 text-sm font-semibold text-emerald-950">
          A
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-white">Aisha Khan</p>
          <p className="flex items-center gap-1.5 text-[11px] text-emerald-100/70">
            <span className="size-1.5 rounded-full bg-emerald-300" />
            WhatsApp
          </p>
        </div>
        <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-emerald-50/80">
          2m
        </span>
      </div>

      <div className="space-y-2.5 pt-3 text-[13px] leading-5">
        <p className="mr-10 w-fit rounded-2xl rounded-tl-sm bg-white/90 px-3 py-2 text-slate-800">
          Hi! Has my order #4821 shipped yet?
        </p>
        <div className="ml-10 space-y-1.5">
          <p className="ml-auto w-fit rounded-2xl rounded-tr-sm bg-emerald-300 px-3 py-2 text-emerald-950">
            Yes, it&apos;s out for delivery today. Want live tracking?
          </p>
          <div className="flex justify-end gap-1.5">
            <span className="rounded-full border border-emerald-200/40 px-2.5 py-1 text-[11px] text-emerald-50">
              Track order
            </span>
            <span className="rounded-full border border-emerald-200/40 px-2.5 py-1 text-[11px] text-emerald-50">
              Talk to a person
            </span>
          </div>
        </div>
        <div className="flex items-center justify-center gap-2 pt-1 text-[11px] text-emerald-100/70">
          <Bot className="size-3.5" />
          <span>Handed to Priya with full context</span>
          <UserRound className="size-3.5" />
        </div>
      </div>
    </div>
  );
}

export default function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <div className="grid min-h-dvh grid-cols-1 bg-white lg:h-dvh lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:overflow-hidden">
      <div className="relative hidden h-dvh overflow-hidden bg-[#063d32] lg:block">
        <div className="auth-gradient-field absolute inset-0" />
        <div className="auth-grid-field absolute inset-0 opacity-25" />
        <div className="absolute -top-32 -right-24 size-[28rem] rounded-full bg-emerald-400/20 blur-3xl" />
        <div className="absolute -bottom-40 -left-24 size-[26rem] rounded-full bg-teal-300/10 blur-3xl" />

        <div className="relative z-10 flex h-full flex-col px-14 py-12 text-white xl:px-20 xl:py-14">
          <Image
            src={assets.whatchingLogo}
            alt="Whatching"
            width={178}
            height={44}
            priority
            className="h-auto w-36 brightness-0 invert"
          />

          <div className="my-auto space-y-10">
            <div className="max-w-lg">
              <h1 className="font-heading text-4xl leading-[1.1] font-semibold xl:text-5xl">
                Every conversation,
                <span className="block text-emerald-300">handled.</span>
              </h1>
              <p className="mt-5 text-base leading-7 text-emerald-50/70">
                WhatsApp and Instagram in one inbox, with flows and AI replies
                that hand off to your team at the right moment.
              </p>
            </div>
            <ChatPreview />
          </div>

          <p className="text-xs text-emerald-50/55">
            Inbox · Flows · Broadcasts · Analytics
          </p>
        </div>
      </div>

      <div className="min-h-dvh bg-[#fbfdfc] lg:h-dvh lg:overflow-y-auto">
        <div className="mx-auto flex min-h-full w-full max-w-md flex-col px-6 py-10 sm:px-8">
          {/* The brand panel carries the logo on desktop. */}
          <Image
            src={assets.whatchingLogo}
            alt="Whatching"
            width={168}
            height={35}
            priority
            className="h-auto w-36 object-contain lg:hidden"
          />
          <div className="flex flex-1 items-center py-10">
            <div className="w-full">{children}</div>
          </div>
          <p className="text-center text-[11px] text-slate-400">
            © {new Date().getFullYear()} Whatching
          </p>
        </div>
      </div>
    </div>
  );
}
