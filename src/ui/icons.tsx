import type { ReactNode, SVGProps } from 'react';

// Icons from the design, 16 x 16 on a 1.5 px line. Decorative: the label is always next to them.

interface IconProps extends Omit<SVGProps<SVGSVGElement>, 'children'> {
  size?: number;
  strokeWidth?: number;
}

function Svg({
  size = 14,
  strokeWidth = 1.5,
  children,
  ...rest
}: IconProps & { children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...rest}
    >
      {children}
    </svg>
  );
}

export const IconCheckCircle = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="8" cy="8" r="6.3" />
    <path d="m5.2 8.2 2 2 3.8-4" />
  </Svg>
);
export const IconError = (p: IconProps) => (
  <Svg {...p}>
    <path d="M5.2 1.5h5.6l3.7 3.7v5.6l-3.7 3.7H5.2l-3.7-3.7V5.2z" />
    <path d="M8 4.8v3.8M8 10.8v.4" />
  </Svg>
);
export const IconWarning = (p: IconProps) => (
  <Svg {...p}>
    <path d="M8 1.8 15 14H1z" />
    <path d="M8 6v3.6M8 11.6v.4" />
  </Svg>
);
export const IconNotApplicable = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="8" cy="8" r="6.3" />
    <path d="M5 8h6" />
  </Svg>
);
export const IconChevronLeft = (p: IconProps) => (
  <Svg {...p}>
    <path d="m10 4-4 4 4 4" />
  </Svg>
);
export const IconChevronRight = (p: IconProps) => (
  <Svg {...p}>
    <path d="m6 4 4 4-4 4" />
  </Svg>
);
export const IconChevronDown = (p: IconProps) => (
  <Svg {...p}>
    <path d="m4 6 4 4 4-4" />
  </Svg>
);
export const IconChevronUp = (p: IconProps) => (
  <Svg {...p}>
    <path d="m4 10 4-4 4 4" />
  </Svg>
);
export const IconSearch = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="7" cy="7" r="4.5" />
    <path d="m10.5 10.5 3.5 3.5" />
  </Svg>
);
export const IconImport = (p: IconProps) => (
  <Svg {...p}>
    <path d="M8 2v8M4.5 6.5 8 10l3.5-3.5M2.5 13.5h11" />
  </Svg>
);
export const IconLock = (p: IconProps) => (
  <Svg strokeWidth={2} {...p}>
    <rect x="3" y="7" width="10" height="7.5" rx="1" />
    <path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" />
  </Svg>
);
export const IconPlug = (p: IconProps) => (
  <Svg strokeWidth={2} {...p}>
    <path d="M5.5 1.5v3.5M10.5 1.5v3.5M3.5 5h9v2.5a4.5 4.5 0 0 1-9 0zM8 12v2.5" />
  </Svg>
);
export const IconReefer = (p: IconProps) => (
  <Svg strokeWidth={1.4} {...p}>
    <path d="M8 1.5v13M2.4 4.75l11.2 6.5M2.4 11.25l11.2-6.5M6 2.8 8 4.5l2-1.7M6 13.2 8 11.5l2 1.7" />
  </Svg>
);
export const IconUndo = (p: IconProps) => (
  <Svg {...p}>
    <path d="M5.5 3.5 2.5 6.5l3 3" />
    <path d="M2.5 6.5h7a4 4 0 0 1 0 8h-2" />
  </Svg>
);
export const IconRedo = (p: IconProps) => (
  <Svg {...p}>
    <path d="m10.5 3.5 3 3-3 3" />
    <path d="M13.5 6.5h-7a4 4 0 0 0 0 8h2" />
  </Svg>
);
export const IconClose = (p: IconProps) => (
  <Svg strokeWidth={1.8} {...p}>
    <path d="m4 4 8 8M12 4l-8 8" />
  </Svg>
);
export const IconExpand = (p: IconProps) => (
  <Svg strokeWidth={1.6} {...p}>
    <path d="M9.5 2.5h4v4M13.5 2.5 8.5 7.5M6.5 13.5h-4v-4M2.5 13.5l5-5" />
  </Svg>
);
export const IconSun = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="8" cy="8" r="2.8" />
    <path d="M8 1.5v1.6M8 12.9v1.6M1.5 8h1.6M12.9 8h1.6M3.4 3.4l1.1 1.1M11.5 11.5l1.1 1.1M3.4 12.6l1.1-1.1M11.5 4.5l1.1-1.1" />
  </Svg>
);
export const IconMoon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M13.5 9.6A5.8 5.8 0 0 1 6.4 2.5a5.8 5.8 0 1 0 7.1 7.1z" />
  </Svg>
);
export const IconEye = (p: IconProps) => (
  <Svg {...p}>
    <path d="M1.5 8s2.4-4.5 6.5-4.5S14.5 8 14.5 8 12.1 12.5 8 12.5 1.5 8 1.5 8z" />
    <circle cx="8" cy="8" r="2" />
  </Svg>
);
export const IconRestow = (p: IconProps) => (
  <Svg {...p}>
    <path d="M2 8a6 6 0 0 1 10.2-4.2L14 5.5M14 2v3.5h-3.5M14 8a6 6 0 0 1-10.2 4.2L2 10.5M2 14v-3.5h3.5" />
  </Svg>
);
/** Filled media icons for the port timeline. */
const Solid = ({ d, size = 13 }: { d: string; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
    <path d={d} />
  </svg>
);
export const IconPlay = (p: { size?: number }) => <Solid d="M4 2.5v11l9-5.5z" {...p} />;
export const IconPause = (p: { size?: number }) => <Solid d="M4 3h3v10H4zM9 3h3v10H9z" {...p} />;
export const IconPrevious = (p: { size?: number }) => (
  <Solid d="M3 3h2v10H3zM13 3v10L6 8z" {...p} />
);
export const IconNext = (p: { size?: number }) => <Solid d="M11 3h2v10h-2zM3 3v10l7-5z" {...p} />;
