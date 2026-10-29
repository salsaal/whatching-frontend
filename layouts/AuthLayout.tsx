import Image from "next/image";
import React, { useEffect, useState } from "react";

import { enter } from "@/components/auth/AuthUI";
import assets from "@/json/assets";
import { cn } from "@/lib/utils";

interface AuthLayoutProps {
  children: React.ReactNode;
  /** Bump to shake the card once (e.g. after a failed submit). */
  shakeKey?: number;
}

// One centred card on a quiet animated backdrop, shared by every auth page.
export default function AuthLayout({
  children,
  shakeKey = 0
}: AuthLayoutProps) {
  const [isShaking, setIsShaking] = useState(false);
  useEffect(() => {
    if (shakeKey > 0) setIsShaking(true);
  }, [shakeKey]);

  const logoMotion = enter(0);
  const cardMotion = enter(0.08);
  const footMotion = enter(0.5);

  return (
    <div className="auth-scope relative grid min-h-dvh grid-cols-[minmax(0,1fr)] place-items-center overflow-hidden bg-background px-4 py-6 text-foreground">
      <div aria-hidden className="auth-halo" />

      <main className="relative z-10 w-full max-w-[400px]">
        <div
          className={cn(
            "mb-[26px] flex items-center justify-center gap-[10px]",
            logoMotion.className
          )}
          style={logoMotion.style}
        >
          <Image
            src={assets.whatchingMark}
            alt=""
            width={34}
            height={34}
            priority
            className="auth-bob h-[34px] w-auto"
          />
          <span className="font-heading text-[22px] font-bold text-foreground">
            Whatching
          </span>
        </div>

        <div className={cardMotion.className} style={cardMotion.style}>
          <section
            className={cn(
              "auth-card border border-border bg-card",
              isShaking && "auth-shake"
            )}
            onAnimationEnd={(event) => {
              // Child animations bubble up here too; only our shake counts.
              if (event.target === event.currentTarget) setIsShaking(false);
            }}
          >
            {children}
          </section>
        </div>

        <p
          className={cn(
            "mt-5 text-center text-[12.5px] text-muted-foreground",
            footMotion.className
          )}
          style={footMotion.style}
        >
          Official WhatsApp Business API
        </p>
      </main>
    </div>
  );
}
