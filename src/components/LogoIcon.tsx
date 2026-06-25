import { useId } from 'react';

interface LogoIconProps {
  size?: number;
  className?: string;
  showBg?: boolean;
}

/**
 * SeuBeat logo icon — app-style rounded square with:
 *  •  Heart + music note + equalizer fused
 *  •  Amber → coral → rose neon gradient (site palette)
 *  •  Dark rounded-square background
 */
export default function LogoIcon({ size = 40, className = '', showBg = true }: LogoIconProps) {
  const uid = useId().replace(/:/g, '');
  const gMain = `sbgm-${uid}`;
  const clip  = `sbc-${uid}`;

  const heartPath =
    'M77,60 C77,60 88,44 88,28 C88,14 78,7 66,7 C59,7 53,12 50,17 C47,12 41,7 34,7 C22,7 12,14 12,28 C12,44 23,60 23,60 C23,60 47,88 50,88 C53,88 77,60 77,60Z';

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="SeuBeat logo"
      role="img"
    >
      <defs>
        {/* Neon gradient: amber → coral → rose */}
        <linearGradient id={gMain} x1="20%" y1="0%" x2="80%" y2="100%">
          <stop offset="0%"   stopColor="#f59e0b" />
          <stop offset="40%"  stopColor="#fb923c" />
          <stop offset="100%" stopColor="#e11d48" />
        </linearGradient>
      </defs>

      {/* ── App-style rounded square background ── */}
      {showBg && (
        <rect x="2" y="2" width="96" height="96" rx="20" ry="20" fill="#0c0a09" />
      )}

      {/* ── Heart outline (neon) ── */}
      <path
        d={heartPath}
        fill="none"
        stroke={`url(#${gMain})`}
        strokeWidth="6"
        strokeLinejoin="round"
        strokeLinecap="round"
      />

      {/* ── Equalizer bars (5 bars) inside left half of heart ── */}
      <g>
        <rect x="17" y="68" width="4.5" height="7"   rx="2.25" fill={`url(#${gMain})`} opacity="1" />
        <rect x="24" y="60" width="4.5" height="15"  rx="2.25" fill={`url(#${gMain})`} opacity="1" />
        <rect x="31" y="50" width="4.5" height="25"  rx="2.25" fill={`url(#${gMain})`} opacity="1" />
        <rect x="38" y="54" width="4.5" height="21"  rx="2.25" fill={`url(#${gMain})`} opacity="0.85" />
        <rect x="45" y="60" width="4.5" height="15"  rx="2.25" fill={`url(#${gMain})`} opacity="0.7" />
      </g>

      {/* ── Music note integrated into right side of heart ── */}
      {/* Notehead */}
      <ellipse
        cx="64" cy="72"
        rx="8"  ry="6"
        fill={`url(#${gMain})`}
        transform="rotate(-15 64 72)"
      />
      {/* Stem */}
      <line
        x1="71" y1="67"
        x2="71" y2="26"
        stroke={`url(#${gMain})`}
        strokeWidth="5"
        strokeLinecap="round"
      />
      {/* Flag */}
      <path
        d="M71,26 C84,32 86,48 72,54"
        fill="none"
        stroke={`url(#${gMain})`}
        strokeWidth="5"
        strokeLinecap="round"
      />
    </svg>
  );
}
