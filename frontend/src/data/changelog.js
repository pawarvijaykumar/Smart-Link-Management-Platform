// SmartLink Product Changelog — Single Source of Truth
// Schema: { id, date (ISO YYYY-MM-DD), release (optional), category ("feature" | "improvement" | "fix" | "security"), title, description, link (optional) }

export const CHANGELOG = [
  {
    id: "google-sign-in",
    date: "2026-11-22",
    release: "v2.5",
    category: "feature",
    title: '"Continue with Google" sign-in',
    description: "Sign in or register with a Google account in one click.",
    link: "/login",
  },
  {
    id: "light-theme-fixes",
    date: "2026-11-22",
    release: "v2.5",
    category: "improvement",
    title: "Light theme fixes",
    description: "Text, inputs and cards are now readable and clearly separated in light mode.",
  },
  {
    id: "settings-and-appearance",
    date: "2026-11-21",
    release: "v2.4",
    category: "feature",
    title: "Settings and appearance",
    description: "Choose theme, background style and accent colour from Settings.",
  },
  {
    id: "public-website",
    date: "2026-11-21",
    release: "v2.4",
    category: "feature",
    title: "Public website",
    description: "New landing, pricing, docs and changelog pages.",
  },
  {
    id: "sidebar-usage-and-about",
    date: "2026-11-20",
    category: "improvement",
    title: "Sidebar usage and About",
    description: "Plan usage, what's new and help links now sit at the bottom of the sidebar.",
  },
  {
    id: "reports-and-export",
    date: "2026-11-15",
    release: "v2.2",
    category: "feature",
    title: "Reports and export",
    description: "Download PDF reports and CSV datasets for your links.",
  },
  {
    id: "geo-analytics-layout",
    date: "2026-11-10",
    category: "fix",
    title: "Geo analytics layout",
    description: "Country and city stat cards now match the rest of the dashboard.",
  },
  {
    id: "qr-code-styling",
    date: "2026-10-28",
    release: "v2.0",
    category: "feature",
    title: "Dynamic vector QR codes",
    description: "Generate and download high-resolution SVG and PNG QR codes with customizable brand palettes.",
  },
  {
    id: "ab-variant-testing",
    date: "2026-10-14",
    release: "v1.9",
    category: "feature",
    title: "A/B link variant testing",
    description: "Distribute incoming traffic across multiple destination URLs with custom split weights.",
  },
];

export default CHANGELOG;
