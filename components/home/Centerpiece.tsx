"use client";

import { motion } from "framer-motion";

export default function Centerpiece() {
  return (
    <div className="relative flex items-center justify-center w-64 h-64">
      {/* Multi-layered Color-Cycling Aura */}
      <motion.div
        animate={{
          scale: [1, 1.2, 1],
          opacity: [0.3, 0.5, 0.3],
          rotate: [0, 180, 360],
        }}
        transition={{
          duration: 12,
          repeat: Infinity,
          ease: "linear",
        }}
        className="absolute inset-0 bg-gradient-to-tr from-blue-500/20 via-red-500/20 to-purple-500/20 blur-[100px] rounded-full"
      />
      
      {/* High-Fidelity Frosted Glass Nucleus */}
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="relative z-10 w-60 h-60 rounded-full flex items-center justify-center overflow-hidden
          bg-white/20 dark:bg-black/40 backdrop-blur-[40px] border border-white/40 dark:border-white/10 
          shadow-[0_25px_60px_rgba(0,0,0,0.1)] dark:shadow-[0_25px_60px_rgba(0,0,0,0.6)]"
      >
        {/* Internal Dynamic Glare */}
        <motion.div 
          animate={{
            x: [-100, 100, -100],
            y: [-100, 100, -100],
          }}
          transition={{
            duration: 15,
            repeat: Infinity,
            ease: "linear",
          }}
          className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent pointer-events-none" 
        />

        {/* Nucleus Content */}
        <div className="relative z-20 flex flex-col items-center">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center gap-1"
          >
            <span className="text-[10px] font-black uppercase tracking-[0.8em] text-accent/60 mb-1">Core</span>
            <h1 className="text-5xl font-black tracking-tighter text-foreground dark:text-white drop-shadow-2xl">
              Toolsy
            </h1>
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: 48 }}
              transition={{ delay: 0.6, duration: 1 }}
              className="h-1 bg-gradient-to-r from-blue-500 via-red-500 to-purple-500 mt-2 rounded-full shadow-[0_0_20px_var(--accent)]" 
            />
          </motion.div>
        </div>

        {/* Ambient Particles */}
        <div className="absolute inset-0 overflow-hidden opacity-30 pointer-events-none">
          {[...Array(6)].map((_, i) => (
            <motion.div
              key={i}
              animate={{
                y: [-20, 220],
                opacity: [0, 1, 0],
              }}
              transition={{
                duration: 5 + i,
                repeat: Infinity,
                delay: i * 2,
              }}
              className="absolute w-1 h-1 bg-white rounded-full"
              style={{ left: `${i * 20}%`, top: "-10%" }}
            />
          ))}
        </div>
      </motion.div>
    </div>
  );
}
