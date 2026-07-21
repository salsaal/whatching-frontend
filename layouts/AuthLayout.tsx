import assets from "@/json/assets";
import Image from "next/image";
import React from "react";

interface AuthLayoutProps {
  children: React.ReactNode;
}

export default function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <div className="grid min-h-dvh grid-cols-1 bg-white lg:h-dvh lg:grid-cols-[minmax(0,1.18fr)_minmax(440px,0.82fr)] lg:overflow-hidden">
      <div className="relative hidden h-dvh overflow-hidden bg-[#02372e] lg:block">
        <Image
          src={assets.authLayoutImage}
          alt="Whatching conversation automation"
          fill
          priority
          sizes="58vw"
          className="object-cover object-center"
        />
        <div className="pointer-events-none absolute inset-y-0 right-0 w-24 bg-gradient-to-r from-transparent to-black/10" />
      </div>

      <div className="min-h-dvh border-l border-slate-100 bg-[#fdfefd] lg:h-dvh lg:overflow-y-auto">
        <div className="mx-auto flex min-h-full w-full max-w-xl flex-col justify-center px-6 py-10 sm:px-10 lg:px-14 xl:px-16">
          <Image
            src={assets.logo}
            alt="Whatching"
            width={168}
            height={35}
            priority
            className="mb-10 h-auto w-40 object-contain"
          />
          <div className="w-full max-w-md">{children}</div>
          <p className="mt-9 text-center text-[11px] text-slate-400">
            Secure access to your Whatching workspace
          </p>
        </div>
      </div>
    </div>
  );
}
