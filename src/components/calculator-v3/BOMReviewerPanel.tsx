import { useState } from "react";
import { toast } from "sonner";
import { isSupabaseConfigured, supabase } from "../../lib/supabase";
import type { CanonicalPayload } from "../../types/canonical.types";
import type { BOMLineItem } from "../../types/bom.types";
import {
  ShieldAlert,
  AlertTriangle,
  Wrench,
  Info,
  Loader2,
  Sparkles,
  CheckCircle2,
} from "lucide-react";

interface AuditFinding {
  type: "compliance" | "warning" | "suggestion";
  severity: "error" | "warning" | "info";
  message: string;
}

interface BOMReviewerPanelProps {
  payload: CanonicalPayload | null;
  bomItems: BOMLineItem[];
}

export function BOMReviewerPanel({ payload, bomItems }: BOMReviewerPanelProps) {
  const [loading, setLoading] = useState(false);
  const [findings, setFindings] = useState<AuditFinding[] | null>(null);

  async function runAudit() {
    if (!payload) {
      toast.error("Please add a fence layout first.");
      return;
    }
    if (!bomItems || bomItems.length === 0) {
      toast.error("Please generate the BOM list first.");
      return;
    }

    setLoading(true);
    setFindings(null);

    try {
      if (!isSupabaseConfigured) {
        // Fallback response for local offline development
        setTimeout(() => {
          setFindings([
            {
              type: "warning",
              severity: "warning",
              message: "Offline Mode: AI Compliance Reviewer requires an active Supabase server.",
            },
            {
              type: "suggestion",
              severity: "info",
              message: "Tip: Add touch-up paint or driver bits from the accessories list.",
            },
          ]);
          setLoading(false);
        }, 1500);
        return;
      }

      const { data: { session } } = await supabase.auth.getSession();
      const headers: Record<string, string> = {};
      if (session?.access_token) {
        headers["Authorization"] = `Bearer ${session.access_token}`;
      }

      const { data, error } = await supabase.functions.invoke("review-bom", {
        body: { payload, bomItems },
        headers,
      });

      if (error) {
        throw error;
      }

      if (data) {
        if (data.error) {
          throw new Error(data.error);
        }
        setFindings(data);
        toast.success("BOM Audit complete!");
      }
    } catch (err) {
      console.error("AI review failed:", err);
      toast.error(err instanceof Error ? err.message : "Failed to run AI compliance check.");
      setFindings([
        {
          type: "warning",
          severity: "warning",
          message: "Unable to reach the AI Reviewer. Please check your network connection.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  // Count severities
  const errors = findings?.filter((f) => f.severity === "error") || [];
  const warnings = findings?.filter((f) => f.severity === "warning") || [];
  const infos = findings?.filter((f) => f.severity === "info") || [];

  return (
    <div className="space-y-4" data-testid="bom-reviewer-panel">
      <div className="flex items-center justify-between border-b border-brand-border pb-3">
        <div>
          <h3 className="text-sm font-black text-brand-text flex items-center gap-1.5">
            <Sparkles className="text-brand-primary" size={16} />
            Gemini AI Auditor (Ultra)
          </h3>
          <p className="text-[11.5px] text-brand-muted">
            Check your fence geometry & BOM against Australian safety codes
          </p>
        </div>
        <button
          type="button"
          onClick={runAudit}
          disabled={loading || !payload || bomItems.length === 0}
          className="inline-flex items-center gap-1.5 rounded-lg bg-brand-primary px-3 py-1.5 text-xs font-black text-white hover:bg-brand-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (
            <>
              <Loader2 size={12} className="animate-spin" />
              Auditing...
            </>
          ) : (
            "Run AI Audit"
          )}
        </button>
      </div>

      {loading && (
        <div className="flex flex-col items-center justify-center py-10 space-y-3">
          <Loader2 size={32} className="animate-spin text-brand-primary" />
          <div className="text-center space-y-1">
            <p className="text-xs font-bold text-brand-text animate-pulse">
              Analyzing fence parameters...
            </p>
            <p className="text-[10px] text-brand-muted max-w-xs">
              Gemini is validating spans, post connections, gate hinge ratings, and pool safety clearances.
            </p>
          </div>
        </div>
      )}

      {!loading && !findings && (
        <div className="rounded-xl border border-dashed border-brand-border bg-brand-bg/50 p-6 text-center">
          <Wrench size={24} className="mx-auto mb-2 text-brand-muted" />
          <p className="text-xs font-bold text-brand-text">
            Ready for compliance check
          </p>
          <p className="text-[10.5px] text-brand-muted mt-1">
            Click &apos;Run AI Audit&apos; above to verify pool safety, wind spans, and accessories.
          </p>
        </div>
      )}

      {!loading && findings && (
        <div className="space-y-3">
          {findings.length === 0 ? (
            <div className="rounded-xl border border-brand-success/30 bg-brand-success/10 p-4 text-center">
              <CheckCircle2 className="mx-auto mb-2 text-brand-success" size={24} />
              <p className="text-xs font-bold text-brand-success">
                All Checks Passed!
              </p>
              <p className="text-[10.5px] text-brand-muted mt-1">
                Your design conforms to standard span guidelines and contains no major pool fencing warnings.
              </p>
            </div>
          ) : (
            <>
              {/* Critical Compliance / Errors */}
              {errors.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-[10px] font-bold uppercase tracking-wider text-brand-danger">
                    Critical Compliance Warnings ({errors.length})
                  </h4>
                  {errors.map((f, i) => (
                    <div
                      key={i}
                      className="flex items-start gap-2.5 rounded-lg border border-brand-danger/30 bg-brand-danger/10 p-3 text-xs text-brand-danger"
                    >
                      <ShieldAlert className="shrink-0 mt-0.5" size={14} />
                      <span>{f.message}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Structural / Warnings */}
              {warnings.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-[10px] font-bold uppercase tracking-wider text-brand-warning">
                    Structural Warnings ({warnings.length})
                  </h4>
                  {warnings.map((f, i) => (
                    <div
                      key={i}
                      className="flex items-start gap-2.5 rounded-lg border border-brand-warning/30 bg-brand-warning/10 p-3 text-xs text-brand-warning"
                    >
                      <AlertTriangle className="shrink-0 mt-0.5" size={14} />
                      <span>{f.message}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Suggestions / Accessories */}
              {infos.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-[10px] font-bold uppercase tracking-wider text-brand-primary">
                    Suggestions & Accessory Tips ({infos.length})
                  </h4>
                  {infos.map((f, i) => (
                    <div
                      key={i}
                      className="flex items-start gap-2.5 rounded-lg border border-brand-border bg-brand-card p-3 text-xs text-brand-text"
                    >
                      <Info className="shrink-0 mt-0.5 text-brand-primary" size={14} />
                      <span>{f.message}</span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
