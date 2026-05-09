"use client";


import ThemeToggle from "@/components/home/ThemeToggle";
import Atmosphere from "@/components/layout/Atmosphere";
import { usePathname } from "next/navigation";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isHome = pathname === "/";

  return (
    <div className="relative min-h-[100dvh] bg-background transition-colors duration-500 mesh-gradient overflow-x-hidden">
      {/* Persistent Global Theme Toggle */}
      <ThemeToggle />

      {/* Global Cinematic Background Atmosphere */}
      {!isHome && <Atmosphere />}

      {/* Page Content */}
      <div className="relative z-10">
        {children}
      </div>
    </div>
  );
}
