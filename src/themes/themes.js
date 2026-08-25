/*
 * Wayfinder - themes.js
 *
 * Purpose:
 * Defines the available Wayfinder visual themes and applies the selected
 * theme to the current Canvas page.
 *
 * The THEMES collection currently defines:
 *
 * - UBTech
 * - Slate
 * - Forest
 * - Dark
 * - Midnight
 * - High Contrast
 *
 * Each theme includes a stable theme ID, display name, and the Wayfinder
 * logo variant that should be used with that theme.
 *
 * getTheme() resolves a supplied theme ID or theme object and safely
 * falls back to the UBTech theme when the requested theme is missing
 * or invalid.
 *
 * applyTheme() writes the selected theme ID to the
 * data-cpt-theme attribute on the document's root HTML element.
 *
 * Wayfinder's CSS uses that data attribute to activate the appropriate
 * theme-specific colors and presentation rules.
 *
 * This file selects and identifies themes; the actual theme styling is
 * defined in the project's CSS.
 */



export const THEMES = {
  ubtech: {
    id: "ubtech",
    name: "UBTech",
    logo: "assets/branding/Wayfinder_White.svg"
  },

  slate: {
    id: "slate",
    name: "Slate",
    logo: "assets/branding/Wayfinder_Dark.svg"
  },

  forest: {
    id: "forest",
    name: "Forest",
    logo: "assets/branding/Wayfinder_Dark.svg"
  },

  dark: {
    id: "dark",
    name: "Dark",
    logo: "assets/branding/Wayfinder_White.svg"
  },

  midnight: {
    id: "midnight",
    name: "Midnight",
    logo: "assets/branding/Wayfinder_White.svg"
  },

  highcontrast: {
    id: "highcontrast",
    name: "High Contrast",
    logo: "assets/branding/Wayfinder_Dark.svg"
  }
};

export function getTheme(themeId = "ubtech") {
  const id =
    typeof themeId === "string"
      ? themeId
      : themeId?.id || "ubtech";

  return THEMES[id] || THEMES.ubtech;
}

export function applyTheme(themeId = "ubtech") {
  document.documentElement.dataset.cptTheme = getTheme(themeId).id;
}