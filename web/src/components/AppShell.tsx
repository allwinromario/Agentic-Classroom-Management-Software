import Link from "next/link";

const nav = [
  { href: "/", label: "Home" },
  { href: "/attendance", label: "Attendance" },
  { href: "/assistant", label: "AI assistant" },
  { href: "/student/2024001", label: "Student demo" },
  { href: "/recommendations", label: "Recommendations" },
] as const;

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <header className="border-b border-zinc-200 bg-white/80 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/80">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <Link href="/" className="text-sm font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            SCMS
          </Link>
          <nav className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
            {nav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="text-zinc-600 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>
      <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-4 py-8">{children}</div>
    </>
  );
}
