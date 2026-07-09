"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import NotificationBell from "@/components/NotificationBell";
import PwaRegister from "@/components/PwaRegister";

interface NavItem {
  href: string;
  label: string;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    label: "Appuntamenti",
    items: [
      { href: "/admin", label: "Prenotazioni" },
      { href: "/admin/calendar", label: "Calendario" },
      { href: "/admin/reschedule", label: "Spostamenti" },
      { href: "/admin/schedule", label: "Orario settimanale" },
      { href: "/admin/appointment-types", label: "Calendari/servizi" },
      { href: "/admin/bookings/new", label: "Nuovo appuntamento" },
    ],
  },
  {
    label: "Anagrafica & Fatturazione",
    items: [
      { href: "/admin/clients", label: "Clienti" },
      { href: "/admin/price-list", label: "Listino" },
      { href: "/admin/invoices", label: "Fatture" },
    ],
  },
  {
    label: "Impostazioni",
    items: [
      { href: "/admin/stats", label: "Statistiche" },
      { href: "/admin/settings", label: "Impostazioni" },
    ],
  },
];

function NavContent({
  pathname,
  onNavigate,
  onLogout,
}: {
  pathname: string;
  onNavigate?: () => void;
  onLogout: () => void;
}) {
  return (
    <>
      {NAV_GROUPS.map((group) => (
        <div key={group.label} className="mb-5">
          <div className="mb-1 px-2 text-xs font-semibold uppercase tracking-wide text-neutral-400 dark:text-neutral-500">
            {group.label}
          </div>
          <nav className="space-y-0.5">
            {group.items.map((item) => {
              const isActive = item.href === "/admin" ? pathname === "/admin" : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onNavigate}
                  className={`block rounded-md px-2 py-2 text-sm transition-colors sm:py-1.5 ${
                    isActive
                      ? "bg-yellow-400 font-medium text-neutral-900"
                      : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-300 dark:hover:bg-neutral-800 dark:hover:text-white"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
      ))}

      <div className="mt-2 border-t border-neutral-200 pt-2 dark:border-neutral-800">
        <button
          onClick={() => {
            onNavigate?.();
            onLogout();
          }}
          className="block w-full rounded-md px-2 py-2 text-left text-sm text-red-500 transition-colors hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/30 sm:py-1.5"
        >
          Esci
        </button>
      </div>
    </>
  );
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const isLogin = pathname === "/admin/login";
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    setMobileNavOpen(false);
  }, [pathname]);

  async function handleLogout() {
    if (!window.confirm("Confermi di voler uscire?")) return;
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/admin/login");
    router.refresh();
  }

  if (isLogin) {
    return <div className="min-h-screen bg-neutral-50 text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100">{children}</div>;
  }

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100">
      <PwaRegister />
      <header className="sticky top-0 z-30 border-b border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
        <div className="flex items-center justify-between px-3 py-3 sm:px-4">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setMobileNavOpen(true)}
              aria-label="Apri menu"
              className="-ml-1 flex h-9 w-9 items-center justify-center rounded-md text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800 sm:hidden"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <Link href="/admin" className="font-semibold text-neutral-900 dark:text-white">
              Palestra <span className="text-yellow-500 dark:text-yellow-400">Admin</span>
            </Link>
          </div>
          <div className="flex items-center gap-1 sm:gap-2">
            <NotificationBell />
          </div>
        </div>
      </header>

      {mobileNavOpen && (
        <div className="fixed inset-0 z-40 sm:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileNavOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-72 max-w-[85vw] overflow-y-auto bg-white px-3 py-4 shadow-xl dark:bg-neutral-900">
            <div className="mb-3 flex items-center justify-between px-2">
              <span className="font-semibold text-neutral-900 dark:text-white">Menu</span>
              <button
                onClick={() => setMobileNavOpen(false)}
                aria-label="Chiudi menu"
                className="flex h-8 w-8 items-center justify-center rounded-md text-neutral-500 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 6l12 12M18 6l-12 12" />
                </svg>
              </button>
            </div>
            <NavContent pathname={pathname} onNavigate={() => setMobileNavOpen(false)} onLogout={handleLogout} />
          </div>
        </div>
      )}

      <div className="flex">
        <aside className="hidden w-56 shrink-0 border-r border-neutral-200 bg-white px-3 py-4 dark:border-neutral-800 dark:bg-neutral-900 sm:block">
          <NavContent pathname={pathname} onLogout={handleLogout} />
        </aside>

        <main className="min-w-0 flex-1 px-3 py-4 sm:px-6 sm:py-6">
          <div className="mx-auto max-w-5xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
