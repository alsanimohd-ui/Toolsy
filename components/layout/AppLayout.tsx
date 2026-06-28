"use client";


import { usePathname } from "next/navigation";
import ThemeToggle from "@/components/home/ThemeToggle";
import BackgroundLayer from "@/components/layout/BackgroundLayer";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isHome = pathname === "/";

  return (
    <div className="relative min-h-[100dvh] transition-colors duration-500 overflow-x-hidden">
      {/* Persistent Global Theme Toggle - Rendered only on Home portal, inside workspace it resides in the sidebar */}
      {isHome && <ThemeToggle />}

      {/* Global Cinematic Background */}
      <BackgroundLayer />

      {/* Page Content */}
      <div className="relative z-10">
        {children}
      </div>
    </div>
  );
}
