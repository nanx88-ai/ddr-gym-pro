export type IconKey =
  | "bookings"
  | "agenda"
  | "calendar"
  | "reschedule"
  | "schedule"
  | "types"
  | "new"
  | "clients"
  | "priceList"
  | "tariffs"
  | "subscriptions"
  | "communications"
  | "invoices"
  | "stats"
  | "settings"
  | "logout";

export interface NavItem {
  href: string;
  label: string;
  icon: IconKey;
}

export interface NavGroup {
  items: NavItem[];
}

export const NAV_GROUPS: NavGroup[] = [
  {
    // Primo gruppo (più frequenti): prenotazioni, planning, creazione
    items: [
      { href: "/admin", label: "Prenotazioni", icon: "bookings" },
      { href: "/admin/agenda", label: "Agenda", icon: "agenda" },
      { href: "/admin/schedule", label: "Planning", icon: "schedule" },
    ],
  },
  {
    // Secondo gruppo: operazioni frequenti
    items: [
      { href: "/admin/bookings/new", label: "Appuntamento", icon: "new" },
      { href: "/admin/communications", label: "Comunicazioni", icon: "communications" },
      { href: "/admin/clients", label: "Clienti", icon: "clients" },
    ],
  },
  {
    // Terzo gruppo: gestione e storico
    items: [
      { href: "/admin/subscriptions", label: "Abbonamenti", icon: "subscriptions" },
      { href: "/admin/invoices", label: "Fatture", icon: "invoices" },
      { href: "/admin/tariffs", label: "Tariffe", icon: "tariffs" },
    ],
  },
  {
    // Quarto gruppo: configurazione (meno frequente)
    items: [
      { href: "/admin/price-list", label: "Listino", icon: "priceList" },
      { href: "/admin/stats", label: "Statistiche", icon: "stats" },
      { href: "/admin/appointment-types", label: "Servizi", icon: "types" },
    ],
  },
  {
    items: [{ href: "/admin/settings", label: "Impostazioni", icon: "settings" }],
  },
];

export const ICON_PATHS: Record<IconKey, React.ReactNode> = {
  bookings: (
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M9 3.5h6a1 1 0 0 1 1 1V5h1a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h1v-.5a1 1 0 0 1 1-1ZM8 12h8M8 16h5"
    />
  ),
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
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3.5 20a5.5 5.5 0 0 1 11 0M16 9a2.5 2.5 0 1 0 0-5M18.5 20a4.5 4.5 0 0 0-4-4.46"
      />
    </>
  ),
  priceList: (
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 3.5 20.5 12 12 20.5 3.5 12 12 3.5Z M9 9h.01" />
  ),
  tariffs: (
    // Cartellino prezzo
    <>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.5 12.5v-8a1 1 0 0 1 1-1h8L20.5 11a1 1 0 0 1 0 1.4l-7.6 7.6a1 1 0 0 1-1.4 0l-8-7.5Z" />
      <path strokeLinecap="round" d="M8 8h.01" />
    </>
  ),
  subscriptions: (
    // Tessera con frecce di rinnovo
    <>
      <rect x="3" y="6" width="18" height="13" rx="1.5" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.5 12.5a2.8 2.8 0 0 1 5.3-1.1M15 9.5v2h-2M14.5 13a2.8 2.8 0 0 1-5.3 1.1M9 16v-2h2" />
    </>
  ),
  communications: (
    // Megafono
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M19 4.5v13l-7-3.5H6a2 2 0 0 1-2-2V10a2 2 0 0 1 2-2h6l7-3.5ZM19 8.5a3.5 3.5 0 0 1 0 5M8.5 14v4.5a1.5 1.5 0 0 0 3 0V14"
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

export function NavIcon({ icon }: { icon: IconKey }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5 shrink-0">
      {ICON_PATHS[icon]}
    </svg>
  );
}
