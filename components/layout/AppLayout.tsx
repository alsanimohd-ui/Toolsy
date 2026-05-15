"use client";


import ThemeToggle from "@/components/home/ThemeToggle";
import BackgroundLayer from "@/components/layout/BackgroundLayer";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-[100dvh] transition-colors duration-500 overflow-x-hidden">
      {/* Persistent Global Theme Toggle */}
      <ThemeToggle />

      {/* Global Cinematic Background */}
      <BackgroundLayer />

      {/* Page Content */}
      <div className="relative z-10">
        {children}
      </div>
    </div>
  );
}
