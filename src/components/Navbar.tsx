"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const links = [
  { href: "/", label: "Dashboard" },
  { href: "/want-list", label: "Want List" },
  { href: "/alerts", label: "Alerts" },
];

export function Navbar() {
  const pathname = usePathname();
  return (
    <header className="sticky top-0 z-50 w-full glass border-b border-black/[0.06]">
      <div className="container mx-auto px-5 max-w-6xl flex items-center h-14 gap-8">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5 shrink-0 group">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-sm group-hover:shadow-md transition-shadow">
            <span className="text-white text-sm font-bold" style={{ fontFamily: "var(--font-display)" }}>P</span>
          </div>
          <span
            className="font-semibold text-[15px] tracking-tight text-[#1d1d1f]"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Pokemon Trader
          </span>
        </Link>

        {/* Nav links */}
        <nav className="flex items-center gap-0.5">
          {links.map((l) => {
            const active = pathname === l.href;
            return (
              <Link
                key={l.href}
                href={l.href}
                className={cn(
                  "relative px-3.5 py-1.5 rounded-full text-[13px] font-medium transition-all duration-200",
                  active
                    ? "text-[#1d1d1f] bg-black/[0.07]"
                    : "text-[#6e6e73] hover:text-[#1d1d1f] hover:bg-black/[0.04]"
                )}
              >
                {l.label}
                {active && (
                  <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-amber-500" />
                )}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
