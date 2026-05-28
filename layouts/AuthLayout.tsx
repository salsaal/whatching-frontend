import assets from "@/json/assets";
import Image from "next/image";
import React from "react";

interface AuthLayoutProps {
  children: React.ReactNode;
}

export default function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <div className="min-h-screen grid grid-cols-1 lg:grid-cols-[1.5fr_1fr]">
      
      {/* 🔹 LEFT SIDE (IMAGE) */}
      <div className="hidden lg:block relative">
        <Image
          src={assets.authLayoutImage}
          alt="Auth layout"
          fill
          priority
          className="object-cover"
        />
      </div>
        <Image
          src={assets.logo}
          alt="Logo"
          width={120}
          height={120}
          className="mb-0 lg:hidden m-6"
        />
      {/* 🔹 RIGHT SIDE (CONTENT) */}
      <div className="flex flex-col items-center justify-center max-md:justify-start max-md:pb-20 px-4 sm:px-6 lg:px-10">
       
        <div className="w-full max-w-md">{children}</div>
      </div>
    </div>
  );
}