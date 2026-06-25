import { useId } from 'react';

interface LogoIconProps {
  size?: number;
  className?: string;
}

/**
 * SeuBeat logo icon — replicates the reference design:
 *  • Thin heart outline
 *  • 4 equalizer bars (lower-left inside heart)
 *  • Large quarter-note with flag (right side inside heart)
 * Gradient: amber → coral → rose  (matches site palette)
 */
export default function LogoIcon({ size = 40, className = '' }: LogoIconProps) {
  const uid = useId().replace(/:/g, '');
  const gMain  = `sbgm-${uid}`;   // main gradient
  const gVert  = `sbgv-${uid}`;   // vertical gradient for bars
  const clip   = `sbc-${uid}`;

  // Heart path shared between outline and clip
  const heartPath =
    'M50,84 C50,84 7,57 7,32 C7,17 18,7 32,7 C40,7 47,12 50,20 C53,12 60,7 68,7 C82,7 93,17 93,32 C93,57 50,84 50,84Z';

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 92"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="SeuBeat logo"
      role="img"
    >
      <defs>
        {/* Diagonal amber → coral → rose gradient (matches CTA buttons) */}
        <linearGradient id={gMain} x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%"   stopColor="#f59e0b" />
          <stop offset="45%"  stopColor="#fb923c" />
          <stop offset="100%" stopColor="#e11d48" />
        </linearGradient>

        {/* Vertical gradient for the waveform bars */}
        <linearGradient id={gVert} x1="0%" y1="100%" x2="0%" y2="0%">
          <stop offset="0%"   stopColor="#f59e0b" />
          <stop offset="100%" stopColor="#fb923c" />
        </linearGradient>

        {/* Clip to keep waveform bars inside the heart */}
        <clipPath id={clip}>
          <path d={heartPath} />
        </clipPath>
      </defs>

      {/* ── Heart outline ── */}
      <path
        d={heartPath}
        fill="none"
        stroke={`url(#${gMain})`}
        strokeWidth="6"
        strokeLinejoin="round"
        strokeLinecap="round"
      />

      {/* ── Equalizer / waveform bars — lower-left inside heart ── */}
      <g clipPath={`url(#${clip})`}>
        {/* bar 1 – shortest */}
        <rect x="14"  y="61" width="5.5" height="9"  rx="2.75" fill={`url(#${gVert})`} />
        {/* bar 2 – medium */}
        <rect x="21"  y="52" width="5.5" height="18" rx="2.75" fill={`url(#${gVert})`} />
        {/* bar 3 – tallest */}
        <rect x="28"  y="45" width="5.5" height="25" rx="2.75" fill={`url(#${gVert})`} />
        {/* bar 4 – medium-short */}
        <rect x="35"  y="56" width="5.5" height="14" rx="2.75" fill={`url(#${gVert})`} />
      </g>

      {/* ── Music note — right side ── */}
      {/* Notehead: large filled ellipse, slightly tilted */}
      <ellipse
        cx="65" cy="69"
        rx="9"  ry="6.5"
        fill={`url(#${gMain})`}
        transform="rotate(-20 65 69)"
      />
      {/* Stem: vertical from right of notehead up to top-right of heart */}
      <line
        x1="73"  y1="64"
        x2="73"  y2="29"
        stroke={`url(#${gMain})`}
        strokeWidth="5.5"
        strokeLinecap="round"
      />
      {/* Flag: elegant curve to the right from stem top */}
      <path
        d="M73,29 C87,36 88,54 73,59"
        fill="none"
        stroke={`url(#${gMain})`}
        strokeWidth="5"
        strokeLinecap="round"
      />
    </svg>
  );
}
