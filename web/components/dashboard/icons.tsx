import type { SVGProps } from "react";

export type IconName =
  | "overview"
  | "problems"
  | "reviews"
  | "history"
  | "insights"
  | "profiles"
  | "search"
  | "sun"
  | "moon"
  | "menu"
  | "close"
  | "collapse"
  | "expand"
  | "grid"
  | "list"
  | "chevron"
  | "external"
  | "play"
  | "pause"
  | "first"
  | "last"
  | "previous"
  | "next"
  | "check"
  | "info";

const paths: Record<IconName, React.ReactNode> = {
  overview: <><path d="M3 11.5 12 4l9 7.5" /><path d="M5.5 10.5V20h13v-9.5M9 20v-6h6v6" /></>,
  problems: <><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></>,
  reviews: <><path d="M20 7h-6V1" /><path d="M20 7a9 9 0 1 0 1 7" /></>,
  history: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  insights: <><path d="M4 19V9M10 19V5M16 19v-7M22 19H2" /></>,
  profiles: <><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>,
  search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></>,
  sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></>,
  moon: <path d="M20.5 15.5A9 9 0 0 1 8.5 3.5a9 9 0 1 0 12 12Z" />,
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  close: <path d="m6 6 12 12M18 6 6 18" />,
  collapse: <path d="m14 6-6 6 6 6" />,
  expand: <path d="m10 6 6 6-6 6" />,
  grid: <><rect x="4" y="4" width="6" height="6" rx="1" /><rect x="14" y="4" width="6" height="6" rx="1" /><rect x="4" y="14" width="6" height="6" rx="1" /><rect x="14" y="14" width="6" height="6" rx="1" /></>,
  list: <path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01" />,
  chevron: <path d="m7 10 5 5 5-5" />,
  external: <><path d="M14 4h6v6M20 4l-9 9" /><path d="M18 13v6a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h6" /></>,
  play: <path d="m8 5 11 7-11 7Z" />,
  pause: <path d="M9 5v14M15 5v14" />,
  first: <path d="M6 5v14M18 6l-8 6 8 6Z" />,
  last: <path d="M18 5v14M6 6l8 6-8 6Z" />,
  previous: <path d="m15 18-6-6 6-6" />,
  next: <path d="m9 18 6-6-6-6" />,
  check: <path d="m5 12 4 4L19 6" />,
  info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" /></>,
};

export function Icon({
  name,
  size = 20,
  ...props
}: SVGProps<SVGSVGElement> & { name: IconName; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {paths[name]}
    </svg>
  );
}
