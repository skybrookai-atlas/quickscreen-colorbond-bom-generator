import { useMemo } from "react";

export interface DayAvailability {
  dateStr: string; // YYYY-MM-DD
  state: "available" | "booked" | "closed";
  label?: string; // "2-day", "Day 2", "3 slots", etc.
  slotsAvailable?: number;
}

export function useSupplierAvailability(supplierSlug: string, isSupplyOnly: boolean, year: number, month: number) {
  // Generate mock availability for the specified month
  const availability = useMemo(() => {
    const data: Record<string, DayAvailability> = {};
    const date = new Date(year, month, 1);
    
    // Helper to format date as YYYY-MM-DD in local time
    const formatDate = (d: Date) => {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      return `${y}-${m}-${day}`;
    };

    // Populate all days of the month
    while (date.getMonth() === month) {
      const dateStr = formatDate(date);
      const dayOfWeek = date.getDay(); // 0 = Sunday, 6 = Saturday

      if (isSupplyOnly) {
        // Supply Only: Pickup slots
        if (dayOfWeek === 0) {
          // Sunday closed
          data[dateStr] = {
            dateStr,
            state: "closed",
            label: "Closed",
            slotsAvailable: 0,
          };
        } else {
          // Mon-Sat open with mock slots
          // Let's make some days fully booked for variety
          const isBooked = date.getDate() % 7 === 0;
          const slots = isBooked ? 0 : (date.getDate() % 5) + 1; // 1-5 slots
          data[dateStr] = {
            dateStr,
            state: slots > 0 ? "available" : "booked",
            label: slots > 0 ? `${slots} slots` : "Fully booked",
            slotsAvailable: slots,
          };
        }
      } else {
        // Supply + Install: 2-day install windows
        if (dayOfWeek === 0 || dayOfWeek === 6) {
          // Weekends closed
          data[dateStr] = {
            dateStr,
            state: "closed",
            label: "Weekend",
          };
        } else {
          // Weekdays availability: consecutive 2-day slots
          // Let's say Mon-Tue is available, Wed-Thu is booked, Fri is closed or odd
          // Let's create a predictable mock pattern based on date:
          const dayNum = date.getDate();
          
          if (dayNum === 16 || dayNum === 17 || dayNum === 18) {
            // Predictable slots for E2E tests (June 16 is selected, 16 & 17 available)
            if (dayNum === 16) {
              data[dateStr] = { dateStr, state: "available", label: "2-day" };
            } else if (dayNum === 17) {
              data[dateStr] = { dateStr, state: "available", label: "Day 2" };
            } else {
              data[dateStr] = { dateStr, state: "booked", label: "Booked" };
            }
          } else if (dayOfWeek === 1 || dayOfWeek === 3) {
            // Monday or Wednesday start of a 2-day window
            const isBooked = dayNum % 5 === 0; // Booked every 5th day
            data[dateStr] = {
              dateStr,
              state: isBooked ? "booked" : "available",
              label: isBooked ? "Booked" : "2-day",
            };
          } else if (dayOfWeek === 2 || dayOfWeek === 4) {
            // Tuesday or Thursday (Day 2 of the window)
            // Follow the state of the starting day
            const prev = new Date(date);
            prev.setDate(date.getDate() - 1);
            const prevStr = formatDate(prev);
            const prevDay = data[prevStr];
            
            data[dateStr] = {
              dateStr,
              state: prevDay ? prevDay.state : "booked",
              label: prevDay && prevDay.state === "available" ? "Day 2" : "Booked",
            };
          } else {
            // Friday: single day, usually closed or booked since installs are 2-day
            data[dateStr] = {
              dateStr,
              state: "closed",
              label: "Closed",
            };
          }
        }
      }

      date.setDate(date.getDate() + 1);
    }

    return data;
  }, [supplierSlug, isSupplyOnly, year, month]);

  return {
    availability,
    isLoading: false,
    error: null,
  };
}
