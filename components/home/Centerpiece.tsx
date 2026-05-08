"use client";

import { motion } from "framer-motion";
import Link from "next/link";

export default function Centerpiece() {
  return (
    <Link href="/tools" className="group/core">
      <div className="relative flex items-center justify-center w-full h-full cursor-pointer select-none">

        {/* ═══════════════════════════════════════════════════ */}
        {/* ATMOSPHERIC DEPTH LAYERS */}
        {/* ═══════════════════════════════════════════════════ */}

        {/* Deep ambient pulse */}
        <motion.div
          initial={{ scale: 1, opacity: 0.12 }}
          animate={{
            scale: [1, 1.08, 1],
            opacity: [0.12, 0.22, 0.12],
          }}
          transition={{
            duration: 5,
            repeat: Infinity,
            ease: "easeInOut",
          }}
          className="absolute inset-[-15%] rounded-full bg-accent/20 blur-[min(10vw,80px)] pointer-events-none"
        />

        {/* Secondary atmospheric ring */}
        <motion.div
          initial={{ scale: 1.02, opacity: 0.08 }}
          animate={{
            scale: [1.02, 1, 1.02],
            opacity: [0.08, 0.14, 0.08],
          }}
          transition={{
            duration: 7,
            repeat: Infinity,
            ease: "easeInOut",
          }}
          className="absolute inset-[-25%] rounded-full border border-accent/8 pointer-events-none"
        />

        {/* ═══════════════════════════════════════════════════ */}
        {/* CORE SPHERE — premium glass shell */}
        {/* ═══════════════════════════════════════════════════ */}
        <motion.div
          initial={{ scale: 0.85, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          whileHover={{ scale: 1.04 }}
          transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
          className="relative z-10 w-full h-full rounded-full flex items-center justify-center overflow-hidden
            bg-gradient-to-br from-white/90 via-white/70 to-white/40
            dark:from-white/12 dark:via-white/6 dark:to-transparent
            backdrop-blur-[clamp(16px,3vw,40px)]
            border border-white/30 dark:border-white/15
            shadow-[0_0_0_1px_rgba(255,255,255,0.1),0_40px_100px_rgba(0,0,0,0.15),inset_0_1px_0_rgba(255,255,255,0.4)]
            dark:shadow-[0_0_0_1px_rgba(255,255,255,0.05),0_40px_100px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.1)]
            group-hover/core:border-accent/25 dark:group-hover/core:border-accent/20
            transition-all duration-700"
        >

          {/* ═══════════════════════════════════════════════════ */}
          {/* LIVING CYBERNETIC CORE — premium layered orbital system */}
          {/* ═══════════════════════════════════════════════════ */}

          {/* Layer 0: Ambient depth — slow breathing */}
          <motion.div
            initial={{ scale: 1, opacity: 0.5 }}
            animate={{
              scale: [1, 1.08, 1],
              opacity: [0.5, 0.8, 0.5],
            }}
            transition={{
              duration: 6,
              repeat: Infinity,
              ease: "easeInOut",
            }}
            className="absolute inset-[-30%] rounded-full bg-accent/5 dark:bg-accent/10 pointer-events-none"
          />

          {/* Layer 1: Deep digital mesh — slow CW rotation */}
          <motion.div
            initial={{ rotate: 0 }}
            animate={{ rotate: 360 }}
            transition={{ duration: 80, repeat: Infinity, ease: "linear" }}
            className="absolute inset-[-100%] opacity-[0.04] dark:opacity-[0.1] pointer-events-none"
            style={{
              backgroundImage: `
                radial-gradient(circle at center, var(--accent) 1px, transparent 1px),
                radial-gradient(circle at 30% 30%, var(--accent) 0.5px, transparent 0.5px)
              `,
              backgroundSize: '32px 32px, 16px 16px',
            }}
          />

          {/* Layer 2: Rotating hex pattern — CCW */}
          <motion.div
            initial={{ rotate: 0 }}
            animate={{ rotate: -360 }}
            transition={{ duration: 120, repeat: Infinity, ease: "linear" }}
            className="absolute inset-[-150%] opacity-[0.025] dark:opacity-[0.06] pointer-events-none"
            style={{
              backgroundImage: `
                repeating-linear-gradient(
                  60deg,
                  transparent 0,
                  transparent 20px,
                  var(--accent) 20px,
                  var(--accent) 20.5px
                ),
                repeating-linear-gradient(
                  -60deg,
                  transparent 0,
                  transparent 20px,
                  var(--accent) 20px,
                  var(--accent) 20.5px
                )
              `,
            }}
          />

          {/* Layer 3: Orbital rings — elliptical motion */}
          <motion.div
            initial={{ rotate: 0 }}
            animate={{ rotate: 360 }}
            transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
            className="absolute inset-[18%] rounded-full border border-accent/20 dark:border-accent/35 pointer-events-none"
          />
          <motion.div
            initial={{ rotate: 0 }}
            animate={{ rotate: -360 }}
            transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
            className="absolute inset-[12%] rounded-full border border-accent/12 dark:border-accent/20 pointer-events-none"
            style={{ borderStyle: 'dashed', strokeDasharray: '6 10' }}
          />
          <motion.div
            initial={{ rotateX: 0, rotateZ: 0 }}
            animate={{ rotateX: 360, rotateZ: 360 }}
            transition={{ duration: 45, repeat: Infinity, ease: "linear" }}
            className="absolute inset-[8%] rounded-full border border-accent/8 dark:border-accent/15 pointer-events-none"
            style={{ borderStyle: 'dotted', strokeDasharray: '2 6' }}
          />

          {/* Layer 4: Pulsing energy core */}
          <motion.div
            initial={{ opacity: 0.35, scale: 0.7, rotate: 0 }}
            animate={{
              opacity: [0.35, 0.65, 0.35],
              scale: [0.7, 1.05, 0.7],
              rotate: [0, 180, 360],
            }}
            transition={{
              duration: 4,
              repeat: Infinity,
              ease: "easeInOut",
            }}
            className="absolute inset-[28%] rounded-full pointer-events-none"
            style={{
              background: `radial-gradient(circle, rgba(var(--accent-rgb),0.5) 0%, rgba(var(--accent-rgb),0.15) 40%, transparent 70%)`,
              filter: 'blur(12px)',
              transformOrigin: 'center',
            }}
          />

          {/* Layer 5: Inner grid glow */}
          <motion.div
            initial={{ opacity: 0.1, scale: 0.98 }}
            animate={{
              opacity: [0.1, 0.2, 0.1],
              scale: [0.98, 1.02, 0.98],
            }}
            transition={{
              duration: 3,
              repeat: Infinity,
              ease: "easeInOut",
            }}
            className="absolute inset-[30%] pointer-events-none"
            style={{
              backgroundImage: `radial-gradient(circle at center, var(--accent) 0.5px, transparent 0.5px)`,
              backgroundSize: '10px 10px',
              opacity: 0.3,
            }}
          />

          {/* ═══════════════════════════════════════════════════ */}
          {/* GLASS REFLECTION & LIGHT */}
          {/* ═══════════════════════════════════════════════════ */}

          {/* Primary specular highlight */}
          <div
            className="absolute inset-0 rounded-full pointer-events-none"
            style={{
              background: 'radial-gradient(ellipse 60% 40% at 35% 25%, rgba(255,255,255,0.6) 0%, transparent 60%)',
            }}
          />

          {/* Secondary subtle rim light */}
          <div
            className="absolute inset-0 rounded-full pointer-events-none"
            style={{
              background: 'radial-gradient(ellipse 30% 20% at 70% 75%, rgba(255,255,255,0.15) 0%, transparent 50%)',
            }}
          />

          {/* Bottom ambient bounce */}
          <div
            className="absolute inset-0 rounded-full pointer-events-none"
            style={{
              background: 'radial-gradient(ellipse 80% 30% at 50% 90%, rgba(var(--accent-rgb),0.08) 0%, transparent 60%)',
            }}
          />

          {/* ═══════════════════════════════════════════════════ */}
          {/* NUCLEUS CONTENT */}
          {/* ═══════════════════════════════════════════════════ */}
          <div className="relative z-20 flex w-full flex-col items-center px-[8%] text-center">

            {/* Status indicator */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.8 }}
              className="flex items-center gap-2 mb-2"
            >
              <motion.span
                animate={{ opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="w-1.5 h-1.5 rounded-full bg-accent"
                style={{
                  boxShadow: '0 0 8px var(--accent-glow), 0 0 16px var(--accent-glow)',
                }}
              />
              <span className="text-[clamp(6px,0.7vw,9px)] font-black uppercase tracking-[0.7em] text-accent/80">
                Core Active
              </span>
            </motion.div>

            {/* Main brand */}
            <motion.h1
              initial={{ opacity: 0, y: 12, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              whileHover={{ scale: 1.03 }}
              transition={{ delay: 0.2, duration: 1, ease: [0.16, 1, 0.3, 1] }}
              className="text-[clamp(1.6rem,4.5vw,3rem)] font-black leading-none tracking-[-0.04em]
                text-slate-950 dark:text-white
                drop-shadow-[0_2px_8px_rgba(0,0,0,0.15)]
                dark:drop-shadow-[0_0_20px_rgba(var(--accent-rgb),0.3)]
                group-hover/core:drop-shadow-[0_4px_16px_rgba(0,0,0,0.2)]
                dark:group-hover/core:drop-shadow-[0_0_30px_rgba(var(--accent-rgb),0.4)]
                transition-all duration-500"
            >
              Toolsy
            </motion.h1>

            {/* Divider line */}
            <motion.div
              initial={{ scaleX: 0, opacity: 0 }}
              animate={{ scaleX: 1, opacity: 1 }}
              transition={{ delay: 0.5, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
              className="mt-4 flex w-full items-center justify-center gap-2"
            >
              <div className="h-px flex-1 bg-gradient-to-r from-transparent via-accent/40 to-transparent" />
              <motion.div
                initial={{ rotate: 0 }}
                animate={{ rotate: [0, 180, 360] }}
                transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
                className="w-1.5 h-1.5 rounded-full bg-accent/50"
                style={{ boxShadow: '0 0 6px var(--accent-glow)' }}
              />
              <div className="h-px flex-1 bg-gradient-to-r from-transparent via-accent/40 to-transparent" />
            </motion.div>

            {/* CTA text */}
            <motion.p
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7 }}
              className="mt-3 text-[clamp(6px,0.65vw,8px)] font-bold uppercase tracking-[0.5em]
                text-slate-600/70 dark:text-white/50
                group-hover/core:text-accent/70 dark:group-hover/core:text-accent/60
                transition-colors duration-500"
            >
              Enter Portal
            </motion.p>
          </div>

          {/* ═══════════════════════════════════════════════════ */}
          {/* INTERACTION RIPPLE */}
          {/* ═══════════════════════════════════════════════════ */}
          <motion.div
            className="absolute inset-0 rounded-full pointer-events-none"
            whileHover={{
              boxShadow: 'inset 0 0 60px rgba(var(--accent-rgb),0.08)',
            }}
            transition={{ duration: 0.6 }}
          />
        </motion.div>

        {/* ═══════════════════════════════════════════════════ */}
        {/* OUTER ORBITAL RING — subtle structure */}
        {/* ═══════════════════════════════════════════════════ */}
        <motion.div
          initial={{ rotate: 0 }}
          animate={{ rotate: 360 }}
          transition={{ duration: 60, repeat: Infinity, ease: "linear" }}
          className="absolute inset-[-8%] rounded-full border border-accent/5 dark:border-white/5 pointer-events-none"
          style={{ borderStyle: 'dashed', strokeDasharray: '3 15' }}
        />
        <motion.div
          initial={{ rotate: 0 }}
          animate={{ rotate: -360 }}
          transition={{ duration: 90, repeat: Infinity, ease: "linear" }}
          className="absolute inset-[-12%] rounded-full border border-accent/3 dark:border-white/3 pointer-events-none"
          style={{ borderStyle: 'dotted' }}
        />

        {/* Corner accents */}
        {[
          { top: "8%", left: "8%", rotate: "0deg" },
          { top: "8%", right: "8%", rotate: "90deg" },
          { bottom: "8%", right: "8%", rotate: "180deg" },
          { bottom: "8%", left: "8%", rotate: "270deg" },
        ].map((style, i) => (
          <motion.div
            key={i}
            className="absolute w-3 h-3 pointer-events-none"
            style={style as React.CSSProperties}
            initial={{ opacity: 0.2 }}
            animate={{ opacity: [0.2, 0.5, 0.2] }}
            transition={{
              duration: 3 + i * 0.5,
              repeat: Infinity,
              ease: "easeInOut",
              delay: i * 0.3,
            }}
          >
            <svg viewBox="0 0 12 12" fill="none" className="w-full h-full">
              <path
                d="M1 6 L1 1 L6 1"
                stroke="currentColor"
                strokeWidth="1"
                className="text-accent/40 dark:text-white/30"
              />
            </svg>
          </motion.div>
        ))}
      </div>
    </Link>
  );
}
