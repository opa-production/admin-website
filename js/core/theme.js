// js/core/theme.js — light/dark theming.
//
// Loaded as a BLOCKING script in <head> (before any stylesheet paints) so the
// page never flashes the wrong theme on load. It only stamps
// <html data-theme="light|dark">; every colour decision lives in the token
// blocks at the top of dashboard.css / login.css.
//
// Preference order: the admin's explicit choice (localStorage) → the operating
// system's setting. Choosing nothing means the dashboard follows the OS, and
// keeps following it if the OS flips at sunset.

(function () {
  const STORAGE_KEY = "admin_theme";

  function storedChoice() {
    try {
      const value = localStorage.getItem(STORAGE_KEY);
      return value === "dark" || value === "light" ? value : null;
    } catch (e) {
      return null; // private mode / storage blocked
    }
  }

  function systemTheme() {
    return window.matchMedia &&
      window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  }

  function resolve() {
    return storedChoice() || systemTheme();
  }

  function apply(theme) {
    document.documentElement.setAttribute("data-theme", theme);
  }

  apply(resolve());

  window.adminTheme = {
    current: resolve,
    isExplicit: () => storedChoice() !== null,
    set(theme) {
      try {
        localStorage.setItem(STORAGE_KEY, theme);
      } catch (e) {
        /* the theme still applies for this page load */
      }
      apply(theme);
      window.dispatchEvent(
        new CustomEvent("adminthemechange", { detail: { theme: theme } }),
      );
      return theme;
    },
    toggle() {
      return this.set(resolve() === "dark" ? "light" : "dark");
    },
  };

  // Track the OS only while the admin hasn't made a choice of their own.
  if (window.matchMedia) {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      if (!window.adminTheme.isExplicit()) {
        const theme = systemTheme();
        apply(theme);
        window.dispatchEvent(
          new CustomEvent("adminthemechange", { detail: { theme: theme } }),
        );
      }
    };
    if (mq.addEventListener) mq.addEventListener("change", onChange);
    else if (mq.addListener) mq.addListener(onChange);
  }
})();
