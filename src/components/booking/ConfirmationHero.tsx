import { useMemo } from "react";
import { Check } from "lucide-react";

interface ConfirmationHeroProps {
  isSupplyOnly: boolean;
  selectedDate: string | null;
  emailAddress: string;
}

export function ConfirmationHero({ isSupplyOnly, selectedDate, emailAddress }: ConfirmationHeroProps) {
  // Mock reference number
  const referenceCode = "Q-4F9A2C";

  const formattedDate = useMemo(() => {
    if (!selectedDate) return "Tuesday 16 June 2026";
    const date = new Date(selectedDate);
    return date.toLocaleDateString("en-AU", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  }, [selectedDate]);

  // Dynamic next steps based on mode
  const nextSteps = useMemo(() => {
    if (isSupplyOnly) {
      return [
        {
          num: 1,
          title: "Confirmation email + receipt — right now",
          sub: `Sent to ${emailAddress || "your email"}. Includes a PDF invoice, your reference number, and depot pickup details.`,
        },
        {
          num: 2,
          title: "Day of pickup — morning of",
          sub: "7am text with depot loading bay directions and your pickup slot reminder. Bring a Ute or trailer — posts are 2.4m.",
        },
      ];
    } else {
      return [
        {
          num: 1,
          title: "Confirmation email + receipt — right now",
          sub: `Sent to ${emailAddress || "your email"}. Includes a PDF quote, your reference number, and a link back to this page.`,
        },
        {
          num: 2,
          title: "Amazing Fencing reviews your video — within 4 working hours",
          sub: "If anything's tricky we'll call you. Otherwise the install slot locks and you'll get a 'you're confirmed' email.",
        },
        {
          num: 3,
          title: "Two days before",
          sub: "Your installer calls to confirm access, materials drop-off spot, and any last-minute questions about gates or neighbour-fences.",
        },
        {
          num: 4,
          title: "Day of install",
          sub: "7am text with the team's ETA + a phone number for the job. They'll text again 30 min before arrival.",
        },
      ];
    }
  }, [isSupplyOnly, emailAddress]);

  const refundTerms = isSupplyOnly
    ? "Refunds available up to 24h before pickup."
    : "Refunds available up to 48h before install.";

  return (
    <div className="w-full select-none">
      <div className="confirm-hero text-center py-8 px-4">
        <div className="confirm-hero__icon w-[72px] h-[72px] bg-brand-success text-white rounded-full flex items-center justify-center text-4xl mx-auto mb-5 shadow-lg shadow-brand-success/20">
          <Check size={38} strokeWidth={3} />
        </div>
        <h1 className="confirm-hero__title text-3xl sm:text-4xl font-extrabold text-brand-text mb-2 tracking-tight">
          Booked!
        </h1>
        <p className="confirm-hero__sub text-sm sm:text-base text-brand-muted max-w-[480px] mx-auto leading-relaxed">
          Your timber paling fence is locked in for <b className="text-brand-text">{formattedDate}</b>. Reference:{" "}
          <b className="font-mono text-brand-text">{referenceCode}</b>.
        </p>
      </div>

      <div className="max-w-[620px] mx-auto px-4">
        <div className="next-steps bg-brand-soft border border-brand-border rounded-xl p-5 mb-5 shadow-sm">
          <div className="next-steps__title text-[11px] tracking-wider uppercase font-bold text-brand-muted mb-4">
            What happens next
          </div>
          <div className="space-y-4">
            {nextSteps.map((step) => (
              <div key={step.num} className="next-step flex gap-3.5 items-start">
                <div className="next-step__num w-[26px] h-[26px] bg-brand-card text-brand-primary border-2 border-brand-primary rounded-full flex items-center justify-center font-mono text-[12px] font-bold shrink-0 mt-0.5">
                  {step.num}
                </div>
                <div className="next-step__body min-w-0 flex-1 leading-normal">
                  <div className="next-step__title text-[13.5px] font-bold text-brand-text">
                    {step.title}
                  </div>
                  <div className="next-step__sub text-[12px] text-brand-muted mt-0.5">
                    {step.sub}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Action CTAs */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <button
            type="button"
            className="cta-btn cta-btn--full bg-brand-primary hover:bg-brand-primary-hover text-white font-bold text-xs py-2.5 px-4 rounded transition flex-1 text-center justify-center"
          >
            View your booking
          </button>
          <button
            type="button"
            className="cta-btn cta-btn--secondary cta-btn--full bg-brand-card border border-brand-border hover:bg-brand-soft text-brand-text font-bold text-xs py-2.5 px-4 rounded transition flex-1 text-center justify-center"
          >
            📅 Add to calendar
          </button>
          <button
            type="button"
            className="cta-btn cta-btn--secondary cta-btn--full bg-brand-card border border-brand-border hover:bg-brand-soft text-brand-text font-bold text-xs py-2.5 px-4 rounded transition flex-1 text-center justify-center"
          >
            📧 Email a copy
          </button>
        </div>

        {/* Footer info text */}
        <div className="text-center py-4 text-[12px] text-brand-muted leading-relaxed border-t border-brand-border">
          Need to change something? Call Amazing Fencing on{" "}
          <b className="text-brand-text font-mono">1800 739 359</b> or reply to your confirmation email.{" "}
          {refundTerms}
        </div>
      </div>
    </div>
  );
}
