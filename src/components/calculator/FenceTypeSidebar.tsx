

interface FenceTypeSidebarProps {
  activeType?: string;
  onSelectType?: (type: string) => void;
}

export function FenceTypeSidebar({ activeType = "timber-paling", onSelectType }: FenceTypeSidebarProps) {
  const availableTypes = [
    {
      id: "timber-paling",
      title: "Timber Paling",
      subtitle: "CCA pine · Hardwood",
      thumbnail: (
        <svg viewBox="0 0 40 40" className="w-full h-full">
          <rect x="6" y="6" width="3" height="28" fill="#8E6E3F" />
          <rect x="13" y="6" width="3" height="28" fill="#9D7E4F" />
          <rect x="20" y="6" width="3" height="28" fill="#8E6E3F" />
          <rect x="27" y="6" width="3" height="28" fill="#9D7E4F" />
          <rect x="0" y="12" width="40" height="2" fill="#6B5230" />
          <rect x="0" y="26" width="40" height="2" fill="#6B5230" />
        </svg>
      ),
    },
    {
      id: "retaining-wall",
      title: "Retaining Wall",
      subtitle: "SuperPost · TUFFPOLY",
      thumbnail: (
        <svg viewBox="0 0 40 40" className="w-full h-full">
          <rect x="2" y="32" width="36" height="6" fill="#8C7D70" />
          <rect x="2" y="25" width="36" height="6" fill="#A39382" />
          <rect x="2" y="18" width="36" height="6" fill="#8C7D70" />
          <rect x="2" y="11" width="36" height="6" fill="#A39382" />
          <rect x="8" y="8" width="4" height="30" fill="#5A524A" />
          <rect x="28" y="8" width="4" height="30" fill="#5A524A" />
        </svg>
      ),
    },
  ];

  const comingSoonTypes = [
    {
      id: "colorbond",
      title: "Colorbond",
      thumbnail: (
        <svg viewBox="0 0 40 40" className="w-full h-full">
          <rect x="4" y="8" width="32" height="24" fill="#6F7E8A" />
        </svg>
      ),
    },
    {
      id: "aluminium-slat",
      title: "Aluminium slat",
      thumbnail: (
        <svg viewBox="0 0 40 40" className="w-full h-full">
          <rect x="6" y="9" width="28" height="3" fill="#4A4A48" />
          <rect x="6" y="15" width="28" height="3" fill="#4A4A48" />
          <rect x="6" y="21" width="28" height="3" fill="#4A4A48" />
        </svg>
      ),
    },
    {
      id: "pool-glass",
      title: "Pool glass",
      thumbnail: (
        <svg viewBox="0 0 40 40" className="w-full h-full" opacity="0.6">
          <rect x="6" y="8" width="28" height="24" fill="#B5D8E2" />
        </svg>
      ),
    },
    {
      id: "picket",
      title: "Picket",
      thumbnail: (
        <svg viewBox="0 0 40 40" className="w-full h-full">
          <polygon points="6,32 10,12 13,32" fill="#C8B68A" />
          <polygon points="14,32 18,12 21,32" fill="#A89668" />
          <polygon points="22,32 26,12 29,32" fill="#C8B68A" />
        </svg>
      ),
    },
  ];

  return (
    <aside className="af-sidebar w-64 bg-brand-card border-r border-brand-border/60 flex flex-col shrink-0 text-brand-text h-full">
      <div className="p-4 border-b border-brand-border/60">
        <div className="text-[10px] font-black uppercase tracking-[0.14em] text-brand-muted mb-1">
          Step 3 of 4
        </div>
        <div className="text-sm font-bold text-brand-text">
          Draw your fence
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-4 [scrollbar-width:thin]">
        <div>
          <div className="text-[10px] font-black uppercase tracking-[0.12em] text-brand-muted px-2 py-1.5">
            Available now
          </div>
          <div className="space-y-1">
            {availableTypes.map((type) => {
              const active = type.id === activeType;
              return (
                <button
                  key={type.id}
                  type="button"
                  onClick={() => onSelectType?.(type.id)}
                  className={`w-full flex items-center gap-3 p-2 rounded-lg text-left transition-colors ${
                    active
                      ? "bg-brand-primary/20 border border-brand-primary/30 text-brand-primary"
                      : "border border-transparent hover:bg-brand-border/20 text-brand-text"
                  }`}
                >
                  <div className="w-9 h-9 bg-brand-bg border border-brand-border rounded flex items-center justify-center p-1 shrink-0 overflow-hidden">
                    {type.thumbnail}
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-bold truncate">{type.title}</div>
                    {type.subtitle && (
                      <div className="text-[10px] text-brand-muted truncate mt-0.5">
                        {type.subtitle}
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <div className="text-[10px] font-black uppercase tracking-[0.12em] text-brand-muted px-2 py-1.5">
            Coming soon
          </div>
          <div className="space-y-1">
            {comingSoonTypes.map((type) => (
              <div
                key={type.id}
                className="w-full flex items-center gap-3 p-2 rounded-lg border border-transparent opacity-45 cursor-not-allowed select-none"
              >
                <div className="w-9 h-9 bg-brand-bg border border-brand-border rounded flex items-center justify-center p-1 shrink-0 overflow-hidden">
                  {type.thumbnail}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-bold truncate text-brand-muted">
                    {type.title}
                  </div>
                </div>
                <span className="shrink-0 text-[8px] font-black uppercase tracking-wider bg-brand-border/60 text-brand-muted px-1.5 py-0.5 rounded">
                  SOON
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </aside>
  );
}
