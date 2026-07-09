export const THEME_STORAGE_KEY = "koalendar_admin_theme";

// Eseguito come script inline bloccante nel <head>, prima dell'idratazione
// React, per evitare il flash del tema sbagliato al caricamento.
export const THEME_INIT_SCRIPT = `
(function () {
  try {
    var stored = localStorage.getItem('${THEME_STORAGE_KEY}');
    var theme = stored || 'dark';
    if (theme === 'dark') document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  } catch (e) {}
})();
`;

export function getStoredTheme(): "light" | "dark" {
  if (typeof window === "undefined") return "dark";
  return (localStorage.getItem(THEME_STORAGE_KEY) as "light" | "dark") || "dark";
}

export const THEME_CHANGE_EVENT = "koalendar-theme-change";

export function setStoredTheme(theme: "light" | "dark") {
  localStorage.setItem(THEME_STORAGE_KEY, theme);
  if (theme === "dark") document.documentElement.classList.add("dark");
  else document.documentElement.classList.remove("dark");
  window.dispatchEvent(new CustomEvent(THEME_CHANGE_EVENT, { detail: theme }));
}
