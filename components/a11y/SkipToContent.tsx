export default function SkipToContent({ href = "#main-content" }: { href?: string }) {
  return (
    <a
      href={href}
      className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:px-5 focus:py-2.5 focus:rounded-xl focus:bg-background focus:text-primary focus:border focus:border-accent/40 focus:text-[11px] focus:font-black focus:uppercase focus:tracking-widest focus:outline-none focus:shadow-lg"
    >
      Skip to content
    </a>
  );
}
