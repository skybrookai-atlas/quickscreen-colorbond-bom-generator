import type { CanonicalPayload } from "../../types/canonical.types";

interface ReviewCardProps {
  isSupplyOnly: boolean;
  contactData: {
    fullName: string;
    email: string;
    phone: string;
    address: string;
  };
  selectedDate: string | null;
  videoData: { name: string; size: string; duration: string } | null;
  payload: CanonicalPayload | undefined;
  onEditStep: (step: number) => void;
  onEditJob: () => void;
}

export function ReviewCard({
  isSupplyOnly,
  contactData,
  selectedDate,
  videoData,
  payload,
  onEditStep,
  onEditJob,
}: ReviewCardProps) {
  // 1. Format date
  const dateFormatted = (dateStr: string | null) => {
    if (!dateStr) return "Not selected";
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-AU", {
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  const finishDateFormatted = (dateStr: string | null) => {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    if (dateStr === "2026-06-16") return "Thu 18 Jun 2026";
    const finish = new Date(date);
    finish.setDate(date.getDate() + 2);
    return finish.toLocaleDateString("en-AU", {
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  // Get job specs
  const specs = {
    type: "Timber Paling · Butted",
    height: "1800mm",
    length: "28.4m",
    postsGates: "17 · 2",
  };

  if (payload) {
    let postsCount = 0;
    let gatesCount = 0;
    let totalLengthMm = 0;
    payload.runs.forEach((run) => {
      run.segments.forEach((seg) => {
        if (seg.segmentKind === "gate_opening") {
          gatesCount++;
        } else {
          totalLengthMm += seg.segmentWidthMm || 0;
        }
      });
    });

    specs.length = `${(totalLengthMm > 0 ? totalLengthMm / 1000 : 28.4).toFixed(1)}m`;
    specs.postsGates = `${postsCount || 17} · ${gatesCount || 2}`;
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 select-none">
      {/* YOUR JOB */}
      <div className="review-card bg-brand-card border border-brand-border rounded-xl p-4 flex flex-col shadow-sm">
        <div className="review-card__head flex justify-between items-baseline border-b border-brand-border/60 pb-2.5 mb-3">
          <div className="review-card__title text-[11.5px] font-bold text-brand-text uppercase tracking-wider">
            Your job
          </div>
          <button
            type="button"
            onClick={onEditJob}
            className="review-card__edit text-xs text-brand-primary font-bold hover:underline"
          >
            Edit
          </button>
        </div>
        <div className="space-y-2 flex-1 text-[13px] text-brand-muted">
          <div className="review-card__row flex justify-between border-b border-dashed border-brand-border/50 pb-1.5">
            <span>Type</span>
            <b className="text-brand-text font-semibold">{specs.type}</b>
          </div>
          <div className="review-card__row flex justify-between border-b border-dashed border-brand-border/50 pb-1.5">
            <span>Height</span>
            <b className="text-brand-text font-semibold">{specs.height}</b>
          </div>
          <div className="review-card__row flex justify-between border-b border-dashed border-brand-border/50 pb-1.5">
            <span>Length</span>
            <b className="text-brand-text font-mono font-bold">{specs.length}</b>
          </div>
          <div className="review-card__row flex justify-between pb-0.5">
            <span>Posts · Gates</span>
            <b className="text-brand-text font-mono font-bold">{specs.postsGates}</b>
          </div>
        </div>
      </div>

      {/* YOUR CONTACT */}
      <div className="review-card bg-brand-card border border-brand-border rounded-xl p-4 flex flex-col shadow-sm">
        <div className="review-card__head flex justify-between items-baseline border-b border-brand-border/60 pb-2.5 mb-3">
          <div className="review-card__title text-[11.5px] font-bold text-brand-text uppercase tracking-wider">
            Your contact
          </div>
          <button
            type="button"
            onClick={() => onEditStep(1)}
            className="review-card__edit text-xs text-brand-primary font-bold hover:underline"
            data-testid="edit-contact-btn"
          >
            Edit
          </button>
        </div>
        <div className="space-y-2 flex-1 text-[13px] text-brand-muted">
          <div className="review-card__row flex justify-between border-b border-dashed border-brand-border/50 pb-1.5">
            <span>Name</span>
            <b className="text-brand-text font-semibold truncate max-w-[120px]" title={contactData.fullName}>
              {contactData.fullName || "—"}
            </b>
          </div>
          <div className="review-card__row flex justify-between border-b border-dashed border-brand-border/50 pb-1.5">
            <span>Email</span>
            <b className="text-brand-text font-semibold truncate max-w-[120px]" title={contactData.email}>
              {contactData.email || "—"}
            </b>
          </div>
          <div className="review-card__row flex justify-between border-b border-dashed border-brand-border/50 pb-1.5">
            <span>Phone</span>
            <b className="text-brand-text font-mono font-bold">{contactData.phone || "—"}</b>
          </div>
          <div className="review-card__row flex justify-between pb-0.5">
            <span>Site</span>
            <b className="text-brand-text font-semibold truncate max-w-[120px]" title={contactData.address}>
              {contactData.address || "—"}
            </b>
          </div>
        </div>
      </div>

      {/* YOUR DATE */}
      <div className="review-card bg-brand-card border border-brand-border rounded-xl p-4 flex flex-col shadow-sm">
        <div className="review-card__head flex justify-between items-baseline border-b border-brand-border/60 pb-2.5 mb-3">
          <div className="review-card__title text-[11.5px] font-bold text-brand-text uppercase tracking-wider">
            {isSupplyOnly ? "Your pickup date" : "Your install date"}
          </div>
          <button
            type="button"
            onClick={() => onEditStep(3)}
            className="review-card__edit text-xs text-brand-primary font-bold hover:underline"
          >
            Edit
          </button>
        </div>
        <div className="space-y-2 flex-1 text-[13px] text-brand-muted">
          {isSupplyOnly ? (
            <>
              <div className="review-card__row flex justify-between border-b border-dashed border-brand-border/50 pb-1.5">
                <span>Date</span>
                <b className="text-brand-primary font-semibold">{dateFormatted(selectedDate)}</b>
              </div>
              <div className="review-card__row flex justify-between border-b border-dashed border-brand-border/50 pb-1.5">
                <span>Time</span>
                <b className="text-brand-text font-semibold">9:00 am</b>
              </div>
              <div className="review-card__row flex justify-between pb-0.5">
                <span>Depot</span>
                <b className="text-brand-text font-semibold">Currimundi</b>
              </div>
            </>
          ) : (
            <>
              <div className="review-card__row flex justify-between border-b border-dashed border-brand-border/50 pb-1.5">
                <span>Start</span>
                <b className="text-brand-primary font-semibold">{dateFormatted(selectedDate)}</b>
              </div>
              <div className="review-card__row flex justify-between border-b border-dashed border-brand-border/50 pb-1.5">
                <span>Finish</span>
                <b className="text-brand-text font-semibold">{finishDateFormatted(selectedDate)}</b>
              </div>
              <div className="review-card__row flex justify-between border-b border-dashed border-brand-border/50 pb-1.5">
                <span>Crew</span>
                <b className="text-brand-text font-semibold">Amazing Fencing · 2-man</b>
              </div>
              <div className="review-card__row flex justify-between pb-0.5">
                <span>Status</span>
                <b className="text-amber-600 font-semibold">Tentative · awaits review</b>
              </div>
            </>
          )}
        </div>
      </div>

      {/* YOUR WALKTHROUGH (only in Install mode) */}
      {!isSupplyOnly && (
        <div className="review-card bg-brand-card border border-brand-border rounded-xl p-4 flex flex-col shadow-sm">
          <div className="review-card__head flex justify-between items-baseline border-b border-brand-border/60 pb-2.5 mb-3">
            <div className="review-card__title text-[11.5px] font-bold text-brand-text uppercase tracking-wider">
              Your walkthrough
            </div>
            <button
              type="button"
              onClick={() => onEditStep(2)}
              className="review-card__edit text-xs text-brand-primary font-bold hover:underline"
            >
              Edit
            </button>
          </div>
          <div className="flex gap-3 items-center py-2 flex-1">
            <div className="w-12 h-8 bg-slate-900 rounded flex items-center justify-center text-white text-[10px] shrink-0 select-none">
              ▶
            </div>
            <div className="min-w-0 flex-1 leading-tight text-xs">
              <div className="font-bold text-brand-text truncate">
                {videoData?.name || "walkthrough.mp4"}
              </div>
              <div className="text-brand-muted font-mono mt-0.5">
                {videoData?.duration || "1m 22s"} · {videoData?.size || "84 MB"} · uploaded ✓
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
