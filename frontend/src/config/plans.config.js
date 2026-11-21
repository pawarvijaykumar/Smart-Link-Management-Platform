// Configuration for subscription plan limits, feature thresholds, and announcements

export const PLAN_LIMITS = {
  free: {
    id: "free",
    name: "Free",
    badge: "FREE",
    maxLinks: 50,
    maxClicks: 1000,
    isHighest: false,
  },
  pro: {
    id: "pro",
    name: "Pro",
    badge: "PRO",
    maxLinks: 50,
    maxClicks: 10000,
    isHighest: false,
  },
  team: {
    id: "team",
    name: "Team",
    badge: "TEAM",
    maxLinks: 1000,
    maxClicks: 100000,
    isHighest: true,
  },
};

export const CURRENT_PLAN = "pro";

export const APP_INFO = {
  name: "SmartLink",
  version: "v2.4.0",
  status: "Operational",
  releaseDate: "November 21, 2026",
  statusUrl: "/status",
  docsUrl: "/docs",
  privacyUrl: "/docs",
  termsUrl: "/docs",
};

export const WHATS_NEW_UPDATES = [
  {
    version: "v2.4.0",
    title: "Linear Theme & Tabbed Settings",
    desc: "Clean solid tokens, Paper light theme, and full 5-tab user settings suite.",
    date: "Today",
  },
  {
    version: "v2.3.0",
    title: "Specular Buttons & Spotlight Cards",
    desc: "Physics-based cursor light reflection and tactile card hover spotlights.",
    date: "Nov 20",
  },
  {
    version: "v2.2.0",
    title: "Smart Traffic Anomaly Detection",
    desc: "Real-time algorithmic spike and surge detection with alert notifications.",
    date: "Nov 16",
  },
];

export const ANNOUNCEMENT_CONFIG = {
  id: "smartlink_announcement_v2_4_0",
  message: "SmartLink v2.4 is live with developer documentation, status metrics, and theme presets.",
  learnMorePath: "/changelog",
};
