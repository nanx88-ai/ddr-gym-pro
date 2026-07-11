"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import NotificationBell from "@/components/NotificationBell";
import MobileNavSheet from "@/components/MobileNavSheet";
import PwaRegister from "@/components/PwaRegister";
import { ToastProvider } from "@/components/Toast";
import { ConfirmDialogProvider, useConfirm } from "@/components/ConfirmDialog";
import { NAV_GROUPS, NavIcon } from "@/components/AdminNav";

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
      {NAV_GROUPS.map((group, i) => (
        <div
          key={i}
          className={`mb-3 pb-3 ${i > 0 ? "border-t border-neutral-200 pt-3 dark:border-neutral-800" : ""}`}
        >
          <nav className="space-y-0.5">
            {group.items.map((item) => {
              const isActive =
                item.href === "/admin"
                  ? pathname === "/admin"
                  : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onNavigate}
                  title={collapsed ? item.label : undefined}
                  className={`group relative flex items-center gap-2.5 px-2 py-2 text-sm transition-colors sm:py-1.5 ${
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
                    <span className="pointer-events-none absolute left-full top-1/2 z-50 ml-2 -translate-y-1/2 whitespace-nowrap bg-neutral-900 px-2 py-1 text-xs font-medium text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100 dark:bg-neutral-700">
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
          className={`group relative flex w-full items-center gap-2.5 px-2 py-2 text-left text-sm text-red-500 transition-colors hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/30 sm:py-1.5 ${
            collapsed ? "justify-center" : ""
          }`}
        >
          <NavIcon icon="logout" />
          {!collapsed && <span>Esci</span>}
          {collapsed && (
            <span className="pointer-events-none absolute left-full top-1/2 z-50 ml-2 -translate-y-1/2 whitespace-nowrap bg-neutral-900 px-2 py-1 text-xs font-medium text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100 dark:bg-neutral-700">
              Esci
            </span>
          )}
        </button>
      </div>
    </>
  );
}

const SIDEBAR_COLLAPSED_KEY = "koalendar_admin_sidebar_collapsed";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ToastProvider>
      <ConfirmDialogProvider>
        <AdminLayoutInner>{children}</AdminLayoutInner>
      </ConfirmDialogProvider>
    </ToastProvider>
  );
}

function AdminLayoutInner({ children }: { children: React.ReactNode }) {
  const confirm = useConfirm();
  const pathname = usePathname();
  const router = useRouter();
  const isLogin = pathname === "/admin/login";
  const [collapsed, setCollapsed] = useState(false);

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
    if (!(await confirm("Confermi di voler uscire?"))) return;
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/admin/login");
    router.refresh();
  }

  if (isLogin) {
    return (
      <div
        className="min-h-screen bg-neutral-50 text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100"
        style={{ paddingTop: "env(safe-area-inset-top)" }}
      >
        {children}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100">
      <PwaRegister />
      {/* paddingTop copre l'area status bar (notch/carrier/batteria) quando la
          PWA gira standalone da schermata Home: stesso sfondo dell'header,
          cosi' non resta ne' vuota di colore diverso ne' sovrapposta al testo. */}
      <header
        className="sticky top-0 z-30 border-b border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900"
        style={{ paddingTop: "env(safe-area-inset-top)" }}
      >
        <div className="flex items-center justify-between px-3 py-3 sm:px-4">
          <Link href="/admin" className="font-semibold text-neutral-900 dark:text-white">
            DDR <span className="text-yellow-500 dark:text-yellow-400">Academy</span>
          </Link>
          <div className="flex items-center gap-1 sm:gap-2">
            <NotificationBell />
          </div>
        </div>
      </header>

      <MobileNavSheet pathname={pathname} onLogout={handleLogout} />

      <div className="flex pb-20 sm:pb-0">
        <aside
          className={`sticky hidden shrink-0 overflow-y-auto border-r border-neutral-200 bg-white py-4 transition-[width] dark:border-neutral-800 dark:bg-neutral-900 sm:block ${
            collapsed ? "w-14 px-2" : "w-56 px-3"
          }`}
          style={{
            top: "calc(env(safe-area-inset-top) + 57px)",
            height: "calc(100vh - env(safe-area-inset-top) - 57px)",
          }}
        >
          <NavContent
            pathname={pathname}
            onLogout={handleLogout}
            collapsed={collapsed}
          />

          <button
            onClick={toggleCollapsed}
            title={collapsed ? "Espandi menu" : "Comprimi menu"}
            className={`mt-2 flex w-full items-center gap-2.5 border-t border-neutral-200 px-2 pt-3 text-sm text-neutral-400 transition-colors hover:text-neutral-700 dark:border-neutral-800 dark:text-neutral-500 dark:hover:text-neutral-200 ${
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
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15 6l-6 6 6 6"
              />
            </svg>
            {!collapsed && <span>Comprimi</span>}
          </button>
        </aside>

        <main className="min-w-0 flex-1 px-3 py-4 sm:px-6 sm:py-6">
          {/* Cap largo ma non illimitato: le pagine con tabelle/liste
              sfruttano lo spazio su desktop, quelle con form stretti
              impostano il proprio max-w piu' piccolo internamente. */}
          <div className="mx-auto max-w-[1600px]">{children}</div>
        </main>
      </div>
    </div>
  );
}
