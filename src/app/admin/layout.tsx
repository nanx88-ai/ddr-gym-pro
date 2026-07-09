"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import NotificationBell from "@/components/NotificationBell";
import PwaRegister from "@/components/PwaRegister";
import { ToastProvider } from "@/components/Toast";

type IconKey =
  | "bookings"
  | "agenda"
  | "calendar"
  | "reschedule"
  | "schedule"
  | "types"
  | "new"
  | "clients"
  | "priceList"
  | "invoices"
  | "stats"
  | "settings"
  | "logout";

interface NavItem {
  href: string;
  label: string;
  icon: IconKey;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    label: "Appuntamenti",
    items: [
      { href: "/admin", label: "Prenotazioni", icon: "bookings" },
      { href: "/admin/agenda", label: "Agenda", icon: "agenda" },
      { href: "/admin/calendar", label: "Calendario", icon: "calendar" },
      { href: "/admin/reschedule", label: "Spostamenti", icon: "reschedule" },
      { href: "/admin/schedule", label: "Orario settimanale", icon: "schedule" },
      { href: "/admin/appointment-types", label: "Calendari/servizi", icon: "types" },
      { href: "/admin/bookings/new", label: "Nuovo appuntamento", icon: "new" },
    ],
  },
  {
    label: "Anagrafica & Fatturazione",
    items: [
      { href: "/admin/clients", label: "Clienti", icon: "clients" },
      { href: "/admin/price-list", label: "Listino", icon: "priceList" },
      { href: "/admin/invoices", label: "Fatture", icon: "invoices" },
    ],
  },
  {
    label: "Impostazioni",
    items: [
      { href: "/admin/stats", label: "Statistiche", icon: "stats" },
      { href: "/admin/settings", label: "Impostazioni", icon: "settings" },
    ],
  },
];

const ICON_PATHS: Record<IconKey, React.ReactNode> = {
  bookings: <path strokeLinecap="round" strokeLinejoin="round" d="M9 3.5h6a1 1 0 0 1 1 1V5h1a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h1v-.5a1 1 0 0 1 1-1ZM8 12h8M8 16h5" />,
  agenda: (
    <>
      <rect x="3.5" y="5" width="17" height="16" rx="2" />
      <path strokeLinecap="round" d="M8 3v4M16 3v4M3.5 10h17M8 14h.01M12 14h.01M16 14h.01M8 17h.01M12 17h.01" />
    </>
  ),
  calendar: (
    <>
      <rect x="3.5" y="5" width="17" height="16" rx="2" />
      <path strokeLinecap="round" d="M8 3v4M16 3v4M3.5 10h17" />
    </>
  ),
  reschedule: <path strokeLinecap="round" strokeLinejoin="round" d="M7 7h11l-3-3m3 3-3 3M17 17H6l3 3m-3-3 3-3" />,
  schedule: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 7.5V12l3 2" />
    </>
  ),
  types: (
    <>
      <rect x="3.5" y="3.5" width="7" height="7" rx="1.2" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="1.2" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="1.2" />
      <rect x="13.5" y="13.5" width="7" height="7" rx="1.2" />
    </>
  ),
  new: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path strokeLinecap="round" d="M12 8.5v7M8.5 12h7" />
    </>
  ),
  clients: (
    <>
      <circle cx="9" cy="8" r="3" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.5 20a5.5 5.5 0 0 1 11 0M16 9a2.5 2.5 0 1 0 0-5M18.5 20a4.5 4.5 0 0 0-4-4.46" />
    </>
  ),
  priceList: (
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M12 3.5 20.5 12 12 20.5 3.5 12 12 3.5Z M9 9h.01"
    />
  ),
  invoices: (
    <>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6.5 3.5h8l3 3v14h-11z" />
      <path strokeLinecap="round" d="M9 10.5h6M9 14h6M9 17.5h4" />
    </>
  ),
  stats: <path strokeLinecap="round" strokeLinejoin="round" d="M4 20V10M10 20V4M16 20v-7M20 20H4" />,
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"
      />
    </>
  ),
  logout: (
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M15.5 17.5 21 12l-5.5-5.5M9.5 12H21M13.5 4H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h8.5"
    />
  ),
};

function NavIcon({ icon }: { icon: IconKey }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5 shrink-0">
      {ICON_PATHS[icon]}
    </svg>
  );
}

function NavContent({
  pathname,
  onNavigate,
  onLogout,
  collapsed,
}: {
  pathname: string;
  onNavigate?: () => void;
  onLogout: () => void;
  collapsed?: boolean;
}) {
  return (
    <>
      {NAV_GROUPS.map((group) => (
        <div key={group.label} className="mb-5">
          {!collapsed && (
            <div className="mb-1 px-2 text-xs font-semibold uppercase tracking-wide text-neutral-400 dark:text-neutral-500">
              {group.label}
            </div>
          )}
          <nav className="space-y-0.5">
            {group.items.map((item) => {
              const isActive = item.href === "/admin" ? pathname === "/admin" : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onNavigate}
                  title={collapsed ? item.label : undefined}
                  className={`group relative flex items-center gap-2.5 rounded-md px-2 py-2 text-sm transition-colors sm:py-1.5 ${
                    collapsed ? "justify-center" : ""
                  } ${
                    isActive
                      ? "bg-yellow-400 font-medium text-neutral-900"
                      : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-300 dark:hover:bg-neutral-800 dark:hover:text-white"
                  }`}
                >
                  <NavIcon icon={item.icon} />
                  {!collapsed && <span>{item.label}</span>}
                  {collapsed && (
                    <span className="pointer-events-none absolute left-full top-1/2 z-50 ml-2 -translate-y-1/2 whitespace-nowrap rounded-md bg-neutral-900 px-2 py-1 text-xs font-medium text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100 dark:bg-neutral-700">
                      {item.label}
                    </span>
                  )}
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
          title={collapsed ? "Esci" : undefined}
          className={`group relative flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-left text-sm text-red-500 transition-colors hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/30 sm:py-1.5 ${
            collapsed ? "justify-center" : ""
          }`}
        >
          <NavIcon icon="logout" />
          {!collapsed && <span>Esci</span>}
          {collapsed && (
            <span className="pointer-events-none absolute left-full top-1/2 z-50 ml-2 -translate-y-1/2 whitespace-nowrap rounded-md bg-neutral-900 px-2 py-1 text-xs font-medium text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100 dark:bg-neutral-700">
              Esci
            </span>
          )}
        </button>
      </div>
    </>
  );
}

const SIDEBAR_COLLAPSED_KEY = "koalendar_admin_sidebar_collapsed";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const isLogin = pathname === "/admin/login";
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    setMobileNavOpen(false);
  }, [pathname]);

  useEffect(() => {
    setCollapsed(localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "1");
  }, []);

  function toggleCollapsed() {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, next ? "1" : "0");
      return next;
    });
  }

  async function handleLogout() {
    if (!window.confirm("Confermi di voler uscire?")) return;
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/admin/login");
    router.refresh();
  }

  if (isLogin) {
    return (
      <ToastProvider>
        <div className="min-h-screen bg-neutral-50 text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100">{children}</div>
      </ToastProvider>
    );
  }

  return (
    <ToastProvider>
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
        <aside
          className={`sticky top-[57px] hidden h-[calc(100vh-57px)] shrink-0 overflow-y-auto border-r border-neutral-200 bg-white py-4 transition-[width] dark:border-neutral-800 dark:bg-neutral-900 sm:block ${
            collapsed ? "w-14 px-2" : "w-56 px-3"
          }`}
        >
          <NavContent pathname={pathname} onLogout={handleLogout} collapsed={collapsed} />

          <button
            onClick={toggleCollapsed}
            title={collapsed ? "Espandi menu" : "Comprimi menu"}
            className={`mt-2 flex w-full items-center gap-2.5 rounded-md border-t border-neutral-200 px-2 pt-3 text-sm text-neutral-400 transition-colors hover:text-neutral-700 dark:border-neutral-800 dark:text-neutral-500 dark:hover:text-neutral-200 ${
              collapsed ? "justify-center" : ""
            }`}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className={`h-4 w-4 shrink-0 transition-transform ${collapsed ? "rotate-180" : ""}`}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 6l-6 6 6 6" />
            </svg>
            {!collapsed && <span>Comprimi</span>}
          </button>
        </aside>

        <main className="min-w-0 flex-1 px-3 py-4 sm:px-6 sm:py-6">
          <div className="mx-auto max-w-5xl">{children}</div>
        </main>
      </div>
    </div>
    </ToastProvider>
  );
}
