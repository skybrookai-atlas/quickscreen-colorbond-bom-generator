import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ChevronDown, Filter, Trash2, Plus, FileText, Search } from "lucide-react";
import { AppShell } from "../components/layout/AppShell";
import { useAuth } from "../hooks/useAuth";
import { useQuotes } from "../hooks/useQuotes";
import { formatLayoutLabel, isJobNameFallback } from "../lib/quoteListMeta";
// TODO: re-enable status filter + column
// import type { QuoteStatus } from "../types/quote.types";

type CreatedByFilter = "mine" | "all" | "users";
// type StatusFilter = "any" | QuoteStatus;
type DateFilter = "any" | "today" | "7d" | "30d" | "year";

// const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
//   { value: "any", label: "Any" },
//   { value: "draft", label: "Draft" },
//   { value: "sent", label: "Sent" },
//   { value: "accepted", label: "Accepted" },
//   { value: "expired", label: "Expired" },
// ];

const DATE_OPTIONS: { value: DateFilter; label: string }[] = [
  { value: "any", label: "Any" },
  { value: "today", label: "Today" },
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "year", label: "This year" },
];

const FILTER_SELECT_CLASS =
  "appearance-none pl-3 pr-8 py-1.5 min-w-[6.5rem] text-sm bg-brand-card border border-brand-border rounded-md text-brand-text focus:outline-none focus:ring-1 focus:ring-brand-accent/40 focus:border-brand-accent cursor-pointer";

function FilterField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-brand-muted whitespace-nowrap">{label}</span>
      {children}
    </div>
  );
}

function FilterSelect<T extends string>({
  value,
  onChange,
  options,
  "aria-label": ariaLabel,
}: {
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: string }[];
  "aria-label": string;
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        aria-label={ariaLabel}
        className={FILTER_SELECT_CLASS}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      <ChevronDown
        size={14}
        className="absolute right-2 top-1/2 -translate-y-1/2 text-brand-muted pointer-events-none"
      />
    </div>
  );
}

function CreatedByDropdown({
  mode,
  options,
  selectedIds,
  currentUserId,
  onModeChange,
  onToggle,
}: {
  mode: CreatedByFilter;
  options: [string, string][];
  selectedIds: Set<string>;
  currentUserId: string | undefined;
  onModeChange: (mode: CreatedByFilter) => void;
  onToggle: (userId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (rootRef.current?.contains(event.target as Node)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  const triggerLabel = useMemo(() => {
    if (mode === "mine") return "Me";
    if (mode === "all") return "Any";
    if (selectedIds.size === 0) return "Any";
    if (selectedIds.size === 1) {
      const id = [...selectedIds][0];
      return options.find(([userId]) => userId === id)?.[1] ?? "1 person";
    }
    return `${selectedIds.size} people`;
  }, [mode, options, selectedIds]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label="Created by"
        className={`${FILTER_SELECT_CLASS} inline-flex items-center justify-between gap-2 text-left min-w-[7rem]`}
      >
        <span className="truncate">{triggerLabel}</span>
        <ChevronDown
          size={14}
          className={`shrink-0 text-brand-muted transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div
          role="listbox"
          aria-multiselectable={mode === "users"}
          className="absolute left-0 z-20 mt-1 min-w-[12rem] max-h-60 overflow-y-auto rounded-md border border-brand-border bg-brand-card py-1 shadow-lg"
        >
          <button
            type="button"
            className={`w-full px-3 py-1.5 text-left text-sm hover:bg-brand-bg/60 ${mode === "mine" ? "text-brand-accent font-medium" : "text-brand-text"}`}
            onClick={() => {
              onModeChange("mine");
              setOpen(false);
            }}
          >
            Me
          </button>
          <button
            type="button"
            className={`w-full px-3 py-1.5 text-left text-sm hover:bg-brand-bg/60 ${mode === "all" ? "text-brand-accent font-medium" : "text-brand-text"}`}
            onClick={() => {
              onModeChange("all");
              setOpen(false);
            }}
          >
            Any
          </button>
          {options.length > 0 && (
            <>
              <div className="my-1 border-t border-brand-border/60" />
              {options.map(([userId, name]) => (
                <label
                  key={userId}
                  className="flex items-center gap-2 px-3 py-1.5 text-sm text-brand-text cursor-pointer hover:bg-brand-bg/60"
                >
                  <input
                    type="checkbox"
                    checked={mode === "users" && selectedIds.has(userId)}
                    onChange={() => onToggle(userId)}
                    className="accent-brand-accent rounded"
                  />
                  <span className="truncate">
                    {name}
                    {userId === currentUserId ? (
                      <span className="text-brand-muted"> (you)</span>
                    ) : null}
                  </span>
                </label>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function quoteMatchesDate(createdAt: string, dateFilter: DateFilter): boolean {
  if (dateFilter === "any") return true;
  const created = new Date(createdAt);
  const now = new Date();
  const startOfToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  );

  switch (dateFilter) {
    case "today":
      return created >= startOfToday;
    case "7d":
      return created >= new Date(now.getTime() - 7 * 86_400_000);
    case "30d":
      return created >= new Date(now.getTime() - 30 * 86_400_000);
    case "year":
      return created.getFullYear() === now.getFullYear();
    default:
      return true;
  }
}

// TODO: re-enable status column badge colours
// const STATUS_COLOURS: Record<string, string> = {
//   draft: "text-brand-muted bg-brand-border/30",
//   sent: "text-brand-primary bg-brand-primary/10",
//   accepted: "text-brand-success bg-brand-success/10",
//   expired: "text-brand-danger bg-brand-danger/10",
// };

export function QuotesHistoryPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { quotesQuery, deleteQuote } = useQuotes();
  const [search, setSearch] = useState("");
  // TODO: re-enable status filter
  // const [statusFilter, setStatusFilter] = useState<StatusFilter>("any");
  const [dateFilter, setDateFilter] = useState<DateFilter>("any");
  const [createdByFilter, setCreatedByFilter] =
    useState<CreatedByFilter>("mine");
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(
    () => new Set(),
  );

  const quotes = quotesQuery.data ?? [];

  const creatorOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const quote of quotes) {
      if (!map.has(quote.user_id)) {
        map.set(quote.user_id, quote.creatorName ?? "Unknown");
      }
    }
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [quotes]);

  const toggleCreator = (userId: string) => {
    const next = new Set(selectedUserIds);
    if (next.has(userId)) next.delete(userId);
    else next.add(userId);

    setSelectedUserIds(next);
    setCreatedByFilter(next.size === 0 ? "all" : "users");
  };

  const handleCreatedByModeChange = (mode: CreatedByFilter) => {
    setCreatedByFilter(mode);
    if (mode !== "users") setSelectedUserIds(new Set());
  };

  const filtered = useMemo(() => {
    let result = quotes;
    const query = search.trim().toLowerCase();
    if (query) {
      result = result.filter((q) => q.jobName.toLowerCase().includes(query));
    }
    // TODO: re-enable status filter
    // if (statusFilter !== "any") {
    //   result = result.filter((q) => q.status === statusFilter);
    // }
    if (dateFilter !== "any") {
      result = result.filter((q) => quoteMatchesDate(q.created_at, dateFilter));
    }
    if (createdByFilter === "mine" && user?.id) {
      result = result.filter((q) => q.user_id === user.id);
    } else if (
      createdByFilter === "users" &&
      selectedUserIds.size > 0
    ) {
      result = result.filter((q) => selectedUserIds.has(q.user_id));
    }
    return result;
  }, [
    quotes,
    search,
    // statusFilter,
    dateFilter,
    createdByFilter,
    selectedUserIds,
    user?.id,
  ]);

  const hasActiveFilters =
    search.trim().length > 0 ||
    // statusFilter !== "any" ||
    dateFilter !== "any" ||
    createdByFilter !== "mine";

  const openQuote = (quoteId: string) => {
    navigate(`/quote/${quoteId}`);
  };

  const handleRowKeyDown = (
    event: React.KeyboardEvent<HTMLTableRowElement>,
    quoteId: string,
  ) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openQuote(quoteId);
    }
  };

  const stats = useMemo(() => {
    const totalCount = quotes.length;
    const totalSum = quotes.reduce((acc, q) => acc + (q.displayTotal ?? 0), 0);
    const uniqueCreators = new Set(quotes.map((q) => q.user_id)).size;
    return { totalCount, totalSum, uniqueCreators };
  }, [quotes]);

  return (
    <AppShell>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        {/* ── Page header ──────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black text-brand-text">Quotes Dashboard</h1>
            <p className="text-sm text-brand-muted mt-0.5">
              {quotes.length === 0
                ? "No quotes yet"
                : hasActiveFilters && filtered.length !== quotes.length
                  ? `${filtered.length} of ${quotes.length} quotes`
                  : `${quotes.length} quote${quotes.length !== 1 ? "s" : ""} saved`}
            </p>
          </div>
          <Link
            to="/fence-calculator"
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-brand-accent hover:bg-brand-accent-hover text-white text-sm font-semibold rounded-xl shadow-sm transition-all hover-lift shrink-0"
          >
            <Plus size={16} />
            New Quote
          </Link>
        </div>

        {/* Stats Grid */}
        {quotes.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            <div className="bg-brand-card border border-brand-border/60 rounded-xl p-5 shadow-sm hover:border-brand-primary/30 transition-colors">
              <p className="text-[10px] font-black uppercase tracking-wider text-brand-muted">Total Saved Quotes</p>
              <h2 className="text-2xl font-black text-brand-text mt-1">{stats.totalCount}</h2>
            </div>
            <div className="bg-brand-card border border-brand-border/60 rounded-xl p-5 shadow-sm hover:border-brand-primary/30 transition-colors">
              <p className="text-[10px] font-black uppercase tracking-wider text-brand-muted">Estimated Value (inc. GST)</p>
              <h2 className="text-2xl font-black text-brand-accent mt-1">${new Intl.NumberFormat('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(stats.totalSum)}</h2>
            </div>
            <div className="bg-brand-card border border-brand-border/60 rounded-xl p-5 shadow-sm hover:border-brand-primary/30 transition-colors">
              <p className="text-[10px] font-black uppercase tracking-wider text-brand-muted">Active Estimators</p>
              <h2 className="text-2xl font-black text-brand-text mt-1">{stats.uniqueCreators}</h2>
            </div>
          </div>
        )}

        {/* ── Filters ──────────────────────────────────────────────── */}
        {quotes.length > 0 && (
          <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
            <div className="relative flex-1 min-w-[12rem] max-w-xs">
              <Search
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-muted pointer-events-none"
              />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by job name…"
                className="w-full pl-8 pr-3 py-1.5 text-sm bg-brand-card border border-brand-border rounded-md text-brand-text placeholder:text-brand-muted/60 focus:outline-none focus:ring-1 focus:ring-brand-accent/40 focus:border-brand-accent transition-colors"
              />
            </div>
            <div className="flex items-center gap-x-5 ml-auto">

              <Filter
                size={16}
                className="text-brand-muted shrink-0"
                aria-hidden
              />

              {/* TODO: re-enable status filter */}
              {/* <FilterField label="Status">
                <FilterSelect
                  value={statusFilter}
                  onChange={setStatusFilter}
                  options={STATUS_OPTIONS}
                  aria-label="Status"
                />
              </FilterField> */}

              <FilterField label="Created by">
                <CreatedByDropdown
                  mode={createdByFilter}
                  options={creatorOptions}
                  selectedIds={selectedUserIds}
                  currentUserId={user?.id}
                  onModeChange={handleCreatedByModeChange}
                  onToggle={toggleCreator}
                />
              </FilterField>

              <FilterField label="Date">
                <FilterSelect
                  value={dateFilter}
                  onChange={setDateFilter}
                  options={DATE_OPTIONS}
                  aria-label="Date"
                />
              </FilterField>


            </div>
          </div>
        )}

        {/* ── Table ────────────────────────────────────────────────── */}
        <div className="bg-brand-card border border-brand-border/60 rounded-xl shadow-sm overflow-hidden">
          {quotesQuery.isLoading && (
            <p className="px-5 py-10 text-sm text-brand-muted text-center animate-pulse">
              Loading quotes…
            </p>
          )}

          {quotesQuery.isError && (
            <p className="px-5 py-10 text-sm text-brand-danger text-center">
              Failed to load quotes.
            </p>
          )}

          {!quotesQuery.isLoading && quotes.length === 0 && (
            <div className="px-5 py-16 text-center space-y-3">
              <FileText size={24} className="mx-auto text-brand-muted/40" />
              <p className="text-sm font-semibold text-brand-muted">No quotes saved yet.</p>
              <Link
                to="/fence-calculator"
                className="inline-flex items-center gap-1.5 text-sm text-brand-primary font-bold hover:underline"
              >
                <Plus size={16} /> Create your first quote
              </Link>
            </div>
          )}

          {!quotesQuery.isLoading && quotes.length > 0 && filtered.length === 0 && (
            <p className="px-5 py-10 text-sm text-brand-muted text-center">
              {hasActiveFilters
                ? "No quotes match the current filters."
                : "No quotes found."}
            </p>
          )}

          {filtered.length > 0 && (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-brand-bg/65 border-b border-brand-border/50 text-[10px] font-extrabold text-brand-muted uppercase tracking-wider">
                  <th className="px-4 py-3.5 whitespace-nowrap">
                    Job name
                  </th>
                  <th className="px-4 py-3.5 hidden sm:table-cell">
                    Created by
                  </th>
                  <th className="px-4 py-3.5 hidden sm:table-cell">
                    System
                  </th>
                  <th className="px-4 py-3.5 hidden md:table-cell">
                    Layout
                  </th>
                  <th className="px-4 py-3.5 hidden md:table-cell">
                    Date
                  </th>
                  <th className="text-right px-4 py-3.5">
                    Total (inc. GST)
                  </th>
                  <th className="px-4 py-3.5" />
                </tr>
              </thead>
              <tbody className="font-medium text-brand-text">
                {filtered.map((quote, i) => {
                  const layoutLabel = formatLayoutLabel({
                    runs: quote.runCount,
                    segments: quote.segmentCount,
                    gates: quote.gateCount,
                  });
                  const showQuoteNumber = !isJobNameFallback(
                    quote.jobName,
                    quote.quote_number,
                  );

                  return (
                    <tr
                      key={quote.id}
                      role="link"
                      tabIndex={0}
                      title="Open quote"
                      onClick={() => openQuote(quote.id)}
                      onKeyDown={(e) => handleRowKeyDown(e, quote.id)}
                      className={`cursor-pointer hover:bg-brand-accent/5 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-accent/50 ${i < filtered.length - 1
                        ? "border-b border-brand-border/40"
                        : ""
                        }`}
                    >
                      <td className="px-4 py-3.5">
                        <p className="font-bold text-brand-text group-hover:text-brand-primary transition-colors">
                          {quote.jobName}
                        </p>
                        {showQuoteNumber && (
                          <p className="text-[11px] text-brand-muted mt-0.5">
                            #{quote.quote_number}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-brand-muted hidden sm:table-cell font-semibold">
                        {quote.creatorName ?? "Unknown"}
                      </td>
                      <td className="px-4 py-3.5 hidden sm:table-cell">
                        <span className="inline-flex rounded-full bg-brand-accent/10 px-2.5 py-0.5 text-[10px] font-extrabold text-brand-accent border border-brand-accent/15">
                          {quote.systemLabel}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 hidden md:table-cell">
                        <span className="inline-flex rounded-full bg-brand-bg px-2.5 py-0.5 text-[10px] font-bold text-brand-muted border border-brand-border/50">
                          {layoutLabel}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-brand-muted hidden md:table-cell font-semibold">
                        {new Date(quote.created_at).toLocaleDateString("en-AU")}
                      </td>
                      <td className="px-4 py-3.5 text-right font-bold text-brand-text tabular-nums">
                        {quote.displayTotal != null
                          ? `$${quote.displayTotal.toFixed(2)}`
                          : "—"}
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center justify-end">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteQuote.mutate(quote.id);
                            }}
                            title="Delete quote"
                            className="p-1.5 text-brand-muted hover:text-brand-danger rounded-lg hover:bg-brand-danger/10 transition-all"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </AppShell>
  );
}
