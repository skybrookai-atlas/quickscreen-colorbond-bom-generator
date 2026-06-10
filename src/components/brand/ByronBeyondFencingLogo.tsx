interface ByronBeyondFencingLogoProps {
  className?: string;
  iconClassName?: string;
  textClassName?: string;
}

export function ByronBeyondFencingLogo({
  className = "",
  iconClassName = "",
  textClassName = "",
}: ByronBeyondFencingLogoProps) {
  return (
    <div className={`inline-flex items-center gap-3 text-[#1b4332] ${className}`}>
      {/* Sleek Coastal Fencing SVG Icon */}
      <svg
        viewBox="0 0 120 120"
        aria-hidden="true"
        className={`h-12 w-12 shrink-0 text-[#1b4332] ${iconClassName}`}
        fill="none"
        stroke="currentColor"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {/* Horizontal slats with gaps */}
        <line x1="20" y1="30" x2="100" y2="30" strokeWidth="6" />
        <line x1="20" y1="50" x2="100" y2="50" strokeWidth="6" />
        <line x1="20" y1="70" x2="100" y2="70" strokeWidth="6" />
        <line x1="20" y1="90" x2="100" y2="90" strokeWidth="6" />
        
        {/* Vertical posts */}
        <line x1="25" y1="15" x2="25" y2="105" strokeWidth="8" />
        <line x1="95" y1="15" x2="95" y2="105" strokeWidth="8" />
        
        {/* Wave / Coastal curve overlay */}
        <path
          d="M 10 95 C 40 85, 80 105, 110 95"
          fill="none"
          stroke="#c5a059" /* Premium gold accent */
          strokeWidth="3"
        />
      </svg>
      <div className={`leading-none font-sans ${textClassName}`}>
        <span className="block text-[10px] font-extrabold uppercase tracking-[0.25em] text-[#c5a059] mb-1">
          Byron & Beyond
        </span>
        <span className="block font-black text-xl tracking-[0.05em] text-white uppercase">
          Fencing
        </span>
      </div>
    </div>
  );
}
