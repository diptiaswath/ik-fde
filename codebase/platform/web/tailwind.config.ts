import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
    // Tremor needs its own files scanned so its utility classes are generated.
    "./node_modules/@tremor/**/*.{js,ts,jsx,tsx,mjs}",
  ],
  theme: {
    transparent: "transparent",
    current: "currentColor",
    extend: {
      colors: {
        // ---- Meridian brand ----------------------------------------------
        meridian: {
          // teal-emerald primary
          DEFAULT: "#0D9488",
          primary: "#0D9488",
          deep: "#0F766E",
          darkest: "#0B2E2A", // sidebar
          // gold accent
          gold: "#C8A04E",
          goldSoft: "#F5ECD7",
          // neutrals
          bg: "#F6F7F5",
          card: "#FFFFFF",
          ink: "#0F1A17",
          muted: "#64748B",
          line: "#E6E9E6",
          // back-compat alias used by older markup; map onto brand teal
          accent: "#0D9488",
        },
        // ---- Semantic (status only) --------------------------------------
        breach: "#E11D48",
        risk: "#D97706",
        ontime: "#16A34A",
        infoblue: "#0EA5E9",

        // ---- Tremor tokens (light theme) ---------------------------------
        tremor: {
          brand: {
            faint: "#F5ECD7",
            muted: "#99F6E4",
            subtle: "#2DD4BF",
            DEFAULT: "#0D9488",
            emphasis: "#0F766E",
            inverted: "#FFFFFF",
          },
          background: {
            muted: "#F6F7F5",
            subtle: "#F1F5F4",
            DEFAULT: "#FFFFFF",
            emphasis: "#334155",
          },
          border: { DEFAULT: "#E6E9E6" },
          ring: { DEFAULT: "#E6E9E6" },
          content: {
            subtle: "#94A3B8",
            DEFAULT: "#64748B",
            emphasis: "#0F1A17",
            strong: "#0F1A17",
            inverted: "#FFFFFF",
          },
        },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "ui-sans-serif", "system-ui", "sans-serif"],
        serif: ["var(--font-serif)", "Georgia", "serif"],
        mono: ["var(--font-mono)", "ui-monospace", "SFMono-Regular", "monospace"],
      },
      boxShadow: {
        card: "0 1px 2px 0 rgb(15 26 23 / 0.04), 0 1px 3px 0 rgb(15 26 23 / 0.06)",
        cardHover:
          "0 2px 4px 0 rgb(15 26 23 / 0.06), 0 4px 12px 0 rgb(15 26 23 / 0.08)",
        // Tremor dropdowns
        "tremor-input": "0 1px 2px 0 rgb(0 0 0 / 0.05)",
        "tremor-card":
          "0 1px 2px 0 rgb(15 26 23 / 0.04), 0 1px 3px 0 rgb(15 26 23 / 0.06)",
        "tremor-dropdown":
          "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)",
      },
      borderRadius: {
        "tremor-small": "0.375rem",
        "tremor-default": "0.5rem",
        "tremor-full": "9999px",
      },
      fontSize: {
        "tremor-label": ["0.75rem", { lineHeight: "1rem" }],
        "tremor-default": ["0.875rem", { lineHeight: "1.25rem" }],
        "tremor-title": ["1.125rem", { lineHeight: "1.75rem" }],
        "tremor-metric": ["1.875rem", { lineHeight: "2.25rem" }],
      },
    },
  },
  safelist: [
    {
      pattern:
        /^(bg-(?:slate|teal|emerald|rose|amber|sky|cyan)-(?:50|100|200|300|400|500|600|700))$/,
      variants: ["hover", "ui-selected"],
    },
    {
      pattern:
        /^(text-(?:slate|teal|emerald|rose|amber|sky|cyan)-(?:50|100|200|300|400|500|600|700|800|900))$/,
      variants: ["hover", "ui-selected"],
    },
    {
      pattern:
        /^(border-(?:slate|teal|emerald|rose|amber|sky|cyan)-(?:50|100|200|300|400|500|600|700))$/,
    },
    {
      pattern:
        /^(ring-(?:slate|teal|emerald|rose|amber|sky|cyan)-(?:50|100|200|300|400|500|600|700))$/,
    },
    {
      pattern:
        /^(fill-(?:slate|teal|emerald|rose|amber|sky|cyan)-(?:50|100|200|300|400|500|600|700))$/,
    },
  ],
  plugins: [],
};

export default config;
