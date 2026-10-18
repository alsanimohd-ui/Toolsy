export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <div className="relative min-h-[100dvh] overflow-x-hidden">{children}</div>;
}
