/**
 * Browser-chrome colour (`meta[name="theme-color"]`) for each theme: the colour
 * of the top app bar, so the mobile status bar / PWA title bar blends with it.
 * app/layout.tsx renders the tag with the dark value; THEME_SCRIPT and
 * ThemeProvider switch it to match the active theme.
 */
export const THEME_COLORS = { dark: "#04070d", light: "#ffffff" } as const;

/**
 * Inline <head> script: applies the saved theme (localStorage "averna_theme",
 * written by ThemeProvider) before the first paint, so light-theme users never
 * see a flash of the dark theme while the page hydrates. The theme-color meta
 * tag is rendered before this script, so it can be updated synchronously too.
 * Kept free of "use client" so the server layout can inline the string.
 */
export const THEME_SCRIPT = `try{if(localStorage.getItem("averna_theme")==="light"){var e=document.documentElement;e.classList.remove("dark");e.classList.add("light");var m=document.querySelector('meta[name="theme-color"]');if(m)m.setAttribute("content",${JSON.stringify(THEME_COLORS.light)})}}catch(_){}`;
