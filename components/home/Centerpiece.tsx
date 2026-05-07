"use client";

import { motion } from "framer-motion";

export default function Centerpiece() {
  return (
    <div className="relative flex items-center justify-center w-full h-full">
      {/* Dynamic Glow Background - Scales with nucleus size */}
      <div className="absolute inset-0 bg-accent/20 blur-[min(10vw,80px)] rounded-full animate-pulse" />
      
      {/* High-Fidelity Frosted Glass Nucleus - Fills parent responsive container */}
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="relative z-10 w-full h-full rounded-full flex items-center justify-center overflow-hidden
          bg-white/20 dark:bg-black/40 backdrop-blur-[clamp(10px,2vw,40px)] border border-white/40 dark:border-white/10 
          shadow-[0_25px_60px_rgba(0,0,0,0.1)] dark:shadow-[0_25px_60px_rgba(0,0,0,0.6)]"
      >
        {/* Internal Dynamic Glare */}
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
          className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent pointer-events-none" 
        />

        {/* Nucleus Content - Fluid Typography */}
        <div className="relative z-20 flex flex-col items-center w-full text-center px-4">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center gap-1 w-full"
          >
            <span className="text-[clamp(6px,1.2vw,10px)] font-black uppercase tracking-[0.6em] text-accent/60 mb-1">
              Core
            </span>
            <h1 className="text-[clamp(1.5rem,5.5vw,3.5rem)] font-black tracking-tighter text-foreground dark:text-white leading-none drop-shadow-2xl">
              Toolsy
            </h1>
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: "40%" }}
              transition={{ delay: 0.6, duration: 1 }}
              className="h-[min(4px,0.5vw)] bg-gradient-to-r from-blue-500 via-red-500 to-purple-500 mt-[2%] rounded-full shadow-[0_0_20px_var(--accent)]" 
            />
          </motion.div>
        </div>

        {/* Ambient Particles - Scaled positions */}
        <div className="absolute inset-0 overflow-hidden opacity-30 pointer-events-none">
          {[...Array(6)].map((_, i) => (
            <motion.div
              key={i}
              animate={{
                y: ["-10%", "110%"],
                opacity: [0, 1, 0],
              }}
              transition={{
                duration: 5 + i,
                repeat: Infinity,
                delay: i * 2,
              }}
              className="absolute w-[2%] aspect-square bg-white rounded-full"
              style={{ left: `${i * 20}%`, top: "-10%" }}
            />
          ))}
        </div>
      </motion.div>
    </div>
  );
}
