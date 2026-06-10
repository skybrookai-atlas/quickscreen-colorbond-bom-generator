import { MessageSquareText, Mic, MicOff, Sparkles, Loader2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { parseDescription, type ParseResult } from "../../lib/describeFenceParser";
import { createVoiceInput, supportsVoiceInput } from "../../lib/voiceInput";
import { isSupabaseConfigured, supabase } from "../../lib/supabase";

function hasUsableParseResult(result: ParseResult) {
  const attrs = result.attributes;
  if (Number(attrs.runLengthMm?.value ?? 0) > 0) return true;
  if ((attrs.gates?.value ?? []).length > 0) return true;
  return Object.entries(attrs).some(([key, attr]) => {
    if (!attr || key === "runLengthMm" || key === "gates") return false;
    return attr.confidence !== "default";
  });
}

export function DescribeFenceBox({
  title = "Describe more attributes",
  compact = false,
  initialDescription = "",
  onApply,
}: {
  title?: string;
  compact?: boolean;
  initialDescription?: string;
  onApply: (result: ParseResult) => void;
}) {
  const [open, setOpen] = useState(!compact);
  const [text, setText] = useState(initialDescription);
  const [message, setMessage] = useState<string | null>(null);
  const [listening, setListening] = useState(false);
  const [parsing, setParsing] = useState(false);
  const voiceRef = useRef<ReturnType<typeof createVoiceInput> | null>(null);
  const canUseVoice = useMemo(() => supportsVoiceInput(), []);

  useEffect(() => {
    setText(initialDescription);
  }, [initialDescription]);

  useEffect(() => {
    return () => {
      voiceRef.current?.dispose();
      voiceRef.current = null;
    };
  }, []);

  async function parseNow() {
    if (!text.trim()) {
      const nextMessage = "Add a short fence description first.";
      setMessage(nextMessage);
      toast.error(nextMessage);
      return;
    }

    setParsing(true);
    setMessage(null);

    try {
      if (isSupabaseConfigured) {
        const { data: { session } } = await supabase.auth.getSession();
        const headers: Record<string, string> = {};
        if (session?.access_token) {
          headers["Authorization"] = `Bearer ${session.access_token}`;
        }

        const { data, error } = await supabase.functions.invoke("parse-job-description", {
          body: { description: text },
          headers,
        });

        if (error) {
          console.warn("AI parser error, falling back to local:", error);
          runLocalFallback();
        } else if (data) {
          if (data.error) {
            console.warn("AI parser returned error, falling back:", data.error);
            runLocalFallback();
          } else if (!hasUsableParseResult(data)) {
            setMessage("AI Parser: I could not find a usable fence length, gate, system, or setting in that description.");
          } else {
            onApply(data);
            setMessage(null);
            if (compact) setOpen(false);
            toast.success("AI parsed fence configuration!");
          }
        } else {
          runLocalFallback();
        }
      } else {
        runLocalFallback();
      }
    } catch (err) {
      console.warn("AI Parser exception, falling back:", err);
      runLocalFallback();
    } finally {
      setParsing(false);
    }

    function runLocalFallback() {
      const parsed = parseDescription(text);
      if (!hasUsableParseResult(parsed)) {
        setMessage("I could not find a usable fence length, gate, system, or setting in that description.");
        return;
      }
      onApply(parsed);
      setMessage(null);
      if (compact) setOpen(false);
      toast.success("Parsed fence configuration (offline mode).");
    }
  }

  function toggleMic() {
    if (!canUseVoice) return;
    if (listening) {
      voiceRef.current?.stop();
      setListening(false);
      return;
    }
    const voice = createVoiceInput({
      onTranscript: (transcript) => setText((value) => `${value}${value ? " " : ""}${transcript}`),
      onError: (message) => {
        toast.error(message);
        setListening(false);
        voiceRef.current = null;
      },
      onEnd: () => {
        setListening(false);
        voiceRef.current = null;
      },
    });
    if (!voice) return;
    voiceRef.current = voice;
    setListening(true);
    voice.start();
  }

  if (!open && compact) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-brand-primary/35 bg-brand-primary/10 text-brand-primary shadow-sm transition-all hover:-translate-y-0.5 hover:border-brand-primary hover:bg-brand-primary hover:text-white hover:shadow-md"
        title={title}
        aria-label={title}
      >
        <MessageSquareText size={32} strokeWidth={2.4} />
      </button>
    );
  }

  return (
    <section className="rounded-2xl border border-brand-border/70 bg-brand-card p-3 shadow-sm">
      <div className="mb-2 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => compact && setOpen((value) => !value)}
          className="text-left text-sm font-black text-brand-text"
        >
          {title}
        </button>
        {compact && (
          <button type="button" onClick={() => setOpen(false)} className="text-xs font-bold text-brand-muted hover:text-brand-primary">
            Collapse
          </button>
        )}
      </div>
      {open && (
        <div className="space-y-3">
          <div className="relative">
            <textarea
              value={text}
              onChange={(event) => setText(event.target.value)}
              placeholder="e.g. 30m of 1.8m slat fence in Monument with one gate"
              className="min-h-28 w-full resize-y rounded-xl border border-brand-border bg-brand-bg px-3 py-3 pr-11 text-sm font-semibold text-brand-text outline-none transition-colors focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20"
              disabled={parsing}
            />
            {canUseVoice && (
              <button
                type="button"
                onClick={toggleMic}
                disabled={parsing}
                className={`absolute right-2 top-2 rounded-lg border p-2 ${listening ? "border-brand-danger text-brand-danger" : "border-brand-border text-brand-muted hover:text-brand-primary"}`}
                title={listening ? "Stop dictation" : "Dictate description"}
              >
                {listening ? <MicOff size={16} /> : <Mic size={16} />}
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={parseNow}
            disabled={parsing}
            className="inline-flex items-center gap-1.5 rounded-lg bg-brand-primary px-3 py-2 text-sm font-black text-white hover:bg-brand-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {parsing ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                Parsing...
              </>
            ) : (
              <>
                <Sparkles size={14} />
                Apply AI Parse
              </>
            )}
          </button>
          {message && (
            <p className="rounded-lg border border-brand-border/70 bg-brand-bg px-3 py-2 text-xs font-bold text-brand-muted">
              {message}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
