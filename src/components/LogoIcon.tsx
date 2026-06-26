interface LogoIconProps {
  size?: number;
  className?: string;
  showBg?: boolean;
}

export default function LogoIcon({ size = 40, className = '', showBg = true }: LogoIconProps) {
  return (
    <span
      className={`inline-flex items-center justify-center overflow-hidden ${showBg ? 'bg-stone-950' : ''} ${className}`}
      style={{
        width: size,
        height: size,
        borderRadius: Math.max(10, Math.round(size * 0.24)),
      }}
      aria-label="SeuBeat logo"
      role="img"
    >
      <img
        src="/assets/seubeat-logo-icon.png"
        alt=""
        className="h-full w-full object-contain"
        draggable={false}
      />
    </span>
  );
}
