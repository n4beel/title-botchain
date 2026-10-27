"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import ConnectButton from "@/components/ui/ConnectButton";
import NetworkBadge from "@/components/botchain/NetworkBadge";
import { footerLinks } from "@/lib/botchain/chain";
import BuiltOnBotChain from "@/components/botchain/BuiltOnBotChain";
import { app } from "@/lib/app-config";

export type NavItem = { href: string; label: string };

const DEFAULT_NAV: NavItem[] = [
  { href: "/", label: "Docket Book" },
  { href: "/register", label: "Register Item" },
  { href: "/verify", label: "Verify Serial" },
];

interface PageShellProps {
  children: React.ReactNode;
  nav?: NavItem[];
}

export default function PageShell({ children, nav = DEFAULT_NAV }: PageShellProps) {
  const pathname = usePathname();
  const links = footerLinks();

  return (
    <div
      className="flex flex-col overflow-x-hidden min-h-[100dvh]"
      style={{ background: "var(--bg-base)", color: "var(--text-primary)" }}
    >
      {/* Notarial Header */}
      <header
        className="sticky top-0 z-30 flex-shrink-0"
        style={{
          borderBottom: "1px solid var(--border-default)",
          background: "var(--bg-surface)",
          boxShadow: "0 1px 3px rgba(38, 35, 27, 0.05)",
        }}
      >
        <div className="mx-auto w-full max-w-[1040px] px-4 md:px-8">
          <div className="flex items-center justify-between gap-4 py-3">
            <div className="flex items-center gap-3">
              <Link href="/" className="flex items-center gap-2.5 no-underline">
                <span
                  className="w-6 h-6 flex items-center justify-center text-xs font-serif font-bold text-white shadow-xs rounded-[2px]"
                  style={{ background: "var(--accent)" }}
                  aria-hidden="true"
                >
                  §
                </span>
                <span className="flex flex-col">
                  <span
                    className="text-[16px] font-serif font-bold tracking-tight"
                    style={{ color: "var(--text-primary)" }}
                  >
                    {app.name}
                  </span>
                  <span
                    className="text-[11px] font-mono leading-none tracking-normal hidden sm:inline"
                    style={{ color: "var(--text-muted)" }}
                  >
                    {app.tagline}
                  </span>
                </span>
              </Link>
            </div>

            {/* Navigation links */}
            <nav className="flex items-center gap-1 md:gap-2">
              {nav.map((item) => {
                const active = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="px-2.5 py-1 text-[13px] font-medium transition-colors rounded-[2px] no-underline"
                    style={{
                      color: active ? "var(--accent)" : "var(--text-secondary)",
                      background: active ? "var(--bg-elevated)" : "transparent",
                      border: active ? "1px solid var(--border-default)" : "1px solid transparent",
                    }}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>

            {/* Wallet actions */}
            <div className="flex items-center gap-2">
              <NetworkBadge />
              <ConnectButton />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 w-full max-w-[1040px] mx-auto px-4 md:px-8 py-8 md:py-10">
        {children}
      </main>

      {/* Notarial Footer */}
      <footer
        className="mt-auto border-t py-8 px-4 md:px-8"
        style={{
          borderTopColor: "var(--border-default)",
          background: "var(--bg-surface)",
        }}
      >
        <div className="max-w-[1040px] mx-auto flex flex-col gap-6">
          {/* Statutory Limits & Disclaimers */}
          <div
            className="p-4 rounded-[2px] text-[12px] leading-relaxed border"
            style={{
              background: "var(--bg-elevated)",
              borderColor: "var(--border-subtle)",
              color: "var(--text-muted)",
            }}
          >
            <div className="font-serif font-semibold text-[13px] mb-1.5" style={{ color: "var(--text-primary)" }}>
              A record, not a deed
            </div>
            <ul className="list-disc pl-4 space-y-1">
              <li>First to register a hash holds it. The chain can&apos;t know the item is real.</li>
              <li>Flags are the owner&apos;s word. A new owner starts clean.</li>
              <li>Nothing here is legal title.</li>
            </ul>
          </div>

          {/* Three Mandatory Links & Explorer */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-[12px]" style={{ color: "var(--text-muted)" }}>
            <div className="flex items-center gap-2">
              <BuiltOnBotChain />
            </div>

            <div className="flex items-center gap-6">
              <a
                href="https://botchain.ai"
                target="_blank"
                rel="noreferrer"
                className="hover:underline"
                style={{ color: "var(--text-secondary)" }}
              >
                botchain.ai
              </a>
              <a
                href={links.explorer}
                target="_blank"
                rel="noreferrer"
                className="hover:underline"
                style={{ color: "var(--text-secondary)" }}
              >
                scan.botchain.ai
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
