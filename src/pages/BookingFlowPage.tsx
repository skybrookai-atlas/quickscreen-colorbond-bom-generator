import { useState, useEffect, useMemo } from "react";
import { useParams, useLocation, useNavigate } from "react-router-dom";
import { useQuoteForBooking } from "../hooks/useQuoteForBooking";
import { ProgressSteps } from "../components/booking/ProgressSteps";
import { QuoteSummary } from "../components/booking/QuoteSummary";
import { VideoUploader } from "../components/booking/VideoUploader";
import { Calendar } from "../components/booking/Calendar";
import { ReviewCard } from "../components/booking/ReviewCard";
import { DepositBanner } from "../components/booking/DepositBanner";
import { PaymentForm } from "../components/booking/PaymentForm";
import { ConfirmationHero } from "../components/booking/ConfirmationHero";
import { Loader2 } from "lucide-react";

export function BookingFlowPage() {
  const { quoteId } = useParams<{ quoteId: string }>();
  const location = useLocation();
  const navigate = useNavigate();

  // Determine supply-only vs install mode from query params
  const queryParams = new URLSearchParams(location.search);
  const isSupplyOnly = queryParams.get("mode") === "supply-only";

  // Load quote using the custom hook
  const { quote: loadedQuote, payload: loadedPayload, isLoading } = useQuoteForBooking(quoteId);

  // Step state: 1 to 5
  const [step, setStep] = useState(1);

  // Contact form state
  const [contactData, setContactData] = useState({
    fullName: "",
    email: "",
    phone: "",
    address: "42 Greenway Drive, Currimundi QLD 4551",
    bestTimeToCall: "Any time during business hours",
  });

  // Step 1 errors
  const [contactErrors, setContactErrors] = useState<Record<string, string>>({});

  // Step 2 Walkthrough video state
  const [videoData, setVideoData] = useState<{ name: string; size: string; duration: string } | null>(null);

  // Step 3 Selected date state
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  // Sync address from payload once loaded
  useEffect(() => {
    if (loadedPayload?.propertyAnchor?.address) {
      setContactData((prev) => ({
        ...prev,
        address: loadedPayload.propertyAnchor!.address,
      }));
    }
  }, [loadedPayload]);

  // Fallback quote for E2E tests and stubs
  const quote = useMemo(() => {
    if (loadedQuote) return loadedQuote;

    // Return mockup matching the wireframe totals exactly
    const mockTotal = isSupplyOnly ? 2606.0 : 4608.0;
    const mockGst = Number((mockTotal / 11).toFixed(2));
    const mockSubtotal = mockTotal - mockGst;

    return {
      id: quoteId || "q_4f9a2c",
      org_id: "glass-outlet",
      user_id: "test",
      quote_number: 1001,
      customer_ref: "Untitled Job",
      bom: {
        fenceItems: isSupplyOnly
          ? [
              { sku: "TP_POST_2400", name: "Treated Pine Post", category: "post" as const, description: "100x75 Treated Pine Post H4 2400mm", quantity: 17, unit: "each" as const, unitPrice: 39.0, lineTotal: 663.0 },
              { sku: "TP_RAIL_4800", name: "Treated Pine Rail", category: "rail" as const, description: "75x38 Treated Pine Rail 4800mm", quantity: 9, unit: "each" as const, unitPrice: 22.0, lineTotal: 198.0 },
              { sku: "TP_PALING_1800", name: "Treated Pine Paling", category: "slat" as const, description: "150x16 Treated Pine Paling 1800mm", quantity: 211, unit: "each" as const, unitPrice: 2.01, lineTotal: 424.0 },
              { sku: "TP_GATE_900", name: "Gate kit", category: "gate" as const, description: "Gate kit · 900mm pedestrian", quantity: 2, unit: "each" as const, unitPrice: 235.0, lineTotal: 470.0 },
            ]
          : [
              { sku: "TP_POST_2400", name: "Treated Pine Post", category: "post" as const, description: "100x75 Treated Pine Post H4 2400mm", quantity: 17, unit: "each" as const, unitPrice: 39.0, lineTotal: 663.0 },
              { sku: "TP_RAIL_4800", name: "Treated Pine Rail", category: "rail" as const, description: "75x38 Treated Pine Rail 4800mm", quantity: 9, unit: "each" as const, unitPrice: 22.0, lineTotal: 198.0 },
              { sku: "TP_PALING_1800", name: "Treated Pine Paling", category: "slat" as const, description: "150x16 Treated Pine Paling 1800mm", quantity: 211, unit: "each" as const, unitPrice: 2.01, lineTotal: 424.0 },
            ],
        gateItems: [],
        total: mockSubtotal,
        gst: mockGst,
        grandTotal: mockTotal,
        pricingTier: "tier1" as const,
        generatedAt: new Date().toISOString(),
      },
      contact: {
        fullName: "",
        phone: "",
        email: "",
        fulfilment: isSupplyOnly ? ("pickup" as const) : ("delivery" as const),
      },
      fence_config: { calculator: "v3" as const },
      gates: [],
      notes: "",
      status: "draft" as const,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  }, [loadedQuote, quoteId, isSupplyOnly]);

  const payload = useMemo(() => {
    if (loadedPayload) return loadedPayload;

    return {
      productCode: "AF_TIMBER_PALING",
      schemaVersion: "v1",
      propertyAnchor: {
        lat: -26.7909,
        lng: 153.1232,
        address: contactData.address,
      },
      variables: {},
      runs: [
        {
          runId: "run-1",
          productCode: "AF_TIMBER_PALING",
          segments: [
            {
              segmentId: "seg-1",
              sortOrder: 1,
              segmentKind: "panel" as const,
              segmentWidthMm: 28400,
              targetHeightMm: 1800,
            },
            {
              segmentId: "seg-gate-1",
              sortOrder: 2,
              segmentKind: "gate_opening" as const,
              segmentWidthMm: 900,
              variables: { gate_movement: "single_swing" },
            },
          ],
        },
      ],
    };
  }, [loadedPayload, contactData.address]);

  // Handle contact details submit
  const handleContactSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const errors: Record<string, string> = {};

    if (!contactData.fullName.trim()) {
      errors.fullName = "Full name is required";
    }
    if (!contactData.email.trim()) {
      errors.email = "Email is required";
    } else if (!/\S+@\S+\.\S+/.test(contactData.email)) {
      errors.email = "Invalid email format";
    }
    if (!contactData.phone.trim()) {
      errors.phone = "Phone number is required";
    }

    if (Object.keys(errors).length > 0) {
      setContactErrors(errors);
      return;
    }

    setContactErrors({});
    if (isSupplyOnly) {
      setStep(3); // Skip step 2 (walkthrough video)
    } else {
      setStep(2);
    }
  };

  const handleVideoSelected = (video: typeof videoData) => {
    setVideoData(video);
    setStep(3);
  };

  const handleSkipVideo = () => {
    setVideoData(null);
    setStep(3);
  };

  const handleDateSelect = (dateStr: string) => {
    setSelectedDate(dateStr);
  };

  const handleEditStep = (targetStep: number) => {
    setStep(targetStep);
  };

  const handleEditJob = () => {
    navigate(`/quote/${quoteId || "q_4f9a2c"}`);
  };

  // Pricing calculations
  const totalAmount = quote?.bom?.grandTotal ?? (isSupplyOnly ? 2606.0 : 4608.0);
  const depositAmount = totalAmount * 0.1;
  const balanceText = `$${(totalAmount - depositAmount).toLocaleString("en-AU", { maximumFractionDigits: 0 })}`;

  if (isLoading) {
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-brand-bg text-brand-muted gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-brand-primary" />
        <p className="text-sm">Loading booking details…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-brand-bg flex flex-col font-sans text-brand-text">
      {/* 1. Header chrome */}
      <header className="af-top border-b border-brand-border bg-brand-card px-4 py-3 flex items-center justify-between shrink-0 select-none">
        <div className="af-brand flex items-center gap-3.5">
          <div className="af-logo flex items-center gap-2">
            <div className="af-logo__mark w-7 h-7 bg-brand-primary text-white font-extrabold text-sm flex items-center justify-center rounded-md">
              AF
            </div>
            <div className="af-logo__word text-base font-extrabold tracking-tight">
              Amazing Fencing
            </div>
          </div>
          <span className="h-4 w-px bg-brand-border/60" />
          <div className="af-context text-[11px] text-brand-muted uppercase font-bold tracking-wider">
            Booking {isSupplyOnly && "· Supply only"}
          </div>
          <span className="h-4 w-px bg-brand-border/60" />
          <div className="af-platform-strip text-[10px] text-brand-muted uppercase tracking-wider">
            Powered by <b className="text-brand-text font-black">Anyfence</b>
          </div>
        </div>
        <div className="af-help text-[12.5px] font-semibold text-brand-muted">
          Need help? 1800 739 359
        </div>
      </header>

      {/* 2. Progress steps bar */}
      <ProgressSteps currentStep={step} isSupplyOnly={isSupplyOnly} />

      {/* 3. Main content body */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-[320px_1fr] min-h-0">
        {/* Sticky left-hand quote summary */}
        <QuoteSummary quote={quote} payload={payload} isSupplyOnly={isSupplyOnly} />

        {/* Wizard active step content */}
        <main className="step-area bg-brand-card p-6 sm:p-10 overflow-y-auto">
          <div className="max-w-[640px]">
            {step === 1 && (
              <form onSubmit={handleContactSubmit} noValidate className="space-y-4">
                <div className="step-area__head mb-6">
                  <div className="step-area__step-num text-[11.5px] font-mono tracking-wider text-brand-primary font-bold mb-1.5 uppercase">
                    STEP 1 OF 5
                  </div>
                  <h2 className="step-area__title text-2xl sm:text-3xl font-extrabold text-brand-text mb-2 tracking-tight">
                    Tell us a bit about you
                  </h2>
                  <p className="step-area__lede text-brand-muted text-sm sm:text-base leading-relaxed">
                    We'll send the quote PDF + booking confirmation to your email, and your installer will text on the day with their ETA.
                  </p>
                </div>

                <div className="form-row">
                  <label className="form-row__label block text-xs font-semibold text-brand-text mb-1.5">
                    Site address
                  </label>
                  <input
                    type="text"
                    className="form-row__input w-full bg-brand-soft border border-brand-border rounded-lg p-2.5 text-[13.5px] text-brand-muted cursor-not-allowed"
                    value={contactData.address}
                    readOnly
                  />
                  <div className="form-row__hint text-[11px] text-brand-muted mt-1.5">
                    From the address you entered on the calculator.{" "}
                    <button
                      type="button"
                      onClick={handleEditJob}
                      className="text-brand-primary underline font-semibold"
                    >
                      Change
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="form-row">
                    <label className="form-row__label block text-xs font-semibold text-brand-text mb-1.5">
                      Full name *
                    </label>
                    <input
                      type="text"
                      value={contactData.fullName}
                      onChange={(e) => {
                        setContactErrors((prev) => ({ ...prev, fullName: "" }));
                        setContactData({ ...contactData, fullName: e.target.value });
                      }}
                      placeholder="e.g. Liam Smith"
                      className={`form-row__input w-full bg-brand-card border rounded-lg p-2.5 text-[13.5px] focus:outline-none focus:border-brand-primary ${
                        contactErrors.fullName ? "border-brand-danger" : "border-brand-border"
                      }`}
                      data-testid="full-name-input"
                      required
                    />
                    {contactErrors.fullName && (
                      <div className="text-[11px] text-brand-danger font-semibold mt-1">
                        {contactErrors.fullName}
                      </div>
                    )}
                  </div>
                  <div className="form-row">
                    <label className="form-row__label block text-xs font-semibold text-brand-text mb-1.5">
                      Phone *
                    </label>
                    <div
                      className={`form-row__input flex items-center bg-brand-card border rounded-lg px-3 py-1.5 focus-within:border-brand-primary ${
                        contactErrors.phone ? "border-brand-danger" : "border-brand-border"
                      }`}
                    >
                      <span className="text-[11.5px] text-brand-muted font-mono shrink-0 mr-2">
                        🇦🇺 +61
                      </span>
                      <input
                        type="tel"
                        value={contactData.phone}
                        onChange={(e) => {
                          setContactErrors((prev) => ({ ...prev, phone: "" }));
                          setContactData({ ...contactData, phone: e.target.value });
                        }}
                        placeholder="412 345 678"
                        className="w-full bg-transparent border-0 outline-none text-[13.5px]"
                        data-testid="phone-input"
                        required
                      />
                    </div>
                    {contactErrors.phone && (
                      <div className="text-[11px] text-brand-danger font-semibold mt-1">
                        {contactErrors.phone}
                      </div>
                    )}
                  </div>
                </div>

                <div className="form-row">
                  <label className="form-row__label block text-xs font-semibold text-brand-text mb-1.5">
                    Email *
                  </label>
                  <input
                    type="email"
                    value={contactData.email}
                    onChange={(e) => {
                      setContactErrors((prev) => ({ ...prev, email: "" }));
                      setContactData({ ...contactData, email: e.target.value });
                    }}
                    placeholder="you@example.com"
                    className={`form-row__input w-full bg-brand-card border rounded-lg p-2.5 text-[13.5px] focus:outline-none focus:border-brand-primary ${
                      contactErrors.email ? "border-brand-danger" : "border-brand-border"
                    }`}
                    data-testid="email-input"
                    required
                  />
                  {contactErrors.email ? (
                    <div className="text-[11px] text-brand-danger font-semibold mt-1">
                      {contactErrors.email}
                    </div>
                  ) : (
                    <div className="form-row__hint text-[11px] text-brand-muted mt-1.5">
                      We'll send a quote PDF and your booking confirmation here.
                    </div>
                  )}
                </div>

                <div className="form-row">
                  <label className="form-row__label block text-xs font-semibold text-brand-text mb-1.5">
                    Best time to call (optional)
                  </label>
                  <select
                    value={contactData.bestTimeToCall}
                    onChange={(e) => setContactData({ ...contactData, bestTimeToCall: e.target.value })}
                    className="form-row__select w-full bg-brand-card border border-brand-border rounded-lg p-2.5 text-[13.5px] focus:outline-none focus:border-brand-primary"
                  >
                    <option>Any time during business hours</option>
                    <option>Morning (8am–12pm)</option>
                    <option>Afternoon (12–5pm)</option>
                    <option>After 5pm</option>
                  </select>
                  <div className="form-row__hint text-[11px] text-brand-muted mt-1.5">
                    Installer will text first, but call if there's a question.
                  </div>
                </div>

                <div className="cta-row flex gap-3 pt-4 border-t border-brand-border mt-6">
                  <button
                    type="button"
                    onClick={handleEditJob}
                    className="cta-btn cta-btn--secondary bg-transparent border border-brand-border text-brand-text font-semibold text-xs py-2.5 px-4 rounded hover:bg-brand-soft transition"
                  >
                    ← Back to calculator
                  </button>
                  <button
                    type="submit"
                    className="cta-btn cta-btn--full bg-brand-primary text-white font-bold text-xs py-2.5 px-6 rounded hover:bg-brand-primary-hover transition flex-1 text-center justify-center font-semibold"
                    data-testid="details-submit-btn"
                  >
                    {isSupplyOnly ? "Continue to pickup date →" : "Continue to walkthrough video →"}
                  </button>
                </div>
              </form>
            )}

            {step === 2 && !isSupplyOnly && (
              <VideoUploader
                onVideoSelected={handleVideoSelected}
                onSkip={handleSkipVideo}
                onBack={() => setStep(1)}
                initialVideo={videoData}
              />
            )}

            {step === 3 && (
              <Calendar
                isSupplyOnly={isSupplyOnly}
                selectedDate={selectedDate}
                onDateSelect={handleDateSelect}
                onBack={() => setStep(isSupplyOnly ? 1 : 2)}
                onContinue={() => setStep(4)}
                balanceText={balanceText}
              />
            )}

            {step === 4 && (
              <div>
                <div className="step-area__head mb-6">
                  <div className="step-area__step-num text-[11.5px] font-mono tracking-wider text-brand-primary font-bold mb-1.5 uppercase">
                    STEP 4 OF 5
                  </div>
                  <h2 className="step-area__title text-2xl sm:text-3xl font-extrabold text-brand-text mb-2 tracking-tight">
                    Review &amp; secure with a 10% deposit
                  </h2>
                  <p className="step-area__lede text-brand-muted text-sm sm:text-base leading-relaxed">
                    Quick once-over of everything below — anything off, tap Edit. Deposit secures your date and is refundable up to {isSupplyOnly ? "24h" : "48h"} before.
                  </p>
                </div>

                <DepositBanner
                  isSupplyOnly={isSupplyOnly}
                  depositAmount={depositAmount}
                  totalAmount={totalAmount}
                />

                <ReviewCard
                  isSupplyOnly={isSupplyOnly}
                  contactData={contactData}
                  selectedDate={selectedDate}
                  videoData={videoData}
                  payload={payload}
                  onEditStep={handleEditStep}
                  onEditJob={handleEditJob}
                />

                <PaymentForm
                  isSupplyOnly={isSupplyOnly}
                  depositAmount={depositAmount}
                  selectedDate={selectedDate}
                  onSuccess={() => setStep(5)}
                />
              </div>
            )}

            {step === 5 && (
              <ConfirmationHero
                isSupplyOnly={isSupplyOnly}
                selectedDate={selectedDate}
                emailAddress={contactData.email}
              />
            )}
          </div>
        </main>
      </div>

      {/* Bottom platform attribution strip */}
      <footer className="anyfence-tag-bottom border-t border-brand-border bg-brand-soft py-3 px-4 text-center text-[10.5px] text-brand-muted select-none">
        Booking {quoteId || "Q-4F9A2C"} · secured by <b className="text-brand-text font-black">Anyfence</b> · GST inc · 10% deposit · payment processed by Stripe · receipt emailed instantly
      </footer>
    </div>
  );
}
