'use client';

import React from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";

interface LogoProps {
    isCollapsed: boolean;
}

// Brand logo acts as "home" (conventional). About is reachable via the dedicated Info button.
const Logo = React.forwardRef<HTMLButtonElement, LogoProps>(({ isCollapsed }, ref) => {
  const router = useRouter();

  if (isCollapsed) {
    return (
      <button
        ref={ref}
        onClick={() => router.push('/')}
        title="Siplinx AI"
        aria-label="Siplinx AI"
        className="flex items-center justify-start mb-2 cursor-pointer bg-transparent border-none p-0 hover:opacity-80 transition-opacity"
      >
        <Image src="/logo-collapsed.png" alt="Siplinx AI" width={36} height={36} />
      </button>
    );
  }

  return (
    <button
      ref={ref}
      onClick={() => router.push('/')}
      title="Siplinx AI"
      aria-label="Siplinx AI"
      className="w-full text-lg text-center border rounded-full border-white font-bold text-gray-900 mb-2 block cursor-pointer hover:opacity-80 transition-opacity"
      style={{ background: "rgba(47,107,255,0.08)" }}
    >
      <span>Siplinx </span>
      <span
        style={{
          background: "linear-gradient(135deg, #2F6BFF 0%, #7A3BE0 100%)",
          WebkitBackgroundClip: "text",
          backgroundClip: "text",
          WebkitTextFillColor: "transparent",
        }}
      >
        AI
      </span>
    </button>
  );
});

Logo.displayName = "Logo";

export default Logo;
