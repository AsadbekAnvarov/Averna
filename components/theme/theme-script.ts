/**
 * Inline <head> script: applies the saved theme (localStorage "averna_theme",
 * written by ThemeProvider) before the first paint, so light-theme users never
 * see a flash of the dark theme while the page hydrates.
 * Kept free of "use client" so the server layout can inline the string.
 */
export const THEME_SCRIPT = `try{if(localStorage.getItem("averna_theme")==="light"){var e=document.documentElement;e.classList.remove("dark");e.classList.add("light")}}catch(_){}`;
