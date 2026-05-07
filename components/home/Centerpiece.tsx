"use client";

import { motion } from "framer-motion";
import Link from "next/link";

export default function Centerpiece() {
  return (
    <Link href="/tools" className="group/core">
      <div className="relative flex items-center justify-center w-full h-full cursor-pointer">
        {/* Dynamic Glow Background - Stronger contrast in light mode */}
        <div className="absolute inset-0 bg-accent/20 blur-[min(10vw,80px)] rounded-full animate-pulse group-hover/core:bg-accent/40 transition-colors duration-500" />
        
        {/* High-Fidelity Frosted Glass Nucleus */}
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          whileHover={{ scale: 1.02 }}
          className="relative z-10 w-full h-full rounded-full flex items-center justify-center overflow-hidden
            bg-white/40 dark:bg-black/60 backdrop-blur-[clamp(10px,2vw,40px)] border border-slate-200 dark:border-white/10 
            shadow-[0_25px_60px_rgba(0,0,0,0.08)] dark:shadow-[0_25px_60px_rgba(0,0,0,0.6)]
            group-hover/core:border-accent/40 dark:group-hover/core:border-white/20 transition-all duration-500"
        >
          {/* Internal Dynamic Glare - Subtle in light mode, strong in dark */}
          <motion.div 
            animate={{
              x: ["-20%", "20%", "-20%"],
              y: ["-20%", "20%", "-20%"],
            }}
            transition={{
              duration: 15,
              repeat: Infinity,
              ease: "linear",
            }}
            className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent pointer-events-none opacity-40 group-hover/core:opacity-100 transition-opacity" 
          />

          {/* Nucleus Content */}
          <div className="relative z-20 flex flex-col items-center w-full text-center px-4">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col items-center gap-1 w-full"
            >
              <span className="text-[clamp(6px,1.2vw,10px)] font-black uppercase tracking-[0.8em] text-accent group-hover/core:text-accent transition-colors">
                Enter
              </span>
              <h1 className="text-[clamp(1.5rem,5.5vw,3.8rem)] font-black tracking-tighter text-slate-950 dark:text-white leading-none drop-shadow-sm group-hover/core:scale-[1.01] transition-transform">
                Toolsy
              </h1>
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: "50%" }}
                transition={{ delay: 0.6, duration: 1 }}
                className="h-[min(5px,0.6vw)] bg-gradient-to-r from-blue-500 via-red-500 to-purple-500 mt-[4%] rounded-full shadow-[0_0_20px_var(--accent)]" 
              />
            </motion.div>
          </div>

          {/* Ambient Particles */}
          <div className="absolute inset-0 overflow-hidden opacity-20 dark:opacity-30 pointer-events-none group-hover/core:opacity-50 transition-opacity">
            {[...Array(8)].map((_, i) => (
              <motion.div
                key={i}
                animate={{
                  y: ["-10%", "110%"],
                  opacity: [0, 1, 0],
                }}
                transition={{
                  duration: 4 + i,
                  repeat: Infinity,
                  delay: i * 1.5,
                }}
                className="absolute w-[2%] aspect-square bg-slate-400 dark:bg-white rounded-full"
                style={{ left: `${i * 12.5}%`, top: "-10%" }}
              />
            ))}
          </div>
        </motion.div>
      </div>
    </Link>
  );
}
