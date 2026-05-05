export default function HomePage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6">
      {/* Background radial glow */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 overflow-hidden"
      >
        <div
          className="absolute left-1/2 top-1/3 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full"
          style={{
            background:
              "radial-gradient(circle, rgba(124,106,255,0.08) 0%, transparent 70%)",
          }}
        />
      </div>

      {/* Hero */}
      <section className="relative z-10 text-center max-w-2xl mx-auto">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-[var(--border-subtle)] bg-[var(--surface-raised)] mb-8">
          <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] animate-pulse" />
          <span className="text-xs font-medium text-[var(--muted)] tracking-wide uppercase">
            Developer Platform
          </span>
        </div>

        {/* Title */}
        <h1 className="text-7xl font-bold tracking-tight mb-4 leading-none">
          <span
            style={{
              background:
                "linear-gradient(135deg, #e8e8f0 0%, #9b8dff 50%, #7c6aff 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            Toolsy
          </span>
        </h1>

        {/* Subtitle */}
        <p className="text-lg text-[var(--muted)] leading-relaxed max-w-md mx-auto mb-10">
          A modular platform for developer tools — fast, focused, and built to
          scale.
        </p>

        {/* CTA */}
        <div className="flex items-center justify-center gap-4">
          <a
            href="/tools"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-medium text-sm
              bg-[var(--accent)] text-white
              hover:bg-[var(--accent-hover)] transition-all duration-200
              shadow-lg shadow-[var(--accent-glow)]"
          >
            Browse Tools
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 5l7 7-7 7"
              />
            </svg>
          </a>
          <a
            href="https://github.com"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-medium text-sm
              border border-[var(--border-subtle)] text-[var(--muted)]
              hover:border-[var(--accent)] hover:text-[var(--foreground)]
              transition-all duration-200 bg-[var(--surface-raised)]"
          >
            GitHub
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="w-4 h-4"
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <path d="M12 0C5.372 0 0 5.373 0 12c0 5.303 3.438 9.8 8.205 11.387.6.113.82-.258.82-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23a11.52 11.52 0 0 1 3.003-.404c1.02.005 2.047.138 3.006.404 2.29-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z" />
            </svg>
          </a>
        </div>
      </section>

      {/* Footer */}
      <footer className="absolute bottom-6 text-xs text-[var(--muted)]">
        Toolsy &mdash; Built for developers
      </footer>
    </main>
  );
}
