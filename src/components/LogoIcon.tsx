import { useId } from 'react';

interface LogoIconProps {
  size?: number;
  className?: string;
}

/**
 * SeuBeat logo icon — heart outline with music note + waveform bars inside.
 * Gradient adapts to the site's amber → rose colour scheme.
 */
export default function LogoIcon({ size = 40, className = '' }: LogoIconProps) {
  const uid = useId().replace(/:/g, '');
  const gradId = `sb-g-${uid}`;
  const clipId = `sb-c-${uid}`;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 90"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="SeuBeat"
      role="img"
    >
      <defs>
        {/* Amber → Rose gradient — matches site CTA colours */}
        <linearGradient id={gradId} x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%"   stopColor="#f59e0b" />
          <stop offset="55%"  stopColor="#fb7185" />
          <stop offset="100%" stopColor="#e11d48" />
        </linearGradient>

        {/* Clip path follows the heart outline so the bars stay inside */}
        <clipPath id={clipId}>
          <path d="M50,80 C50,80 10,54 10,30 C10,16 21,7 35,7 C42,7 48,11 50,18 C52,11 58,7 65,7 C79,7 90,16 90,30 C90,54 50,80 50,80Z" />
        </clipPath>
      </defs>

      {/* ─── Heart outline ─── */}
      <path
        d="M50,80 C50,80 10,54 10,30 C10,16 21,7 35,7 C42,7 48,11 50,18 C52,11 58,7 65,7 C79,7 90,16 90,30 C90,54 50,80 50,80Z"
        fill="none"
        stroke={`url(#${gradId})`}
        strokeWidth="5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />

      {/* ─── Waveform bars (clipped to heart interior) ─── */}
      <g clipPath={`url(#${clipId})`}>
        <rect x="16" y="56" width="5" height="13" rx="2.5" fill={`url(#${gradId})`} />
        <rect x="23" y="46" width="5" height="23" rx="2.5" fill={`url(#${gradId})`} />
        <rect x="30" y="40" width="5" height="29" rx="2.5" fill={`url(#${gradId})`} />
        <rect x="37" y="50" width="5" height="19" rx="2.5" fill={`url(#${gradId})`} />
      </g>

      {/* ─── Music note (right side) ─── */}
      {/* Note head */}
      <ellipse
        cx="67" cy="67"
        rx="7.5" ry="5.5"
        fill={`url(#${gradId})`}
        transform="rotate(-18 67 67)"
      />
      {/* Stem */}
      <line
        x1="73.5" y1="63"
        x2="73.5" y2="33"
        stroke={`url(#${gradId})`}
        strokeWidth="4.5"
        strokeLinecap="round"
      />
      {/* Flag / curl */}
      <path
        d="M73.5,33 C86,40 86,55 73.5,58"
        fill="none"
        stroke={`url(#${gradId})`}
        strokeWidth="4"
        strokeLinecap="round"
      />
    </svg>
  );
}
