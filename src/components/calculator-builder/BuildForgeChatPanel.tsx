import React, { useState, useEffect, useRef } from "react";
import { supabase } from "../../lib/supabase";
import { 
  Send, 
  Sparkles, 
  Check, 
  AlertCircle, 
  Loader2, 
  CheckCircle
} from "lucide-react";
import { toast } from "sonner";


// Wizard state machine list
type WizardState = 
  | "PATH"
  | "BRANDING"
  | "CATALOGUE"
  | "VARIABLES"
  | "BOM MATH"
  | "MAPPING"
  | "COMPLIANCE"
  | "TEST"
  | "SUBMIT";

const WIZARD_STEPS: { state: WizardState; label: string }[] = [
  { state: "PATH", label: "Path" },
  { state: "BRANDING", label: "Branding" },
  { state: "CATALOGUE", label: "Catalogue" },
  { state: "VARIABLES", label: "Variables" },
  { state: "BOM MATH", label: "BOM Math" },
  { state: "MAPPING", label: "Mapping" },
  { state: "COMPLIANCE", label: "Compliance" },
  { state: "TEST", label: "Test" },
  { state: "SUBMIT", label: "Submit" },
];

interface Message {
  id: string;
  sender: "user" | "agent";
  text: string;
  actionsApplied?: { action: string; success: boolean; details?: string }[];
}

interface BuildForgeChatPanelProps {
  onApplyMeta: (field: string, value: string) => void;
  onAddVariable: (variable: any) => void;
  onAddRule: (rule: any) => void;
  onMapSelector: (selector: any) => void;
  onAddTest: (test: any) => void;
  onComplete: () => void;
  currentValues: {
    name: string;
    description: string;
    supplierId: string;
    archetypeId: string;
    visibility: string;
    variables: any[];
    rules: any[];
    selectors: any[];
    tests: any[];
  };
}

export function BuildForgeChatPanel({
  onApplyMeta,
  onAddVariable,
  onAddRule,
  onMapSelector,
  onAddTest,
  onComplete,
  currentValues
}: BuildForgeChatPanelProps) {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      sender: "agent",
      text: "Hi! I'm Build Forge, your AI fencing calculator architect. I'll help you configure your variables, math rules, catalog mappings, and test cases.\n\nType **'hello'** or **'start'** to begin our build session!"
    }
  ]);
  const [inputText, setInputText] = useState("");
  const [isConnecting, setIsConnecting] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [currentState, setCurrentState] = useState<WizardState>("PATH");
  
  // Track details and stats
  const [messageCount, setMessageCount] = useState(0);
  const maxMessages = 60; // early-stage default limit

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll chat history
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isStreaming]);

  // Open Build Forge Session on mount
  useEffect(() => {
    initializeSession();
  }, []);

  const initializeSession = async () => {
    setIsConnecting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Please login to access Build Forge.");
        return;
      }

      // Invoke Supabase Edge Function to create a session
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/buildforge`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ action: "session" }),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || "Failed to create agent session");
      }

      const data = await response.json();
      setSessionId(data.sessionId);
      console.log("[BuildForge] Session established:", data);
    } catch (err) {
      console.error(err);
      toast.error(`Session error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsConnecting(false);
    }
  };

  // Helper to parse builder-action fenced blocks from agent text
  const parseAndApplyActions = (text: string): { cleanText: string; actions: any[] } => {
    const actions: any[] = [];
    const regex = /```builder-action\n([\s\S]*?)\n```/g;
    let match;
    let cleanText = text;

    while ((match = regex.exec(text)) !== null) {
      try {
        const actionObj = JSON.parse(match[1].trim());
        actions.push(actionObj);
        // Remove the code block from the clean text
        cleanText = cleanText.replace(match[0], "");
      } catch (err) {
        console.error("Failed to parse builder-action block:", err, match[1]);
      }
    }

    // Clean up double newlines
    cleanText = cleanText.trim().replace(/\n{3,}/g, "\n\n");
    return { cleanText, actions };
  };

  // Bridge that applies parsed actions to the visual builder state
  const executeAction = (actionObj: any): { success: boolean; details?: string } => {
    console.log("[BuildForge] Executing action:", actionObj);
    try {
      switch (actionObj.action) {
        case "set_meta": {
          if (!actionObj.field || actionObj.value === undefined) {
            return { success: false, details: "Missing field or value for set_meta" };
          }
          // Enforce hard constraint: cannot rename canonical product names or silently drop compliance
          if (actionObj.field === "archetype" && !actionObj.value) {
            return { success: false, details: "Archetype cannot be empty" };
          }
          onApplyMeta(actionObj.field, actionObj.value);
          return { success: true, details: `Set metadata ${actionObj.field} = "${actionObj.value}"` };
        }
        case "add_variable": {
          if (!actionObj.variable || !actionObj.variable.key) {
            return { success: false, details: "Missing variable payload" };
          }
          onAddVariable(actionObj.variable);
          return { success: true, details: `Added variable "${actionObj.variable.key}"` };
        }
        case "add_rule": {
          if (!actionObj.rule || !actionObj.rule.outputKey) {
            return { success: false, details: "Missing rule details" };
          }
          // Phase 2 target: execute as stub for MVP
          console.warn("[BuildForge] add_rule stub executed for:", actionObj.rule);
          onAddRule(actionObj.rule);
          return { success: true, details: `[STUB] Added rule "${actionObj.rule.outputKey}"` };
        }
        case "map_selector": {
          if (!actionObj.selector || !actionObj.selector.canonical_name) {
            return { success: false, details: "Missing selector details" };
          }
          // Phase 2 target: execute as stub for MVP
          console.warn("[BuildForge] map_selector stub executed for:", actionObj.selector);
          onMapSelector(actionObj.selector);
          return { success: true, details: `[STUB] Mapped selector "${actionObj.selector.canonical_name}"` };
        }
        case "add_test": {
          if (!actionObj.test || !actionObj.test.name) {
            return { success: false, details: "Missing test details" };
          }
          // Phase 2 target: execute as stub for MVP
          console.warn("[BuildForge] add_test stub executed for:", actionObj.test);
          onAddTest(actionObj.test);
          return { success: true, details: `[STUB] Added test case "${actionObj.test.name}"` };
        }
        case "complete": {
          // Phase 2 target: execute as stub for MVP
          console.warn("[BuildForge] complete stub executed");
          onComplete();
          return { success: true, details: "[STUB] Build complete checklist triggered" };
        }
        default:
          return { success: false, details: `Unknown action type: "${actionObj.action}"` };
      }
    } catch (err) {
      return { success: false, details: String(err) };
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || isStreaming || isConnecting) return;

    if (messageCount >= maxMessages) {
      toast.error("Message limit reached for this session.");
      return;
    }

    const userMsg = inputText.trim();
    setInputText("");
    setMessageCount(prev => prev + 1);

    // Add user message to history
    const userMsgId = `user-${Date.now()}`;
    setMessages(prev => [...prev, { id: userMsgId, sender: "user", text: userMsg }]);

    // Add temporary empty agent message for streaming
    const agentMsgId = `agent-${Date.now()}`;
    setMessages(prev => [...prev, { id: agentMsgId, sender: "agent", text: "" }]);

    setIsStreaming(true);
    let accumulatedText = "";

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Unauthorized");

      // Invoke Supabase Edge Function with streaming
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/buildforge`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          action: "message",
          sessionId: sessionId || "bf-session-fallback",
          text: userMsg,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to relay message to agent");
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error("Stream reader not supported on browser");
      }

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        // Chunks are formatted as: data: { type: 'text' | 'action', content: '...' }\n\n
        const lines = chunk.split("\n\n");
        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const sseData = JSON.parse(line.substring(6));
              if (sseData.error) {
                throw new Error(sseData.error);
              }
              if (sseData.type === "text") {
                accumulatedText += sseData.content;
                // Update agent message in real-time
                setMessages(prev => prev.map(m => {
                  if (m.id === agentMsgId) {
                    return { ...m, text: accumulatedText };
                  }
                  return m;
                }));
              }
            } catch (jsonErr) {
              // Ignore partial JSON blocks during stream splits
            }
          }
        }
      }

      // Stream fully completed! Parse and apply any actions found in text.
      const { cleanText, actions } = parseAndApplyActions(accumulatedText);
      const appliedResults = actions.map(action => {
        const res = executeAction(action);
        return { action: action.action, success: res.success, details: res.details };
      });

      // Update active wizard state machine step based on conversation path
      updateWizardState(cleanText, userMsg);

      // Render prose and attach feedback metadata
      setMessages(prev => prev.map(m => {
        if (m.id === agentMsgId) {
          return {
            ...m,
            text: cleanText || accumulatedText,
            actionsApplied: appliedResults.length > 0 ? appliedResults : undefined
          };
        }
        return m;
      }));

      // Send Action ACK back to the agent in the background so it is aware of form state
      if (appliedResults.length > 0) {
        console.log("[BuildForge] Sending ACK back to agent:", appliedResults);
        // Note: For Phase 1 MVP, we log the ack locally. In Phase 2, this sends an inline message to sync agent memory.
      }

    } catch (err) {
      console.error(err);
      toast.error(`Relay error: ${err instanceof Error ? err.message : String(err)}`);
      setMessages(prev => prev.map(m => {
        if (m.id === agentMsgId) {
          return {
            ...m,
            text: "Oops, I encountered a connection issue. Please retry or verify your inputs."
          };
        }
        return m;
      }));
    } finally {
      setIsStreaming(false);
    }
  };

  // Simple heuristics to guide the wizard step progress bar based on message context
  const updateWizardState = (agentResponseText: string, userMessage: string) => {
    const textLower = agentResponseText.toLowerCase() + " " + userMessage.toLowerCase();
    
    if (textLower.includes("complete") || textLower.includes("submit")) {
      setCurrentState("SUBMIT");
    } else if (textLower.includes("test") || textLower.includes("regression")) {
      setCurrentState("TEST");
    } else if (textLower.includes("compliance") || textLower.includes("standard") || textLower.includes("as1926")) {
      setCurrentState("COMPLIANCE");
    } else if (textLower.includes("map") || textLower.includes("sku") || textLower.includes("selector")) {
      setCurrentState("MAPPING");
    } else if (textLower.includes("rule") || textLower.includes("formula") || textLower.includes("math")) {
      setCurrentState("BOM MATH");
    } else if (textLower.includes("variable") || textLower.includes("height_mm") || textLower.includes("slat_gap")) {
      setCurrentState("VARIABLES");
    } else if (textLower.includes("ingest") || textLower.includes("catalog")) {
      setCurrentState("CATALOGUE");
    } else if (textLower.includes("branding") || textLower.includes("name") || textLower.includes("description")) {
      setCurrentState("BRANDING");
    } else if (textLower.includes("archetype") || textLower.includes("tweak")) {
      setCurrentState("PATH");
    }
  };

  return (
    <div className="flex flex-col bg-brand-card border border-brand-border rounded-2xl h-[calc(100vh-14rem)] overflow-hidden shadow-xl">
      {/* Panel Header */}
      <div className="p-4 border-b border-brand-border/60 bg-brand-bg/30 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="text-brand-primary animate-pulse" size={18} />
          <div>
            <h3 className="text-sm font-black text-brand-text flex items-center gap-1.5">
              Build Forge Copilot
              {isConnecting && <Loader2 size={12} className="animate-spin text-brand-primary" />}
            </h3>
            <p className="text-[10px] text-brand-muted">Conversational wizard helping you build this calculator.</p>
          </div>
        </div>
        <div className="text-[10px] bg-brand-primary/10 border border-brand-primary/20 text-brand-primary px-2 py-0.5 rounded font-bold">
          {messageCount} / {maxMessages} messages
        </div>
      </div>

      {/* Step Indicator Progress Bar */}
      <div className="border-b border-brand-border/40 px-3 py-2 bg-brand-bg/10 overflow-x-auto flex gap-3 whitespace-nowrap scrollbar-thin">
        {WIZARD_STEPS.map((step, i) => {
          const isActive = currentState === step.state;
          const isCompleted = WIZARD_STEPS.findIndex(s => s.state === currentState) > i;
          return (
            <span 
              key={step.state} 
              className={`flex items-center gap-1 text-[10px] font-extrabold uppercase transition-all ${
                isActive 
                  ? "text-brand-primary" 
                  : isCompleted 
                    ? "text-brand-success" 
                    : "text-brand-muted"
              }`}
            >
              {isCompleted ? <CheckCircle size={10} /> : <span className="w-3.5 h-3.5 rounded-full border flex items-center justify-center text-[8px]">{i + 1}</span>}
              {step.label}
            </span>
          );
        })}
      </div>

      {/* Diagnostics stats of current calculator configuration */}
      <div className="bg-brand-bg/25 border-b border-brand-border/40 px-4 py-2 text-[10px] text-brand-muted flex justify-between gap-2">
        <span>Config: <strong>{currentValues.name || "Untitled"}</strong></span>
        <div className="flex gap-2">
          <span>Vars: <strong>{currentValues.variables.length}</strong></span>
          <span>Rules: <strong>{currentValues.rules.length}</strong></span>
          <span>SKUs: <strong>{currentValues.selectors.length}</strong></span>
          <span>Tests: <strong>{currentValues.tests.length}</strong></span>
        </div>
      </div>

      {/* Chat Messages Log */}
      <div className="flex-1 p-4 overflow-y-auto space-y-4 bg-brand-bg/5">
        {messages.map((m) => {
          const isAgent = m.sender === "agent";
          return (
            <div 
              key={m.id} 
              className={`flex flex-col max-w-[85%] ${
                isAgent ? "self-start mr-auto" : "self-end ml-auto items-end"
              }`}
            >
              <div 
                className={`rounded-2xl px-4 py-3 text-xs leading-relaxed ${
                  isAgent 
                    ? "bg-brand-bg/60 border border-brand-border/60 text-brand-text rounded-tl-sm" 
                    : "bg-brand-primary text-white rounded-tr-sm"
                }`}
              >
                {m.text.split("\n").map((para, i) => (
                  <p key={i} className={i > 0 ? "mt-2" : ""}>{para}</p>
                ))}
              </div>

              {/* Action applied validation feed */}
              {isAgent && m.actionsApplied && (
                <div className="mt-2 space-y-1 w-full">
                  {m.actionsApplied.map((act, i) => (
                    <div 
                      key={i} 
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-[10px] font-medium ${
                        act.success 
                          ? "bg-brand-success/5 border-brand-success/20 text-brand-success" 
                          : "bg-brand-danger/5 border-brand-danger/20 text-brand-danger"
                      }`}
                    >
                      {act.success ? <Check size={12} /> : <AlertCircle size={12} />}
                      <span className="truncate">{act.details}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
        {isStreaming && (
          <div className="self-start mr-auto bg-brand-bg/40 border border-brand-border/40 rounded-2xl rounded-tl-sm px-4 py-3 text-xs text-brand-muted flex items-center gap-1.5 animate-pulse">
            <Loader2 size={12} className="animate-spin text-brand-primary" />
            Build Forge is drafting system configuration...
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Message Input Form */}
      <form onSubmit={handleSendMessage} className="p-3 border-t border-brand-border/60 bg-brand-bg/30 flex gap-2">
        <input 
          type="text" 
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder={isConnecting ? "Initializing session..." : "Ask Build Forge to build a custom slat system..."}
          disabled={isStreaming || isConnecting}
          className="flex-1 bg-brand-bg border border-brand-border focus:border-brand-primary/60 rounded-xl px-4 py-2.5 text-xs outline-none transition text-brand-text disabled:opacity-50"
        />
        <button 
          type="submit" 
          disabled={isStreaming || isConnecting || !inputText.trim()}
          className="bg-brand-primary hover:bg-brand-primary/95 text-white p-2.5 rounded-xl transition disabled:opacity-50 shrink-0"
        >
          <Send size={14} />
        </button>
      </form>
    </div>
  );
}
