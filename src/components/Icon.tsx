// Inline stroke icons (24px grid). Decorative by default; pass `label` to make one meaningful.
const PATHS = {
  today: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2.75v2M12 19.25v2M5.46 5.46l1.41 1.41M17.13 17.13l1.41 1.41M2.75 12h2M19.25 12h2M5.46 18.54l1.41-1.41M17.13 6.87l1.41-1.41" />
    </>
  ),
  plan: (
    <>
      <path d="M10.5 6.5h9.5M10.5 12h9.5M10.5 17.5h9.5" />
      <path d="M4 6.75l1.5 1.5 2.5-2.75M4 12.25l1.5 1.5 2.5-2.75" />
      <circle cx="5.75" cy="17.5" r="1.25" />
    </>
  ),
  progress: (
    <>
      <path d="M3.5 17.5l5.5-5.5 4 4 7.5-7.5" />
      <path d="M15 8.5h5.5V14" />
    </>
  ),
  learn: (
    <>
      <path d="M12 7c-1.9-1.5-4.4-2.25-8-2.25v13.5c3.6 0 6.1.75 8 2.25 1.9-1.5 4.4-2.25 8-2.25V4.75c-3.6 0-6.1.75-8 2.25z" />
      <path d="M12 7v13.5" />
    </>
  ),
  settings: (
    <>
      <path d="M4 7h9M18 7h2M4 17h2M11 17h9" />
      <circle cx="15.5" cy="7" r="2.25" />
      <circle cx="8.5" cy="17" r="2.25" />
    </>
  ),
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  lock: (
    <>
      <rect x="5.5" y="11" width="13" height="9.5" rx="2.5" />
      <path d="M8.5 11V8.5a3.5 3.5 0 0 1 7 0V11" />
    </>
  ),
  star: <path d="M12 3.5l2.6 5.3 5.8.8-4.2 4.1 1 5.8L12 16.8l-5.2 2.7 1-5.8-4.2-4.1 5.8-.8z" />,
  bulb: (
    <>
      <path d="M9 18h6M10 21h4" />
      <path d="M12 3a6 6 0 0 0-3.5 10.9c.6.4 1 1.1 1 1.8V16h5v-.3c0-.7.4-1.4 1-1.8A6 6 0 0 0 12 3z" />
    </>
  ),
  heart: <path d="M12 20s-7.5-4.6-7.5-10A4.5 4.5 0 0 1 12 7.2 4.5 4.5 0 0 1 19.5 10c0 5.4-7.5 10-7.5 10z" />,
  alert: (
    <>
      <path d="M12 4l9 16H3z" />
      <path d="M12 10v4M12 17v.5" />
    </>
  ),
  party: (
    <>
      <path d="M4 20l4.5-12L16 15.5z" />
      <path d="M14 4v2M18 6l-1.5 1.5M20 10h-2M12.5 8.5c1-1 2.5-1 3.5 0" />
    </>
  ),
  back: <path d="M15 5l-7 7 7 7" />,
  arrowIf: (
    <>
      <path d="M6 4v7a3 3 0 0 0 3 3h10" />
      <path d="M15 10l4 4-4 4" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  trend: (
    <>
      <path d="M4 19h16" />
      <path d="M6 15l4-4 3 3 5-6" />
    </>
  ),
  users: (
    <>
      <circle cx="9" cy="8" r="3" />
      <path d="M3.5 19c.6-3 2.8-4.5 5.5-4.5s4.9 1.5 5.5 4.5M15.5 5.5a3 3 0 0 1 0 5.5M17 14.7c1.9.5 3.1 1.9 3.5 4.3" />
    </>
  ),
  sprout: (
    <>
      <path d="M12 21v-8" />
      <path d="M12 13c0-4-2.5-6.5-7-6.5 0 4.2 2.6 6.5 7 6.5z" />
      <path d="M12 11c0-3.6 2.3-6 6.5-6 0 3.9-2.4 6-6.5 6z" />
    </>
  ),
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({
  name,
  size = 22,
  stroke = 1.75,
  label,
  className,
}: {
  name: IconName;
  size?: number;
  stroke?: number;
  label?: string;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
    >
      {PATHS[name]}
    </svg>
  );
}

/** The streak flame from the "Momentum" direction, in the warm streak colour. */
export function Flame({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        className="flame-fill"
        d="M12 2.5c1.2 3.6 5.5 6 5.5 11a5.5 5.5 0 0 1-11 0c0-2.4 1.1-4.1 2.4-5.4.2 1.7 1 2.8 2.1 3.3-.5-3.6.1-6.4 1-8.9z"
      />
      <path className="flame-core" d="M12 18.6a2.4 2.4 0 0 1-2.4-2.4c0-1.5 1.2-2.5 2.4-3.8 1.2 1.3 2.4 2.3 2.4 3.8a2.4 2.4 0 0 1-2.4 2.4z" />
    </svg>
  );
}
