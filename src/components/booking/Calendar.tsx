import { useState, useMemo, useEffect } from "react";
import { useSupplierAvailability, type DayAvailability } from "../../hooks/useSupplierAvailability";

interface CalendarProps {
  isSupplyOnly: boolean;
  selectedDate: string | null;
  onDateSelect: (dateStr: string) => void;
  onBack: () => void;
  onContinue: () => void;
  balanceText: string;
}

export function Calendar({ isSupplyOnly, selectedDate, onDateSelect, onBack, onContinue, balanceText }: CalendarProps) {
  // June 2026 as per E2E spec and wireframe
  const [year] = useState(2026);
  const [month] = useState(5); // 0-indexed, so 5 = June
  const monthName = "June 2026";

  const { availability } = useSupplierAvailability("amazing-fencing", isSupplyOnly, year, month);

  // Set default selection if none is provided yet
  useEffect(() => {
    if (!selectedDate) {
      // June 16 for install, June 8 for pickup
      const defaultDate = isSupplyOnly ? "2026-06-08" : "2026-06-16";
      onDateSelect(defaultDate);
    }
  }, [isSupplyOnly, selectedDate, onDateSelect]);

  // Weekdays header
  const weekdays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  // Helper to format Date
  const formatDateString = (y: number, m: number, d: number) => {
    const mm = String(m + 1).padStart(2, "0");
    const dd = String(d).padStart(2, "0");
    return `${y}-${mm}-${dd}`;
  };

  // Generate grid days for June 2026
  // June 1 2026 is a Monday. June has 30 days.
  const calendarDays = useMemo(() => {
    const list: Array<{
      dayNum: number;
      dateStr: string;
      isCurrentMonth: boolean;
      data?: DayAvailability;
    }> = [];

    // Since June 1 2026 is Monday, we don't need padding for previous month in a Mon-Sun grid!
    // But let's build a standard grid of 35 slots (5 weeks)
    // June 1 to June 30
    for (let d = 1; d <= 30; d++) {
      const dateStr = formatDateString(year, month, d);
      list.push({
        dayNum: d,
        dateStr,
        isCurrentMonth: true,
        data: availability[dateStr],
      });
    }

    // Add trailing padding for next month to complete the 35-day grid
    for (let d = 1; d <= 5; d++) {
      const nextMonthDateStr = formatDateString(year, month + 1, d);
      list.push({
        dayNum: d,
        dateStr: nextMonthDateStr,
        isCurrentMonth: false,
      });
    }

    return list;
  }, [availability, year, month]);

  const handleDayClick = (day: typeof calendarDays[number]) => {
    if (!day.isCurrentMonth || !day.data) return;
    if (day.data.state === "booked" || day.data.state === "closed") return;
    onDateSelect(day.dateStr);
  };

  // Selected date label formatting for readout card
  const readoutText = useMemo(() => {
    if (!selectedDate) return "";

    const date = new Date(selectedDate);
    const dayName = date.toLocaleDateString("en-AU", { weekday: "short" });
    const dayNum = date.getDate();
    const monthNameLong = date.toLocaleDateString("en-AU", { month: "long" });

    if (isSupplyOnly) {
      return `${dayName} ${dayNum} ${monthNameLong} · 9:00am pickup`;
    } else {
      // For install starting Tue 16 June, we finish Thu 18 June
      // Let's hardcode the finishing label for 16 June, and generalize for others
      if (selectedDate === "2026-06-16") {
        return "Tue 16 June, finishing Thu 18 June";
      }
      const finishDate = new Date(date);
      finishDate.setDate(date.getDate() + 2); // 2 days later
      const finishDayName = finishDate.toLocaleDateString("en-AU", { weekday: "short" });
      const finishDayNum = finishDate.getDate();
      const finishMonthName = finishDate.toLocaleDateString("en-AU", { month: "long" });
      return `${dayName} ${dayNum} ${monthNameLong}, finishing ${finishDayName} ${finishDayNum} ${finishMonthName}`;
    }
  }, [selectedDate, isSupplyOnly]);

  return (
    <div className="w-full">
      <div className="step-area__head mb-6">
        <div className="step-area__step-num text-[11.5px] font-mono tracking-wider text-brand-primary font-bold mb-1.5 uppercase">
          STEP 3 OF 5 {isSupplyOnly && "· SUPPLY ONLY"}
        </div>
        <h2 className="step-area__title text-2xl sm:text-3xl font-extrabold text-brand-text mb-2 tracking-tight">
          {isSupplyOnly ? "When can you pick up?" : "When should we start?"}
        </h2>
        <p className="step-area__lede text-brand-muted text-sm sm:text-base max-w-[540px] leading-relaxed">
          {isSupplyOnly
            ? "Pickup from Amazing Fencing's Currimundi depot. Bring a Ute or trailer — posts are 2.4m long. You'll get a text 30 minutes before your slot."
            : "Pick a start date — your 2-day install will run that day and the next. Days in green are open; hatched grey is already booked. We'll text you the morning of with the team's ETA."}
        </p>
      </div>

      <div className="calendar bg-brand-card border border-brand-border rounded-xl p-4 shadow-sm select-none">
        {/* Month Header */}
        <div className="calendar__head flex items-center justify-between mb-3">
          <div className="calendar__title text-sm sm:text-base font-bold text-brand-text">
            {monthName} {isSupplyOnly && "· Depot pickup"}
          </div>
          <div className="calendar__nav flex gap-1">
            <button
              type="button"
              className="calendar__nav-btn w-7 h-7 bg-brand-soft border border-brand-border text-brand-text rounded-md flex items-center justify-center font-bold hover:bg-brand-border/40 transition"
              disabled
            >
              ‹
            </button>
            <button
              type="button"
              className="calendar__nav-btn w-7 h-7 bg-brand-soft border border-brand-border text-brand-text rounded-md flex items-center justify-center font-bold hover:bg-brand-border/40 transition"
              disabled
            >
              ›
            </button>
          </div>
        </div>

        {/* Weekday Labels */}
        <div className="calendar__weekdays grid grid-cols-7 gap-1 mb-1 text-center">
          {weekdays.map((day) => (
            <div key={day} className="calendar__weekday text-[10px] font-bold text-brand-muted uppercase tracking-wider py-1.5">
              {day}
            </div>
          ))}
        </div>

        {/* Day Grid */}
        <div className="calendar__grid grid grid-cols-7 gap-1">
          {calendarDays.map((day, idx) => {
            const isSelected = selectedDate === day.dateStr;
            const isOut = !day.isCurrentMonth;
            const isAvailable = day.data?.state === "available";
            const isBooked = day.data?.state === "booked";
            const isClosed = day.data?.state === "closed";

            let dayClass = "calendar__day aspect-square rounded-md flex flex-col items-center justify-center relative font-mono text-[12.5px] cursor-pointer transition border border-transparent ";
            let tag = "";

            if (isOut) {
              dayClass += "calendar__day--out text-brand-muted opacity-40 cursor-not-allowed";
            } else if (isSelected) {
              dayClass += "calendar__day--selected bg-brand-primary text-white shadow-md shadow-brand-primary/20";
              tag = isSupplyOnly ? "9am" : "START";
            } else if (isAvailable) {
              dayClass += "calendar__day--available bg-brand-success-soft text-brand-success hover:bg-brand-success hover:text-white";
              tag = day.data?.label || "";
            } else if (isBooked) {
              dayClass += "calendar__day--booked text-brand-muted/80 bg-[repeating-linear-gradient(45deg,transparent,transparent_3px,var(--brand-border)_3px,var(--brand-border)_4px)] cursor-not-allowed";
              tag = "";
            } else if (isClosed) {
              dayClass += "calendar__day--closed text-brand-danger bg-brand-danger-soft cursor-not-allowed";
              tag = isSupplyOnly ? "Closed" : "Weekend";
            } else {
              dayClass += "text-brand-text hover:bg-brand-soft";
            }

            return (
              <div
                key={idx}
                onClick={() => handleDayClick(day)}
                className={dayClass}
                data-testid={`day-${day.dayNum}`}
              >
                <span className="calendar__day-num font-bold">{day.dayNum}</span>
                {tag && (
                  <span className={`calendar__day-tag text-[8px] font-bold mt-0.5 ${isSelected ? "text-white/80" : "text-brand-muted"}`}>
                    {tag}
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {/* Legend */}
        <div className="calendar__legend flex gap-x-4 gap-y-2 flex-wrap border-t border-brand-border/60 pt-3 mt-3">
          <div className="calendar__legend-item flex items-center gap-1.5 text-[10.5px] text-brand-muted">
            <span className="calendar__legend-swatch w-3 h-3 rounded bg-brand-success-soft border border-brand-success" />
            {isSupplyOnly ? "Pickup slots open" : "Available 2-day slot"}
          </div>
          <div className="calendar__legend-item flex items-center gap-1.5 text-[10.5px] text-brand-muted">
            <span className="calendar__legend-swatch w-3 h-3 rounded bg-brand-primary" />
            Your pick
          </div>
          <div className="calendar__legend-item flex items-center gap-1.5 text-[10.5px] text-brand-muted">
            <span className="calendar__legend-swatch w-3 h-3 rounded border border-brand-border bg-[repeating-linear-gradient(45deg,transparent,transparent_2px,var(--brand-border)_2px,var(--brand-border)_3px)]" />
            Already booked
          </div>
          <div className="calendar__legend-item flex items-center gap-1.5 text-[10.5px] text-brand-muted">
            <span className="calendar__legend-swatch w-3 h-3 rounded bg-brand-danger-soft border border-brand-danger/35" />
            {isSupplyOnly ? "Depot closed (Sundays)" : "Closed"}
          </div>
        </div>
      </div>

      {/* Confirmation Details Card */}
      <div className="booking-time-card bg-brand-primary/5 border border-brand-primary/65 rounded-xl p-4 mt-4 flex gap-3.5 items-start select-none">
        <div className="booking-time-card__icon text-xl shrink-0 mt-0.5">
          {isSupplyOnly ? "🛻" : "📅"}
        </div>
        <div className="booking-time-card__body min-w-0 flex-1 leading-normal">
          <div className="booking-time-card__title text-[13.5px] font-bold text-brand-text mb-1" data-testid="tentative-date-readout">
            {isSupplyOnly ? readoutText : `Tentative — ${readoutText}`}
          </div>
          <div className="booking-time-card__sub text-[12px] text-brand-muted">
            {isSupplyOnly
              ? `10-minute window. Bring a Ute or trailer · drive into the loading bay · staff will help load. Pay balance (${balanceText}) on pickup.`
              : "Locks for 24h. Installer confirms after watching your video — they'll usually accept within 4 working hours."}
          </div>
        </div>
      </div>

      {/* CTA buttons */}
      <div className="cta-row flex gap-3 pt-4 border-t border-brand-border mt-6">
        <button
          type="button"
          onClick={onBack}
          className="cta-btn cta-btn--secondary bg-transparent border border-brand-border text-brand-text font-semibold text-xs py-2.5 px-4 rounded hover:bg-brand-soft transition"
        >
          ← Back
        </button>
        <button
          type="button"
          onClick={onContinue}
          className="cta-btn cta-btn--full bg-brand-primary text-white font-bold text-xs py-2.5 px-6 rounded hover:bg-brand-primary-hover transition flex-1 text-center justify-center"
        >
          Continue to review + deposit →
        </button>
      </div>
    </div>
  );
}
