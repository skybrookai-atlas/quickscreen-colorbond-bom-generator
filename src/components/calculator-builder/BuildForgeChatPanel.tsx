import React, { useState, useEffect, useRef } from "react";
import { supabase } from "../../lib/supabase";
import { 
  Send, 
  Sparkles, 
  Check, 
  AlertCircle, 
  Loader2, 
  CheckCircle,
  Brain,
  Plus,
  Trash2,
  X,
  BookOpen,
  History
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

type TeacherTab = "identity" | "knowledge" | "corrections" | "spawn";

export function BuildForgeChatPanel({
  onApplyMeta,
  onAddVariable,
  onAddRule,
  onMapSelector,
  onAddTest,
  onComplete,
  currentValues
}: BuildForgeChatPanelProps) {
  const [agentMode, setAgentMode] = useState<"live" | "mock">("live");
  
  // Agent definitions from Supabase
  const [agents, setAgents] = useState<any[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string>("");
  const [mockSessionId, setMockSessionId] = useState<string | null>(null);
  const [liveSessionIds, setLiveSessionIds] = useState<Record<string, string>>({}); // agentId -> sessionId

  // Conversations map for multi-agent support
  const [conversations, setConversations] = useState<Record<string, Message[]>>({});
  const [mockMessages, setMockMessages] = useState<Message[]>([
    {
      id: "welcome-mock",
      sender: "agent",
      text: "Hi! I'm Build Forge, your AI fencing calculator architect. I'll help you configure your variables, math rules, catalog mappings, and test cases.\n\nType **'hello'** or **'start'** to begin our build session!"
    }
  ]);

  const [inputText, setInputText] = useState("");
  const [isConnecting, setIsConnecting] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [currentState, setCurrentState] = useState<WizardState>("PATH");
  const [messageCount, setMessageCount] = useState(0);
  const maxMessages = 100;

  // Training Portal states
  const [showTeacher, setShowTeacher] = useState(false);
  const [teacherTab, setTeacherTab] = useState<TeacherTab>("identity");
  
  // Identity edit state
  const [agentName, setAgentName] = useState("");
  const [agentDesc, setAgentDesc] = useState("");
  const [agentPrompt, setAgentPrompt] = useState("");
  const [agentModel, setAgentModel] = useState("claude-3-5-sonnet-20241022");
  const [useSearchTool, setUseSearchTool] = useState(true);

  // Knowledge base state
  const [knowledgeList, setKnowledgeList] = useState<any[]>([]);
  const [newAssetTitle, setNewAssetTitle] = useState("");
  const [newAssetType, setNewAssetType] = useState<"text" | "file" | "image" | "video">("text");
  const [newAssetBody, setNewAssetBody] = useState("");

  // Corrections log state
  const [correctionsList, setCorrectionsList] = useState<any[]>([]);
  const [newCorrPattern, setNewCorrPattern] = useState("");
  const [newCorrNotes, setNewCorrNotes] = useState("");
  const [newCorrExpect, setNewCorrExpect] = useState("");

  // Spawn agent state
  const [spawnName, setSpawnName] = useState("");
  const [spawnDesc, setSpawnDesc] = useState("");
  const [spawnPrompt, setSpawnPrompt] = useState("");
  const [spawnModel, setSpawnModel] = useState("claude-3-5-sonnet-20241022");

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Fetch agents list on mount
  useEffect(() => {
    fetchAgents();
  }, []);

  // Fetch agent details (knowledge, corrections) when active agent changes
  useEffect(() => {
    if (selectedAgentId && agentMode === "live") {
      const active = agents.find(a => a.id === selectedAgentId);
      if (active) {
        setAgentName(active.name);
        setAgentDesc(active.description || "");
        setAgentPrompt(active.system_prompt);
        setAgentModel(active.model);
        setUseSearchTool(active.tools_config?.includes("search_catalog") ?? true);
        fetchAgentDetails(active.id);
      }
    }
  }, [selectedAgentId, agents, agentMode]);

  // Sync session initialization when agent ID or mode changes
  useEffect(() => {
    if (agentMode === "live" && selectedAgentId) {
      const sid = liveSessionIds[selectedAgentId];
      if (!sid) {
        initializeSession("live", selectedAgentId);
      }
    } else if (agentMode === "mock" && !mockSessionId) {
      initializeSession("mock");
    }
  }, [agentMode, selectedAgentId]);

  // Scroll chat history
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conversations, mockMessages, selectedAgentId, agentMode, isStreaming]);

  // Fetch all agents
  const fetchAgents = async () => {
    try {
      const { data } = await supabase
        .from("agent_configs")
        .select("*")
        .order("created_at", { ascending: true });
      if (data && data.length > 0) {
        setAgents(data);
        const main = data.find(a => !a.is_spawned);
        if (main && !selectedAgentId) {
          setSelectedAgentId(main.id);
        }
      }
    } catch (err) {
      console.error("Failed to fetch agents:", err);
    }
  };

  // Fetch training sub-details for selected agent
  const fetchAgentDetails = async (id: string) => {
    try {
      const [knowledgeRes, correctionsRes] = await Promise.all([
        supabase.from("agent_knowledge").select("*").eq("agent_id", id).order("created_at", { ascending: false }),
        supabase.from("agent_corrections").select("*").eq("agent_id", id).order("created_at", { ascending: false })
      ]);
      setKnowledgeList(knowledgeRes.data || []);
      setCorrectionsList(correctionsRes.data || []);
    } catch (err) {
      console.error("Failed to fetch agent details:", err);
    }
  };

  // Sync local file configuration during development
  const syncToRepo = async (agentConfig: any) => {
    if (import.meta.env.DEV) {
      try {
        const payload = {
          filename: `${agentConfig.name.toLowerCase().replace(/\s+/g, "-")}-config.json`,
          content: JSON.stringify(agentConfig, null, 2)
        };
        const res = await fetch("/api/agent-sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
        if (res.ok) {
          const syncData = await res.json();
          console.log("[BuildForge] Agent configuration synced to local repository at path:", syncData.path);
        }
      } catch (err) {
        console.warn("Vite repo sync failed (non-blocking):", err);
      }
    }
  };

  // Initialize session
  const initializeSession = async (mode: "live" | "mock", agentId?: string) => {
    setIsConnecting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Please login to access Build Forge.");
        return;
      }

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/buildforge`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ 
          action: "session", 
          agentMode: mode, 
          agentId: agentId 
        }),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || "Failed to create agent session");
      }

      const data = await response.json();
      if (mode === "live" && agentId) {
        setLiveSessionIds(prev => ({ ...prev, [agentId]: data.sessionId }));
      } else {
        setMockSessionId(data.sessionId);
      }
    } catch (err) {
      console.error(err);
      toast.error(`Session error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsConnecting(false);
    }
  };

  // Save active agent identity changes
  const handleSaveIdentity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAgentId) return;
    toast.loading("Saving agent config...", { id: "save-agent" });

    try {
      const toolsConfig = useSearchTool ? ["search_catalog"] : [];
      
      const { data, error } = await supabase
        .from("agent_configs")
        .update({
          name: agentName,
          description: agentDesc,
          system_prompt: agentPrompt,
          model: agentModel,
          tools_config: toolsConfig
        })
        .eq("id", selectedAgentId)
        .select()
        .single();

      if (error) throw error;
      
      toast.success("Agent settings successfully saved!", { id: "save-agent" });
      setAgents(prev => prev.map(a => a.id === selectedAgentId ? data : a));
      await syncToRepo(data);
    } catch (err) {
      console.error(err);
      toast.error(`Save failed: ${err instanceof Error ? err.message : String(err)}`, { id: "save-agent" });
    }
  };

  // Add knowledge asset
  const handleAddKnowledge = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAgentId || !newAssetTitle) return;
    toast.loading("Adding training asset...", { id: "add-asset" });

    try {
      const { data, error } = await supabase
        .from("agent_knowledge")
        .insert({
          agent_id: selectedAgentId,
          title: newAssetTitle,
          content_type: newAssetType,
          content_body: newAssetBody
        })
        .select()
        .single();

      if (error) throw error;
      
      toast.success("Learned asset added successfully!", { id: "add-asset" });
      setKnowledgeList(prev => [data, ...prev]);
      setNewAssetTitle("");
      setNewAssetBody("");
    } catch (err) {
      toast.error(String(err), { id: "add-asset" });
    }
  };

  // Add behavioral correction
  const handleAddCorrection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAgentId || !newCorrPattern) return;
    toast.loading("Adding behavioral correction rule...", { id: "add-corr" });

    try {
      const { data, error } = await supabase
        .from("agent_corrections")
        .insert({
          agent_id: selectedAgentId,
          trigger_pattern: newCorrPattern,
          correction_notes: newCorrNotes,
          expected_behavior: newCorrExpect
        })
        .select()
        .single();

      if (error) throw error;

      toast.success("Correction logged in few-shot memory!", { id: "add-corr" });
      setCorrectionsList(prev => [data, ...prev]);
      setNewCorrPattern("");
      setNewCorrNotes("");
      setNewCorrExpect("");
    } catch (err) {
      toast.error(String(err), { id: "add-corr" });
    }
  };

  // Spawn new sub-agent
  const handleSpawnAgent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!spawnName) return;
    toast.loading("Spawning new sub-agent...", { id: "spawn-agent" });

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not logged in");

      const { data: profile } = await supabase
        .from("profiles")
        .select("org_id")
        .eq("id", session.user.id)
        .single();

      if (!profile) throw new Error("Profile not found");

      const { data, error } = await supabase
        .from("agent_configs")
        .insert({
          org_id: profile.org_id,
          name: spawnName,
          description: spawnDesc,
          system_prompt: spawnPrompt || `You are an assistant.`,
          model: spawnModel,
          is_spawned: true,
          parent_agent_id: selectedAgentId
        })
        .select()
        .single();

      if (error) throw error;

      toast.success(`Spawned sub-agent ${spawnName}!`, { id: "spawn-agent" });
      setAgents(prev => [...prev, data]);
      setSelectedAgentId(data.id);
      setSpawnName("");
      setSpawnDesc("");
      setSpawnPrompt("");
      setShowTeacher(false);
      await syncToRepo(data);
    } catch (err) {
      toast.error(String(err), { id: "spawn-agent" });
    }
  };

  // Delete an agent
  const handleDeleteAgent = async (id: string) => {
    if (confirm("Are you sure you want to delete this agent? This cannot be undone.")) {
      try {
        const { error } = await supabase.from("agent_configs").delete().eq("id", id);
        if (error) throw error;
        toast.success("Agent deleted.");
        setAgents(prev => prev.filter(a => a.id !== id));
        setSelectedAgentId(agents[0]?.id || "");
      } catch (err) {
        toast.error(String(err));
      }
    }
  };

  // Parse action blocks
  const parseAndApplyActions = (text: string): { cleanText: string; actions: any[] } => {
    const actions: any[] = [];
    const regex = /```builder-action\n([\s\S]*?)\n```/g;
    let match;
    let cleanText = text;

    while ((match = regex.exec(text)) !== null) {
      try {
        const actionObj = JSON.parse(match[1].trim());
        actions.push(actionObj);
        cleanText = cleanText.replace(match[0], "");
      } catch (err) {
        console.error("Failed to parse builder-action block:", err, match[1]);
      }
    }
    cleanText = cleanText.trim().replace(/\n{3,}/g, "\n\n");
    return { cleanText, actions };
  };

  // Apply visual builder actions
  const executeAction = (actionObj: any): { success: boolean; details?: string } => {
    try {
      switch (actionObj.action) {
        case "set_meta": {
          if (!actionObj.field || actionObj.value === undefined) {
            return { success: false, details: "Missing field or value for set_meta" };
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
          onAddRule(actionObj.rule);
          return { success: true, details: `Added rule "${actionObj.rule.outputKey}"` };
        }
        case "map_selector": {
          if (!actionObj.selector || !actionObj.selector.canonical_name) {
            return { success: false, details: "Missing selector details" };
          }
          onMapSelector(actionObj.selector);
          return { success: true, details: `Mapped selector "${actionObj.selector.canonical_name}"` };
        }
        case "add_test": {
          if (!actionObj.test || !actionObj.test.name) {
            return { success: false, details: "Missing test details" };
          }
          onAddTest(actionObj.test);
          return { success: true, details: `Added test case "${actionObj.test.name}"` };
        }
        case "complete": {
          onComplete();
          return { success: true, details: "Build complete checklist triggered" };
        }
        default:
          return { success: false, details: `Unknown action: "${actionObj.action}"` };
      }
    } catch (err) {
      return { success: false, details: String(err) };
    }
  };

  // Relays chat message to Supabase Edge Function (Deno)
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

    const activeSessionId = agentMode === "live" ? liveSessionIds[selectedAgentId] : mockSessionId;
    const activeMessages = agentMode === "live" ? conversations[selectedAgentId] || [] : mockMessages;

    // Construct local user message
    const userMsgId = `user-${Date.now()}`;
    const newUserMsg: Message = { id: userMsgId, sender: "user", text: userMsg };

    // Update active conversation history
    if (agentMode === "live") {
      setConversations(prev => ({
        ...prev,
        [selectedAgentId]: [...(prev[selectedAgentId] || []), newUserMsg]
      }));
    } else {
      setMockMessages(prev => [...prev, newUserMsg]);
    }

    // Add temporary empty assistant message for stream chunk writing
    const agentMsgId = `agent-${Date.now()}`;
    const newAgentMsg: Message = { id: agentMsgId, sender: "agent", text: "" };

    if (agentMode === "live") {
      setConversations(prev => ({
        ...prev,
        [selectedAgentId]: [...(prev[selectedAgentId] || []), newAgentMsg]
      }));
    } else {
      setMockMessages(prev => [...prev, newAgentMsg]);
    }

    setIsStreaming(true);
    let accumulatedText = "";

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Unauthorized");

      // Compile message history list for stateless Claude request
      const historyPayload = activeMessages
        .filter(m => !m.id.startsWith("welcome"))
        .map(m => ({
          role: m.sender === "user" ? "user" : "assistant",
          content: m.text
        }));

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/buildforge`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          action: "message",
          agentMode: agentMode,
          agentId: agentMode === "live" ? selectedAgentId : undefined,
          sessionId: activeSessionId || "bf-session-fallback",
          text: userMsg,
          history: historyPayload
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to relay message to agent");
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) throw new Error("No body reader supported");

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split("\n\n");
        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const sseData = JSON.parse(line.substring(6));
              if (sseData.error) throw new Error(sseData.error);
              if (sseData.type === "text") {
                accumulatedText += sseData.content;
                
                // Write chunks to live state
                if (agentMode === "live") {
                  setConversations(prev => ({
                    ...prev,
                    [selectedAgentId]: (prev[selectedAgentId] || []).map(m => 
                      m.id === agentMsgId ? { ...m, text: accumulatedText } : m
                    )
                  }));
                } else {
                  setMockMessages(prev => prev.map(m => 
                    m.id === agentMsgId ? { ...m, text: accumulatedText } : m
                  ));
                }
              }
            } catch (_err) {
              // Ignore partial JSON splits
            }
          }
        }
      }

      // Sync and execute pre-fill action blocks
      const { cleanText, actions } = parseAndApplyActions(accumulatedText);
      const appliedResults = actions.map(action => {
        const res = executeAction(action);
        return { action: action.action, success: res.success, details: res.details };
      });

      updateWizardState(cleanText, userMsg);

      // Finalize text response
      if (agentMode === "live") {
        setConversations(prev => ({
          ...prev,
          [selectedAgentId]: (prev[selectedAgentId] || []).map(m => 
            m.id === agentMsgId 
              ? { ...m, text: cleanText || accumulatedText, actionsApplied: appliedResults.length > 0 ? appliedResults : undefined } 
              : m
          )
        }));
      } else {
        setMockMessages(prev => prev.map(m => 
          m.id === agentMsgId 
            ? { ...m, text: cleanText || accumulatedText, actionsApplied: appliedResults.length > 0 ? appliedResults : undefined } 
            : m
        ));
      }

    } catch (err) {
      console.error(err);
      toast.error(`Relay error: ${err instanceof Error ? err.message : String(err)}`);
      
      const errMsg = "Oops, I encountered a connection issue. Please verify your internet connection or check your Supabase secrets settings.";
      if (agentMode === "live") {
        setConversations(prev => ({
          ...prev,
          [selectedAgentId]: (prev[selectedAgentId] || []).map(m => 
            m.id === agentMsgId ? { ...m, text: errMsg } : m
          )
        }));
      } else {
        setMockMessages(prev => prev.map(m => m.id === agentMsgId ? { ...m, text: errMsg } : m));
      }
    } finally {
      setIsStreaming(false);
    }
  };

  const updateWizardState = (agentResponseText: string, userMessage: string) => {
    const textLower = agentResponseText.toLowerCase() + " " + userMessage.toLowerCase();
    if (textLower.includes("complete")) setCurrentState("SUBMIT");
    else if (textLower.includes("test")) setCurrentState("TEST");
    else if (textLower.includes("compliance")) setCurrentState("COMPLIANCE");
    else if (textLower.includes("map")) setCurrentState("MAPPING");
    else if (textLower.includes("rule")) setCurrentState("BOM MATH");
    else if (textLower.includes("variable")) setCurrentState("VARIABLES");
    else if (textLower.includes("catalog")) setCurrentState("CATALOGUE");
    else if (textLower.includes("branding")) setCurrentState("BRANDING");
  };

  // Welcome message for active agent conversation
  const activeAgent = agents.find(a => a.id === selectedAgentId);
  const activeMessages = agentMode === "live" 
    ? conversations[selectedAgentId] || [
        {
          id: `welcome-${selectedAgentId}`,
          sender: "agent",
          text: activeAgent
            ? `Hello! I am your custom agent **${activeAgent.name}** (${activeAgent.description || "No description"}).\n\nHow can I help you configure your fence calculator today?`
            : "Welcome to the Live Fencing Builder Agent! Tell me what kind of calculator we are designing today!"
        }
      ]
    : mockMessages;

  return (
    <div className="relative flex flex-col bg-brand-card border border-brand-border rounded-2xl h-[calc(100vh-14rem)] overflow-hidden shadow-xl">
      
      {/* Panel Header */}
      <div className="p-4 border-b border-brand-border/60 bg-brand-bg/30 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <Sparkles className="text-brand-primary animate-pulse shrink-0" size={18} />
          
          {agentMode === "live" && agents.length > 0 ? (
            <select
              value={selectedAgentId}
              onChange={(e) => setSelectedAgentId(e.target.value)}
              className="bg-brand-bg border border-brand-border text-brand-text text-xs font-extrabold rounded-lg px-2.5 py-1.5 outline-none focus:border-brand-primary/60 cursor-pointer min-w-0 max-w-[150px] sm:max-w-[180px] truncate"
            >
              {agents.map(a => (
                <option key={a.id} value={a.id}>
                  {a.name} {a.is_spawned ? "(Spawned)" : ""}
                </option>
              ))}
            </select>
          ) : (
            <h3 className="text-sm font-black text-brand-text truncate">Mock Copilot</h3>
          )}
          {isConnecting && <Loader2 size={12} className="animate-spin text-brand-primary" />}
        </div>
        
        <div className="flex items-center gap-2 shrink-0">
          {agentMode === "live" && (
            <button
              type="button"
              onClick={() => setShowTeacher(true)}
              className="p-1.5 border border-brand-border hover:border-brand-primary/60 text-brand-muted hover:text-brand-primary rounded-xl transition"
              title="Open Training & Spawn Portal"
            >
              <Brain size={16} />
            </button>
          )}
          
          <div className="flex bg-brand-bg border border-brand-border/85 rounded-xl p-0.5 select-none text-[10px]">
            <button
              type="button"
              onClick={() => {
                if (isStreaming) return;
                setAgentMode("live");
              }}
              className={`px-2.5 py-1 font-extrabold rounded-lg transition-all ${
                agentMode === "live" ? "bg-brand-primary text-white" : "text-brand-muted hover:text-brand-text"
              }`}
            >
              Live Agent
            </button>
            <button
              type="button"
              onClick={() => {
                if (isStreaming) return;
                setAgentMode("mock");
              }}
              className={`px-2.5 py-1 font-extrabold rounded-lg transition-all ${
                agentMode === "mock" ? "bg-brand-primary text-white" : "text-brand-muted hover:text-brand-text"
              }`}
            >
              Mock
            </button>
          </div>
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
        </div>
      </div>

      {/* Chat Messages Log */}
      <div className="flex-1 p-4 overflow-y-auto space-y-4 bg-brand-bg/5">
        {activeMessages.map((m) => {
          const isAgent = m.sender === "agent";
          return (
            <div 
              key={m.id} 
              className={`flex flex-col max-w-[85%] ${
                isAgent ? "self-start mr-auto" : "self-end ml-auto items-end"
              }`}
            >
              <div 
                className={`rounded-2xl px-4 py-3 text-xs leading-relaxed whitespace-pre-wrap ${
                  isAgent 
                    ? "bg-brand-bg/60 border border-brand-border/60 text-brand-text rounded-tl-sm" 
                    : "bg-brand-primary text-white rounded-tr-sm"
                }`}
              >
                {m.text}
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
            Agent is generating configuration...
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
          placeholder={
            isConnecting 
              ? "Initializing session..." 
              : agentMode === "live" 
                ? `Ask ${activeAgent?.name || "Agent"} to configure your calculator...`
                : "Ask Build Forge to build a custom slat system..."
          }
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

      {/* Backend Training & Spawning Portal overlay drawer */}
      {showTeacher && (
        <div className="absolute inset-0 bg-brand-bg/98 border border-brand-border flex flex-col z-20 animate-fade-in p-4 sm:p-5">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-brand-border pb-3">
            <div className="flex items-center gap-2">
              <Brain className="text-brand-primary animate-pulse" size={20} />
              <div>
                <h4 className="text-sm font-black text-brand-text">Backend Teaching Portal</h4>
                <p className="text-[10px] text-brand-muted">Train, configure, sync prompts, and spawn sub-agents</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowTeacher(false)}
              className="p-1 border border-brand-border hover:bg-brand-border/20 rounded-lg text-brand-muted hover:text-brand-text transition"
            >
              <X size={16} />
            </button>
          </div>

          {/* Navigation Tabs */}
          <div className="flex gap-2 border-b border-brand-border/40 py-2 overflow-x-auto text-[10px]">
            {(["identity", "knowledge", "corrections", "spawn"] as TeacherTab[]).map(tab => (
              <button
                key={tab}
                type="button"
                onClick={() => setTeacherTab(tab)}
                className={`px-3 py-1.5 rounded-lg border font-extrabold capitalize transition ${
                  teacherTab === tab 
                    ? "bg-brand-primary border-brand-primary text-white" 
                    : "bg-brand-card border-brand-border text-brand-muted hover:text-brand-text"
                }`}
              >
                {tab === "identity" ? "Branding & Model" : tab === "knowledge" ? "Knowledge Base" : tab === "corrections" ? "Corrections Log" : "Spawn Sub-Agent"}
              </button>
            ))}
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto py-4 space-y-4 scrollbar-thin text-xs text-brand-text">
            
            {/* 1. IDENTITY & MODEL TAB */}
            {teacherTab === "identity" && activeAgent && (
              <form onSubmit={handleSaveIdentity} className="space-y-4 max-w-md">
                <div className="space-y-1">
                  <label className="block text-[10px] font-bold text-brand-muted uppercase">Agent Name</label>
                  <input
                    type="text"
                    required
                    value={agentName}
                    onChange={(e) => setAgentName(e.target.value)}
                    className="w-full bg-brand-card border border-brand-border rounded-xl px-3 py-2 text-xs outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-[10px] font-bold text-brand-muted uppercase">Description</label>
                  <input
                    type="text"
                    value={agentDesc}
                    onChange={(e) => setAgentDesc(e.target.value)}
                    className="w-full bg-brand-card border border-brand-border rounded-xl px-3 py-2 text-xs outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-[10px] font-bold text-brand-muted uppercase">LLM Model</label>
                  <select
                    value={agentModel}
                    onChange={(e) => setAgentModel(e.target.value)}
                    className="w-full bg-brand-card border border-brand-border rounded-xl px-3 py-2 text-xs outline-none"
                  >
                    <option value="claude-3-5-sonnet-20241022">Claude 3.5 Sonnet</option>
                    <option value="claude-3-opus-20240229">Claude 3 Opus</option>
                    <option value="claude-3-5-haiku-20241022">Claude 3.5 Haiku</option>
                  </select>
                </div>
                <div className="flex items-center gap-2 py-1">
                  <input
                    type="checkbox"
                    id="search-tool"
                    checked={useSearchTool}
                    onChange={(e) => setUseSearchTool(e.target.checked)}
                    className="rounded bg-brand-card border-brand-border border outline-none text-brand-primary"
                  />
                  <label htmlFor="search-tool" className="text-[10px] font-bold text-brand-muted uppercase cursor-pointer">
                    Enable Database Catalogue Search Tool
                  </label>
                </div>
                <div className="space-y-1">
                  <label className="block text-[10px] font-bold text-brand-muted uppercase">System Prompt Instructions</label>
                  <textarea
                    value={agentPrompt}
                    onChange={(e) => setAgentPrompt(e.target.value)}
                    className="w-full bg-brand-card border border-brand-border rounded-xl px-3 py-2 text-xs outline-none h-44 font-mono resize-none"
                  />
                </div>
                
                <div className="flex gap-2">
                  <button
                    type="submit"
                    className="flex-1 bg-brand-primary hover:bg-brand-primary/90 text-white font-extrabold py-2 px-4 rounded-xl transition text-center justify-center flex"
                  >
                    Save Agent Identity
                  </button>
                  {activeAgent.is_spawned && (
                    <button
                      type="button"
                      onClick={() => handleDeleteAgent(activeAgent.id)}
                      className="border border-brand-danger text-brand-danger hover:bg-brand-danger/10 px-3 rounded-xl transition"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              </form>
            )}

            {/* 2. KNOWLEDGE BASE TAB */}
            {teacherTab === "knowledge" && (
              <div className="space-y-6">
                {/* Form */}
                <form onSubmit={handleAddKnowledge} className="bg-brand-card border border-brand-border rounded-2xl p-4 space-y-3 max-w-md">
                  <h5 className="font-extrabold text-xs flex items-center gap-1.5 text-brand-text">
                    <Plus size={14} className="text-brand-primary" />
                    Feed Training / Learned Asset
                  </h5>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label className="block text-[9px] font-bold text-brand-muted uppercase">Asset Title</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Amber Height Rules"
                        value={newAssetTitle}
                        onChange={(e) => setNewAssetTitle(e.target.value)}
                        className="w-full bg-brand-bg border border-brand-border rounded-lg px-2.5 py-1.5 text-xs outline-none"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="block text-[9px] font-bold text-brand-muted uppercase">Asset Type</label>
                      <select
                        value={newAssetType}
                        onChange={(e) => setNewAssetType(e.target.value as any)}
                        className="w-full bg-brand-bg border border-brand-border rounded-lg px-2 py-1.5 text-xs outline-none"
                      >
                        <option value="text">Prose / Notes</option>
                        <option value="file">File Attachment</option>
                        <option value="image">Diagram / Image</option>
                        <option value="video">Install / Video URL</option>
                      </select>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="block text-[9px] font-bold text-brand-muted uppercase">Content Body / File Reference</label>
                    <textarea
                      required
                      placeholder="Paste details, PDF text, or link references here..."
                      value={newAssetBody}
                      onChange={(e) => setNewAssetBody(e.target.value)}
                      className="w-full bg-brand-bg border border-brand-border rounded-lg px-2.5 py-1.5 text-xs outline-none h-20 resize-none"
                    />
                  </div>
                  <button
                    type="submit"
                    className="w-full bg-brand-primary text-white font-extrabold py-2 rounded-lg text-xs"
                  >
                    Teach Asset to Agent
                  </button>
                </form>

                {/* List */}
                <div className="space-y-3">
                  <h5 className="font-extrabold text-xs uppercase tracking-wider text-brand-muted flex items-center gap-1.5">
                    <BookOpen size={14} />
                    Active Learned Assets ({knowledgeList.length})
                  </h5>
                  {knowledgeList.length === 0 ? (
                    <p className="text-xs text-brand-muted">No custom knowledge items uploaded yet.</p>
                  ) : (
                    <div className="grid gap-2">
                      {knowledgeList.map(k => (
                        <div key={k.id} className="bg-brand-card border border-brand-border/60 p-3 rounded-xl flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <h6 className="font-extrabold text-xs text-brand-text truncate">{k.title}</h6>
                              <span className="text-[8px] bg-brand-primary/10 border border-brand-primary/20 text-brand-primary px-1 py-0.5 rounded font-black uppercase shrink-0">
                                {k.content_type}
                              </span>
                            </div>
                            <p className="text-[10px] text-brand-muted mt-1 break-all line-clamp-2">{k.content_body}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 3. CORRECTIONS TAB */}
            {teacherTab === "corrections" && (
              <div className="space-y-6">
                {/* Form */}
                <form onSubmit={handleAddCorrection} className="bg-brand-card border border-brand-border rounded-2xl p-4 space-y-3 max-w-md">
                  <h5 className="font-extrabold text-xs flex items-center gap-1.5 text-brand-text">
                    <Plus size={14} className="text-brand-primary" />
                    Log Correction (Feedback Loop)
                  </h5>
                  <div className="space-y-1">
                    <label className="block text-[9px] font-bold text-brand-muted uppercase">When I Say (User trigger pattern) *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Calculate arrissed rail spacing"
                      value={newCorrPattern}
                      onChange={(e) => setNewCorrPattern(e.target.value)}
                      className="w-full bg-brand-bg border border-brand-border rounded-lg px-2.5 py-1.5 text-xs outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="block text-[9px] font-bold text-brand-muted uppercase">What was wrong (Correction Notes) *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Slat counts were off by 1 because of overlap logic"
                      value={newCorrNotes}
                      onChange={(e) => setNewCorrNotes(e.target.value)}
                      className="w-full bg-brand-bg border border-brand-border rounded-lg px-2.5 py-1.5 text-xs outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="block text-[9px] font-bold text-brand-muted uppercase">Expected Correct Behavior / Prompt Action *</label>
                    <textarea
                      required
                      placeholder="e.g. Add rule with expression: ceil((run_length - overlaps) / 65)"
                      value={newCorrExpect}
                      onChange={(e) => setNewCorrExpect(e.target.value)}
                      className="w-full bg-brand-bg border border-brand-border rounded-lg px-2.5 py-1.5 text-xs outline-none h-16 resize-none"
                    />
                  </div>
                  <button
                    type="submit"
                    className="w-full bg-brand-primary text-white font-extrabold py-2 rounded-lg text-xs"
                  >
                    Save Correction Rule
                  </button>
                </form>

                {/* List */}
                <div className="space-y-3">
                  <h5 className="font-extrabold text-xs uppercase tracking-wider text-brand-muted flex items-center gap-1.5">
                    <History size={14} />
                    Logged Corrections ({correctionsList.length})
                  </h5>
                  {correctionsList.length === 0 ? (
                    <p className="text-xs text-brand-muted">No corrections registered yet.</p>
                  ) : (
                    <div className="grid gap-2">
                      {correctionsList.map(c => (
                        <div key={c.id} className="bg-brand-card border border-brand-border/60 p-3 rounded-xl space-y-1">
                          <h6 className="font-extrabold text-xs text-brand-text">Trigger: "{c.trigger_pattern}"</h6>
                          <p className="text-[10px] text-brand-danger">Mistake: {c.correction_notes}</p>
                          <p className="text-[10px] text-brand-success">Correction: {c.expected_behavior}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 4. SPAWN SUB-AGENT TAB */}
            {teacherTab === "spawn" && (
              <form onSubmit={handleSpawnAgent} className="space-y-4 max-w-md">
                <div className="space-y-1">
                  <label className="block text-[10px] font-bold text-brand-muted uppercase">Sub-Agent Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Timber Expert"
                    value={spawnName}
                    onChange={(e) => setSpawnName(e.target.value)}
                    className="w-full bg-brand-card border border-brand-border rounded-xl px-3 py-2 text-xs outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-[10px] font-bold text-brand-muted uppercase">Purpose / Description</label>
                  <input
                    type="text"
                    placeholder="e.g. Specialized assistant for timber paling boundary fences"
                    value={spawnDesc}
                    onChange={(e) => setSpawnDesc(e.target.value)}
                    className="w-full bg-brand-card border border-brand-border rounded-xl px-3 py-2 text-xs outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-[10px] font-bold text-brand-muted uppercase">LLM Model</label>
                  <select
                    value={spawnModel}
                    onChange={(e) => setSpawnModel(e.target.value)}
                    className="w-full bg-brand-card border border-brand-border rounded-xl px-3 py-2 text-xs outline-none"
                  >
                    <option value="claude-3-5-sonnet-20241022">Claude 3.5 Sonnet</option>
                    <option value="claude-3-opus-20240229">Claude 3 Opus</option>
                    <option value="claude-3-5-haiku-20241022">Claude 3.5 Haiku</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="block text-[10px] font-bold text-brand-muted uppercase">Base System Prompt</label>
                  <textarea
                    placeholder="Provide specific behavioral rules for this sub-agent..."
                    value={spawnPrompt}
                    onChange={(e) => setSpawnPrompt(e.target.value)}
                    className="w-full bg-brand-card border border-brand-border rounded-xl px-3 py-2 text-xs outline-none h-32 font-mono resize-none"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full bg-brand-primary hover:bg-brand-primary/90 text-white font-extrabold py-2 px-4 rounded-xl transition text-center justify-center flex"
                >
                  Spawn Sub-Agent
                </button>
              </form>
            )}

          </div>
        </div>
      )}

    </div>
  );
}
