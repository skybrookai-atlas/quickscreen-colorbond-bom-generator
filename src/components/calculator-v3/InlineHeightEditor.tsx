import { useEffect, useMemo, useState } from "react";
import { heightEntriesForSystem } from "../../lib/productOptionRules";
import {
  derivedHeightForSlatCount,
  nearestDerivedHeight,
  type DerivedHeight,
} from "../../lib/heights";

type Variables = Record<string, string | number | boolean>;

interface InlineHeightEditorProps {
  productCode: string;
  variables: Variables;
  valueMm: number;
  ariaLabel: string;
  onChange: (heightMm: number, entry?: DerivedHeight) => void;
}

function clampHeight(value: number) {
  if (!Number.isFinite(value)) return 1800;
  return Math.max(300, Math.min(2400, Math.round(value)));
}

export function InlineHeightEditor({
  productCode,
  variables,
  valueMm,
  ariaLabel,
  onChange,
}: InlineHeightEditorProps) {
  const [draft, setDraft] = useState(String(clampHeight(valueMm)));
  const heightEntries = useMemo(
    () => heightEntriesForSystem(productCode, variables),
    [productCode, variables],
  );
  const selectedEntry =
    derivedHeightForSlatCount(heightEntries, variables.slat_count) ??
    nearestDerivedHeight(heightEntries, valueMm);
  const selectedHeight = selectedEntry?.height ?? clampHeight(valueMm);

  useEffect(() => {
    setDraft(String(clampHeight(valueMm)));
  }, [valueMm]);

  function commitDraft(value = draft) {
    const next = clampHeight(Number(value));
    setDraft(String(next));
    if (next !== clampHeight(valueMm)) onChange(next);
  }

  const sharedClasses =
    "inline-flex h-8 max-w-full rounded-lg border border-brand-border bg-brand-card px-2 af-sidebar-mono font-bold text-brand-text shadow-sm outline-none transition-colors focus:border-brand-accent focus:ring-2 focus:ring-brand-accent/20";

  if (productCode === "VS") {
    return (
      <span
        className="inline-flex items-center gap-1"
        onClick={(event) => event.stopPropagation()}
        onDoubleClick={(event) => event.stopPropagation()}
      >
        <input
          type="number"
          aria-label={ariaLabel}
          inputMode="numeric"
          min={300}
          max={2400}
          step={50}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={() => commitDraft()}
          onKeyDown={(event) => {
            if (event.key === "Enter") event.currentTarget.blur();
          }}
          className={`${sharedClasses} w-24 tabular-nums`}
        />
        <span className="text-xs font-bold text-brand-muted">mm</span>
      </span>
    );
  }

  if (heightEntries.length === 0) {
    return (
      <select
        aria-label={ariaLabel}
        disabled
        className={`${sharedClasses} w-40 text-brand-muted`}
        onClick={(event) => event.stopPropagation()}
        onDoubleClick={(event) => event.stopPropagation()}
      >
        <option>Set slat and gap first</option>
      </select>
    );
  }

  return (
    <select
      aria-label={ariaLabel}
      value={selectedHeight}
      onClick={(event) => event.stopPropagation()}
      onDoubleClick={(event) => event.stopPropagation()}
      onChange={(event) => {
        const entry = heightEntries.find(
          (item) => item.height === Number(event.target.value),
        );
        if (entry) onChange(entry.height, entry);
      }}
      className={`${sharedClasses} w-44`}
    >
      {heightEntries.map((entry) => (
        <option key={entry.N} value={entry.height}>
          {productCode.startsWith("AF_") ? `${entry.height}mm` : `${entry.height}mm - ${entry.N} slats`}
        </option>
      ))}
    </select>
  );
}
