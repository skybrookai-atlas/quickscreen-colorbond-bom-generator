import { useState, useRef } from "react";
import { AppShell } from "../components/layout/AppShell";
import { Button } from "../components/ui/Button";
import { 
  Sliders, 
  Settings, 
  Play, 
  Save, 
  Layers, 
  Database,
  Calculator,
  Plus,
  Trash2,
  CheckCircle2,
  XCircle,
  Wand2
} from "lucide-react";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { listSuppliers, listArchetypes } from "../lib/multiSupplier/queries";
import { CalculatorBuilderWizard } from "../components/calculator-builder/CalculatorBuilderWizard";
import { BuildForgeChatPanel } from "../components/calculator-builder/BuildForgeChatPanel";


type Tab = "details" | "variables" | "rules" | "selectors" | "tests";

interface VariableDefinition {
  id: string;
  name: string;
  type: "enum" | "integer" | "float" | "text" | "boolean";
  description: string;
  defaultValue: string;
  options: string[];
}

interface CalculationRule {
  id: string;
  outputKey: string;
  expression: string;
  stage: "derive" | "stock" | "accessory" | "component";
  description: string;
}

interface SkuSelector {
  id: string;
  category: string;
  matchCriteria: string; // e.g. finish_family=standard, slat_size_mm=65
  skuPattern: string; // e.g. GO-SLAT-65-{colour}
}

interface TestCase {
  id: string;
  name: string;
  inputs: Record<string, string>; // e.g. { run_length: "10000", height: "1800" }
  expectedOutputs: Array<{ sku: string; quantity: number }>;
  status?: "passed" | "failed" | "idle";
  errorLog?: string;
}

export function CalculatorBuilderPage() {
  const [activeTab, setActiveTab] = useState<Tab>("details");
  const [showWizard, setShowWizard] = useState(false);

  // Fetch suppliers and archetypes for dropdowns
  const { data: suppliers } = useQuery({
    queryKey: ["suppliers", "builder"],
    queryFn: () => listSuppliers(),
  });

  const { data: archetypes } = useQuery({
    queryKey: ["archetypes", "builder"],
    queryFn: () => listArchetypes(),
  });

  // State definitions
  const [calcName, setCalcName] = useState("Custom Modern Slat System");
  const [calcDescription, setCalcDescription] = useState("Visual custom fence calculator for premium horizontal slat configurations.");
  const [selectedSupplierId, setSelectedSupplierId] = useState("");
  const [selectedArchetypeId, setSelectedArchetypeId] = useState("");
  const [visibility, setVisibility] = useState("private");


  const [variables, setVariables] = useState<VariableDefinition[]>([
    {
      id: "var-1",
      name: "slat_gap_mm",
      type: "enum",
      description: "Space between slats in millimeters",
      defaultValue: "9",
      options: ["5", "9", "20"]
    },
    {
      id: "var-2",
      name: "target_height_mm",
      type: "integer",
      description: "Target height of the fence panel run",
      defaultValue: "1800",
      options: []
    },
    {
      id: "var-3",
      name: "colour_code",
      type: "enum",
      description: "Colorbond colour selector",
      defaultValue: "black- satin",
      options: ["black-satin", "monument-matt", "pearl-white-gloss"]
    }
  ]);

  const [rules, setRules] = useState<CalculationRule[]>([
    {
      id: "rule-1",
      outputKey: "slat_count",
      expression: "ceil((run_length - post_qty * 50) / (65 + slat_gap_mm))",
      stage: "derive",
      description: "Calculates the total number of horizontal slats required"
    },
    {
      id: "rule-2",
      outputKey: "screws_qty",
      expression: "slat_count * 4 + post_qty * 2",
      stage: "accessory",
      description: "Screws count based on slats and posts"
    }
  ]);

  const [selectors, setSelectors] = useState<SkuSelector[]>([
    {
      id: "sel-1",
      category: "slat",
      matchCriteria: "slat_size_mm=65",
      skuPattern: "GO-SLAT-65-{colour}"
    },
    {
      id: "sel-2",
      category: "screw",
      matchCriteria: "",
      skuPattern: "GO-SCREW-TEK-{colour}"
    }
  ]);

  const [testCases, setTestCases] = useState<TestCase[]>([
    {
      id: "test-1",
      name: "Standard 6m horizontal slat run, 1.8m height",
      inputs: {
        run_length: "6000",
        slat_gap_mm: "9",
        post_qty: "3"
      },
      expectedOutputs: [
        { sku: "GO-SLAT-65-MN", quantity: 69 },
        { sku: "GO-SCREW-TEK-MN", quantity: 282 }
      ],
      status: "idle"
    }
  ]);

  // Form Adding states
  const [newVarName, setNewVarName] = useState("");
  const [newVarType, setNewVarType] = useState<VariableDefinition["type"]>("enum");
  const [newVarDesc, setNewVarDesc] = useState("");
  const [newVarDefault, setNewVarDefault] = useState("");
  const [newVarOptionsString, setNewVarOptionsString] = useState("");

  const [newRuleKey, setNewRuleKey] = useState("");
  const [newRuleExpr, setNewRuleExpr] = useState("");
  const [newRuleStage, setNewRuleStage] = useState<CalculationRule["stage"]>("derive");
  const [newRuleDesc, setNewRuleDesc] = useState("");

  const [newSelCategory, setNewSelCategory] = useState("slat");
  const [newSelCriteria, setNewSelCriteria] = useState("");
  const [newSelSkuPattern, setNewSelSkuPattern] = useState("");

  const formulaInputRef = useRef<HTMLTextAreaElement>(null);

  // Helper to append variable into rule formula input at cursor position
  const injectVariable = (varName: string) => {
    if (!formulaInputRef.current) {
      setNewRuleExpr((prev) => prev + ` ${varName}`);
      return;
    }
    const start = formulaInputRef.current.selectionStart;
    const end = formulaInputRef.current.selectionEnd;
    const text = formulaInputRef.current.value;
    const injected = text.substring(0, start) + varName + text.substring(end);
    setNewRuleExpr(injected);
    // Refocus and place cursor after the injected token
    setTimeout(() => {
      if (formulaInputRef.current) {
        formulaInputRef.current.focus();
        formulaInputRef.current.selectionStart = formulaInputRef.current.selectionEnd = start + varName.length;
      }
    }, 0);
  };

  const handleAddVariable = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newVarName) return toast.error("Variable Name is required");
    const options = newVarOptionsString ? newVarOptionsString.split(",").map(o => o.trim()).filter(Boolean) : [];
    const newVar: VariableDefinition = {
      id: `var-${Date.now()}`,
      name: newVarName.replace(/\s+/g, "_").toLowerCase(),
      type: newVarType,
      description: newVarDesc,
      defaultValue: newVarDefault,
      options
    };
    setVariables([...variables, newVar]);
    setNewVarName("");
    setNewVarDesc("");
    setNewVarDefault("");
    setNewVarOptionsString("");
    toast.success("Variable added successfully!");
  };

  const handleDeleteVariable = (id: string) => {
    setVariables(variables.filter(v => v.id !== id));
    toast.success("Variable deleted.");
  };

  const handleAddRule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRuleKey || !newRuleExpr) return toast.error("Key and Expression are required");
    const newRule: CalculationRule = {
      id: `rule-${Date.now()}`,
      outputKey: newRuleKey.replace(/\s+/g, "_").toLowerCase(),
      expression: newRuleExpr,
      stage: newRuleStage,
      description: newRuleDesc
    };
    setRules([...rules, newRule]);
    setNewRuleKey("");
    setNewRuleExpr("");
    setNewRuleDesc("");
    toast.success("Calculation rule added successfully!");
  };

  const handleDeleteRule = (id: string) => {
    setRules(rules.filter(r => r.id !== id));
    toast.success("Rule deleted.");
  };

  const handleAddSelector = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSelSkuPattern) return toast.error("SKU Pattern is required");
    const newSel: SkuSelector = {
      id: `sel-${Date.now()}`,
      category: newSelCategory,
      matchCriteria: newSelCriteria,
      skuPattern: newSelSkuPattern
    };
    setSelectors([...selectors, newSel]);
    setNewSelCriteria("");
    setNewSelSkuPattern("");
    toast.success("SKU selector added successfully!");
  };

  const handleDeleteSelector = (id: string) => {
    setSelectors(selectors.filter(s => s.id !== id));
    toast.success("Selector deleted.");
  };

  const runRegressionTest = (testCase: TestCase) => {
    toast.loading("Running test case...", { id: "test-run" });
    
    // Simple mock formula evaluator
    setTimeout(() => {
      try {
        const runLength = parseFloat(testCase.inputs.run_length ?? "6000");
        const slatGap = parseFloat(testCase.inputs.slat_gap_mm ?? "9");
        const postQty = parseFloat(testCase.inputs.post_qty ?? "3");

        // mock calculations based on formulas:
        // slat_count = ceil((run_length - post_qty*50)/(65 + gap))
        const derivedSlatCount = Math.ceil((runLength - postQty * 50) / (65 + slatGap));
        // screws_qty = slat_count*4 + post_qty*2
        const derivedScrewsQty = derivedSlatCount * 4 + postQty * 2;

        const results = [
          { sku: "GO-SLAT-65-MN", quantity: derivedSlatCount },
          { sku: "GO-SCREW-TEK-MN", quantity: derivedScrewsQty }
        ];

        // Match against expected outputs
        let passed = true;
        for (const expected of testCase.expectedOutputs) {
          const matched = results.find(r => r.sku === expected.sku || r.sku.includes(expected.sku.substring(0, 7)));
          if (!matched || matched.quantity !== expected.quantity) {
            passed = false;
            break;
          }
        }

        setTestCases(prev => prev.map(tc => {
          if (tc.id === testCase.id) {
            return { 
              ...tc, 
              status: passed ? "passed" : "failed",
              errorLog: passed ? undefined : `Mismatch! Expected: ${JSON.stringify(testCase.expectedOutputs)}, Got: ${JSON.stringify(results)}`
            };
          }
          return tc;
        }));

        if (passed) {
          toast.success("Test Case Passed! All quantities matched expected output.", { id: "test-run" });
        } else {
          toast.error("Test Case Failed. Check output mismatch log.", { id: "test-run" });
        }
      } catch (err) {
        setTestCases(prev => prev.map(tc => {
          if (tc.id === testCase.id) {
            return { ...tc, status: "failed", errorLog: String(err) };
          }
          return tc;
        }));
        toast.error("Test execution threw error: " + err, { id: "test-run" });
      }
    }, 800);
  };

  const handleApplyWizard = (data: {
    name: string;
    description: string;
    supplierId: string;
    archetypeId: string;
    visibility: string;
    variables: any[];
    rules: any[];
    selectors: any[];
  }) => {
    setCalcName(data.name);
    setCalcDescription(data.description);
    setSelectedSupplierId(data.supplierId);
    setSelectedArchetypeId(data.archetypeId);
    setVisibility(data.visibility);
    
    setVariables(data.variables.map((v, i) => ({
      id: `var-wiz-${i}-${Date.now()}`,
      name: v.name,
      type: v.type,
      description: v.description,
      defaultValue: v.defaultValue,
      options: v.options
    })));

    setRules(data.rules.map((r, i) => ({
      id: `rule-wiz-${i}-${Date.now()}`,
      outputKey: r.outputKey,
      expression: r.expression,
      stage: r.stage,
      description: r.description
    })));

    setSelectors(data.selectors.map((s, i) => ({
      id: `sel-wiz-${i}-${Date.now()}`,
      category: s.category,
      matchCriteria: s.matchCriteria,
      skuPattern: s.skuPattern
    })));

    setActiveTab("variables");
    setShowWizard(false);
  };

  const handleSaveCalculator = () => {
    toast.loading("Uploading customized calculator configuration...", { id: "save-calc" });
    
    // Simulate database upsert
    setTimeout(() => {
      toast.success("Calculator saved successfully to Private Org Sandbox!", { id: "save-calc" });
    }, 1200);
  };

  const handleApplyMeta = (field: string, value: string) => {
    switch (field) {
      case "name":
        setCalcName(value);
        break;
      case "description":
        setCalcDescription(value);
        break;
      case "organization":
        setSelectedSupplierId(value);
        break;
      case "archetype":
        setSelectedArchetypeId(value);
        break;
      case "visibility":
        setVisibility(value);
        break;
    }
  };

  const handleApplyAddVariable = (variable: any) => {
    setVariables((prev) => {
      const filtered = prev.filter((v) => v.name !== variable.key);
      return [
        ...filtered,
        {
          id: `var-${Date.now()}-${Math.random().toString(36).substring(4)}`,
          name: variable.key,
          type: variable.type,
          description: variable.description || "",
          defaultValue: String(variable.default ?? ""),
          options: variable.options ? variable.options.map(String) : [],
        },
      ];
    });
  };

  const handleApplyAddRule = (rule: any) => {
    setRules((prev) => {
      const filtered = prev.filter((r) => r.outputKey !== rule.outputKey);
      return [
        ...filtered,
        {
          id: `rule-${Date.now()}-${Math.random().toString(36).substring(4)}`,
          outputKey: rule.outputKey,
          expression: rule.expression,
          stage: rule.stage || "derive",
          description: rule.description || "",
        },
      ];
    });
  };

  const handleApplyMapSelector = (selector: any) => {
    setSelectors((prev) => {
      const filtered = prev.filter((s) => s.skuPattern !== selector.canonical_name);
      return [
        ...filtered,
        {
          id: `sel-${Date.now()}-${Math.random().toString(36).substring(4)}`,
          category: selector.category || "slat",
          matchCriteria: selector.matchCriteria || "",
          skuPattern: selector.canonical_name || "",
        },
      ];
    });
  };

  const handleApplyAddTest = (test: any) => {
    setTestCases((prev) => {
      const filtered = prev.filter((t) => t.name !== test.name);
      return [
        ...filtered,
        {
          id: `test-${Date.now()}-${Math.random().toString(36).substring(4)}`,
          name: test.name,
          inputs: test.inputs || {},
          expectedOutputs: test.expectedOutputs || [],
          status: "idle",
        },
      ];
    });
  };

  const handleApplyComplete = () => {
    toast.success("Build Forge: Calculator configured successfully! Ready to submit.");
  };

  return (
    <AppShell>
      <div className="min-h-screen bg-brand-bg text-brand-text p-4 sm:p-8">
        <div className="max-w-6xl mx-auto space-y-6 animate-fade-in">
          
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-brand-border/60 pb-6">
            <div>
              <h1 className="text-3xl font-black flex items-center gap-3">
                <Calculator className="text-brand-primary animate-pulse" size={32} />
                Visual Calculator Builder
              </h1>
              <p className="text-brand-muted text-sm mt-1">
                Design custom fence variables, math.js rules, inventory SKU selectors, and run regression tests in your private sandbox.
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button 
                variant="ghost" 
                size="medium" 
                onClick={() => setShowWizard(true)}
                className="border-brand-primary text-brand-primary hover:bg-brand-primary/10"
              >
                <Wand2 size={16} className="mr-1.5" />
                Visual Wizard Builder
              </Button>
              <Button variant="primary" size="medium" onClick={handleSaveCalculator} className="shadow-lg shadow-brand-primary/20">
                <Save size={16} />
                Save Sandbox Copy
              </Button>
            </div>
          </div>


          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            <div className="lg:col-span-8 space-y-6">
              {/* Navigation Tabs */}
              <div className="flex border-b border-brand-border/40 gap-2 overflow-x-auto pb-px">
            {(["details", "variables", "rules", "selectors", "tests"] as Tab[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-3 text-sm font-extrabold capitalize border-b-2 transition-all whitespace-nowrap ${
                  activeTab === tab
                    ? "border-brand-primary text-brand-primary bg-brand-primary/5"
                    : "border-transparent text-brand-muted hover:text-brand-text"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Content Area */}
          <div className="bg-brand-card border border-brand-border rounded-2xl p-6 sm:p-8 min-h-[400px]">
            
            {/* 1. DETAILS TAB */}
            {activeTab === "details" && (
              <div className="max-w-2xl space-y-6">
                <div>
                  <h3 className="text-lg font-black flex items-center gap-2 text-brand-text">
                    <Settings size={20} className="text-brand-primary" />
                    Calculator Details & Metadata
                  </h3>
                  <p className="text-xs text-brand-muted mt-0.5">Define name, system parameters, and tenant visibility permissions.</p>
                </div>
                
                <div className="grid gap-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-brand-muted uppercase mb-1.5">Calculator Name *</label>
                      <input 
                        type="text" 
                        value={calcName}
                        onChange={(e) => setCalcName(e.target.value)}
                        placeholder="e.g. Modern Horizontal Slat" 
                        className="w-full bg-brand-bg border border-brand-border focus:border-brand-primary/60 rounded-xl px-4 py-3 text-sm outline-none transition"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-brand-muted uppercase mb-1.5">Supplier Organization</label>
                      <select 
                        value={selectedSupplierId}
                        onChange={(e) => setSelectedSupplierId(e.target.value)}
                        className="w-full bg-brand-bg border border-brand-border focus:border-brand-primary/60 rounded-xl px-4 py-3 text-sm outline-none transition text-brand-text"
                      >
                        <option value="">Default (Australia Master)</option>
                        {suppliers?.map(s => (
                          <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-brand-muted uppercase mb-1.5">Description</label>
                    <textarea 
                      value={calcDescription}
                      onChange={(e) => setCalcDescription(e.target.value)}
                      placeholder="Enter a description of this fencing system..." 
                      className="w-full bg-brand-bg border border-brand-border focus:border-brand-primary/60 rounded-xl px-4 py-3 text-sm outline-none transition h-24 resize-none"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-brand-muted uppercase mb-1.5">System Archetype (System Type)</label>
                      <select 
                        value={selectedArchetypeId}
                        onChange={(e) => setSelectedArchetypeId(e.target.value)}
                        className="w-full bg-brand-bg border border-brand-border focus:border-brand-primary/60 rounded-xl px-4 py-3 text-sm outline-none transition text-brand-text"
                      >
                        <option value="">Select archetype...</option>
                        {archetypes?.map(a => (
                          <option key={a.id} value={a.id}>{a.name} ({a.family})</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-brand-muted uppercase mb-1.5">Ecosystem Visibility</label>
                      <select 
                        value={visibility}
                        onChange={(e) => setVisibility(e.target.value)}
                        className="w-full bg-brand-bg border border-brand-border focus:border-brand-primary/60 rounded-xl px-4 py-3 text-sm outline-none transition text-brand-text"
                      >
                        <option value="private">Private (My Organisation Sandbox only)</option>
                        <option value="organization">Shared (Organization staff/clients portal)</option>
                        <option value="marketplace_queue">Submit to National Network (Awaiting Approval)</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 2. VARIABLES TAB */}
            {activeTab === "variables" && (
              <div className="space-y-6">
                <div className="border-b border-brand-border pb-4">
                  <h3 className="text-lg font-black flex items-center gap-2 text-brand-text">
                    <Sliders size={20} className="text-brand-primary" />
                    Calculator Configuration Variables
                  </h3>
                  <p className="text-xs text-brand-muted mt-0.5">Configure inputs and parameter defaults that are rendered on the configuration forms.</p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  {/* Variables list */}
                  <div className="lg:col-span-2 space-y-3">
                    <h4 className="text-xs font-black uppercase tracking-wider text-brand-muted">Active Variables ({variables.length})</h4>
                    {variables.map((v) => (
                      <div 
                        key={v.id} 
                        className="bg-brand-bg border border-brand-border p-4 rounded-xl flex items-center justify-between gap-4"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <h5 className="font-bold text-sm font-mono text-brand-text">{v.name}</h5>
                            <span className="text-[10px] px-1.5 py-0.5 bg-brand-primary/10 border border-brand-primary/20 text-brand-primary rounded font-black uppercase">
                              {v.type}
                            </span>
                          </div>
                          <p className="text-xs text-brand-muted mt-1">{v.description || "No description provided."}</p>
                          <div className="mt-2 flex flex-wrap gap-2 text-[10px] text-brand-muted">
                            <span>Default: <code className="bg-brand-card px-1 py-0.5 rounded border border-brand-border/40 font-mono text-brand-accent">{v.defaultValue}</code></span>
                            {v.options.length > 0 && (
                              <span>Options: <code className="bg-brand-card px-1 py-0.5 rounded border border-brand-border/40 font-mono text-brand-accent">{v.options.join(", ")}</code></span>
                            )}
                          </div>
                        </div>
                        <button
                          onClick={() => handleDeleteVariable(v.id)}
                          className="p-2 text-brand-muted hover:text-brand-danger hover:bg-brand-danger/10 rounded-lg transition-colors shrink-0"
                          title="Delete Variable"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ))}
                  </div>

                  {/* Add Variable Form */}
                  <form onSubmit={handleAddVariable} className="bg-brand-bg border border-brand-border rounded-xl p-5 space-y-4">
                    <h4 className="text-sm font-black flex items-center gap-2 border-b border-brand-border/40 pb-2 text-brand-text">
                      <Plus size={16} className="text-brand-primary" />
                      Add Custom Variable
                    </h4>
                    
                    <div className="space-y-3">
                      <div>
                        <label className="block text-[10px] font-bold text-brand-muted uppercase mb-1">Variable Key (snake_case) *</label>
                        <input
                          type="text"
                          required
                          value={newVarName}
                          onChange={(e) => setNewVarName(e.target.value)}
                          placeholder="e.g. max_spacing_mm"
                          className="w-full bg-brand-card border border-brand-border rounded-lg px-3 py-2 text-xs text-brand-text outline-none focus:border-brand-primary"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[10px] font-bold text-brand-muted uppercase mb-1">Data Type</label>
                          <select
                            value={newVarType}
                            onChange={(e) => setNewVarType(e.target.value as any)}
                            className="w-full bg-brand-card border border-brand-border rounded-lg px-2 py-2 text-xs text-brand-text outline-none"
                          >
                            <option value="enum">Enum</option>
                            <option value="integer">Integer</option>
                            <option value="float">Float</option>
                            <option value="boolean">Boolean</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-brand-muted uppercase mb-1">Default Value</label>
                          <input
                            type="text"
                            value={newVarDefault}
                            onChange={(e) => setNewVarDefault(e.target.value)}
                            placeholder="e.g. 2600"
                            className="w-full bg-brand-card border border-brand-border rounded-lg px-3 py-2 text-xs text-brand-text outline-none"
                          />
                        </div>
                      </div>

                      {newVarType === "enum" && (
                        <div>
                          <label className="block text-[10px] font-bold text-brand-muted uppercase mb-1">Options (comma separated)</label>
                          <input
                            type="text"
                            value={newVarOptionsString}
                            onChange={(e) => setNewVarOptionsString(e.target.value)}
                            placeholder="e.g. 2000, 2600, 3000"
                            className="w-full bg-brand-card border border-brand-border rounded-lg px-3 py-2 text-xs text-brand-text outline-none focus:border-brand-primary"
                          />
                        </div>
                      )}

                      <div>
                        <label className="block text-[10px] font-bold text-brand-muted uppercase mb-1">Description</label>
                        <input
                          type="text"
                          value={newVarDesc}
                          onChange={(e) => setNewVarDesc(e.target.value)}
                          placeholder="e.g. Recommended spacing cap"
                          className="w-full bg-brand-card border border-brand-border rounded-lg px-3 py-2 text-xs text-brand-text outline-none focus:border-brand-primary"
                        />
                      </div>

                      <Button type="submit" variant="primary" className="w-full justify-center">
                        Add Variable
                      </Button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {/* 3. RULES TAB */}
            {activeTab === "rules" && (
              <div className="space-y-6">
                <div className="border-b border-brand-border pb-4">
                  <h3 className="text-lg font-black flex items-center gap-2 text-brand-text">
                    <Layers size={20} className="text-brand-primary" />
                    Calculation Rules & Formulas
                  </h3>
                  <p className="text-xs text-brand-muted mt-0.5">Write math.js logic expressions to derive quantities and bill component properties.</p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  {/* Rules table */}
                  <div className="lg:col-span-2 space-y-4">
                    <div className="border border-brand-border/60 rounded-xl overflow-hidden">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="bg-brand-bg border-b border-brand-border/60 text-xs font-black uppercase text-brand-muted">
                            <th className="p-3">Output Key</th>
                            <th className="p-3">Expression (math.js)</th>
                            <th className="p-3">Stage</th>
                            <th className="p-3 text-right">Delete</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-brand-border/40 bg-brand-card">
                          {rules.map((rule) => (
                            <tr key={rule.id} className="hover:bg-brand-border/10 transition-colors">
                              <td className="p-3 font-mono font-bold text-brand-primary">{rule.outputKey}</td>
                              <td className="p-3 font-mono text-brand-text break-all">{rule.expression}</td>
                              <td className="p-3 whitespace-nowrap">
                                <span className="text-[10px] px-1.5 py-0.5 bg-blue-500/10 border border-blue-500/20 text-blue-500 rounded font-black uppercase">
                                  {rule.stage}
                                </span>
                              </td>
                              <td className="p-3 text-right">
                                <button
                                  onClick={() => handleDeleteRule(rule.id)}
                                  className="text-brand-muted hover:text-brand-danger p-1"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Add Rule Form */}
                  <form onSubmit={handleAddRule} className="bg-brand-bg border border-brand-border rounded-xl p-5 space-y-4">
                    <h4 className="text-sm font-black flex items-center gap-2 border-b border-brand-border/40 pb-2 text-brand-text">
                      <Plus size={16} className="text-brand-primary" />
                      Add Calculation Rule
                    </h4>

                    {/* Variable Injector list */}
                    <div>
                      <label className="block text-[10px] font-bold text-brand-muted uppercase mb-1">Click to Inject Variable Chip</label>
                      <div className="flex flex-wrap gap-1.5 p-2 bg-brand-card/50 border border-brand-border rounded-lg max-h-24 overflow-y-auto">
                        <button type="button" onClick={() => injectVariable("run_length")} className="px-2 py-0.5 bg-brand-bg border border-brand-border text-[9px] font-semibold font-mono hover:text-brand-primary rounded">run_length</button>
                        <button type="button" onClick={() => injectVariable("post_qty")} className="px-2 py-0.5 bg-brand-bg border border-brand-border text-[9px] font-semibold font-mono hover:text-brand-primary rounded">post_qty</button>
                        {variables.map(v => (
                          <button 
                            key={v.id}
                            type="button" 
                            onClick={() => injectVariable(v.name)}
                            className="px-2 py-0.5 bg-brand-bg border border-brand-border text-[9px] font-semibold font-mono hover:text-brand-primary rounded"
                          >
                            {v.name}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div>
                        <label className="block text-[10px] font-bold text-brand-muted uppercase mb-1">Output Key Key *</label>
                        <input
                          type="text"
                          required
                          value={newRuleKey}
                          onChange={(e) => setNewRuleKey(e.target.value)}
                          placeholder="e.g. slat_count"
                          className="w-full bg-brand-card border border-brand-border rounded-lg px-3 py-2 text-xs text-brand-text outline-none focus:border-brand-primary"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-brand-muted uppercase mb-1">math.js Algebraic Formula *</label>
                        <textarea
                          required
                          ref={formulaInputRef}
                          value={newRuleExpr}
                          onChange={(e) => setNewRuleExpr(e.target.value)}
                          placeholder="e.g. ceil((run_length - 50) / 74)"
                          className="w-full bg-brand-card border border-brand-border rounded-lg px-3 py-2 text-xs text-brand-text outline-none focus:border-brand-primary h-20 resize-none font-mono"
                        />
                      </div>

                      <div className="grid grid-cols-1 gap-2">
                        <div>
                          <label className="block text-[10px] font-bold text-brand-muted uppercase mb-1">Execution Stage</label>
                          <select
                            value={newRuleStage}
                            onChange={(e) => setNewRuleStage(e.target.value as any)}
                            className="w-full bg-brand-card border border-brand-border rounded-lg px-2 py-2 text-xs text-brand-text outline-none"
                          >
                            <option value="derive">derive (Calculate measurements)</option>
                            <option value="stock">stock (Derive raw material stock lengths)</option>
                            <option value="accessory">accessory (Derive screws, caps & brackets)</option>
                            <option value="component">component (Derive final assembly items)</option>
                          </select>
                        </div>
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-brand-muted uppercase mb-1">Description / Notes</label>
                        <input
                          type="text"
                          value={newRuleDesc}
                          onChange={(e) => setNewRuleDesc(e.target.value)}
                          placeholder="e.g. Calculate base panels count"
                          className="w-full bg-brand-card border border-brand-border rounded-lg px-3 py-2 text-xs text-brand-text outline-none focus:border-brand-primary"
                        />
                      </div>

                      <Button type="submit" variant="primary" className="w-full justify-center">
                        Add Calculation Rule
                      </Button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {/* 4. SELECTORS TAB */}
            {activeTab === "selectors" && (
              <div className="space-y-6">
                <div className="border-b border-brand-border pb-4">
                  <h3 className="text-lg font-black flex items-center gap-2 text-brand-text">
                    <Database size={20} className="text-brand-primary" />
                    Inventory Component SKU Mapping Selectors
                  </h3>
                  <p className="text-xs text-brand-muted mt-0.5">Write selector rules mapping variable conditions to catalogue SKU patterns containing color/finish placeholders.</p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  {/* Selectors grid */}
                  <div className="lg:col-span-2 space-y-3">
                    <h4 className="text-xs font-black uppercase tracking-wider text-brand-muted">Active Selectors ({selectors.length})</h4>
                    {selectors.map((sel) => (
                      <div 
                        key={sel.id} 
                        className="bg-brand-bg border border-brand-border p-4 rounded-xl flex items-center justify-between gap-4"
                      >
                        <div>
                          <span className="text-[10px] px-2 py-0.5 bg-brand-accent/15 border border-brand-accent/25 text-brand-accent rounded font-bold uppercase">
                            {sel.category}
                          </span>
                          <h4 className="font-mono text-sm font-black text-brand-text mt-2">
                            Pattern: <span className="text-brand-primary">{sel.skuPattern}</span>
                          </h4>
                          {sel.matchCriteria && (
                            <p className="text-xs text-brand-muted mt-1">
                              Applies when: <code className="bg-brand-card px-1 py-0.5 rounded border border-brand-border/40 font-mono">{sel.matchCriteria}</code>
                            </p>
                          )}
                        </div>
                        <button
                          onClick={() => handleDeleteSelector(sel.id)}
                          className="p-2 text-brand-muted hover:text-brand-danger rounded-lg transition-colors shrink-0"
                          title="Delete Selector"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ))}
                  </div>

                  {/* Add Selector form */}
                  <form onSubmit={handleAddSelector} className="bg-brand-bg border border-brand-border rounded-xl p-5 space-y-4">
                    <h4 className="text-sm font-black flex items-center gap-2 border-b border-brand-border/40 pb-2 text-brand-text">
                      <Plus size={16} className="text-brand-primary" />
                      Add SKU Selector Rule
                    </h4>

                    <div className="space-y-3">
                      <div>
                        <label className="block text-[10px] font-bold text-brand-muted uppercase mb-1">Material Category</label>
                        <select
                          value={newSelCategory}
                          onChange={(e) => setNewSelCategory(e.target.value)}
                          className="w-full bg-brand-card border border-brand-border rounded-lg px-2 py-2 text-xs text-brand-text outline-none"
                        >
                          <option value="slat">slat</option>
                          <option value="post">post</option>
                          <option value="rail">rail</option>
                          <option value="screw">screw</option>
                          <option value="bracket">bracket</option>
                          <option value="gate_hardware">gate_hardware</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-brand-muted uppercase mb-1">Match Criteria (comma list)</label>
                        <input
                          type="text"
                          value={newSelCriteria}
                          onChange={(e) => setNewSelCriteria(e.target.value)}
                          placeholder="e.g. slat_size_mm=65, finish=standard"
                          className="w-full bg-brand-card border border-brand-border rounded-lg px-3 py-2 text-xs text-brand-text outline-none focus:border-brand-primary"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-brand-muted uppercase mb-1">Target SKU Pattern (use &#123;&#125; variables) *</label>
                        <input
                          type="text"
                          required
                          value={newSelSkuPattern}
                          onChange={(e) => setNewSelSkuPattern(e.target.value)}
                          placeholder="e.g. GO-POST-90-{colour}"
                          className="w-full bg-brand-card border border-brand-border rounded-lg px-3 py-2 text-xs text-brand-text outline-none focus:border-brand-primary font-mono"
                        />
                      </div>

                      <Button type="submit" variant="primary" className="w-full justify-center">
                        Add SKU Selector
                      </Button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {/* 5. TESTS TAB */}
            {activeTab === "tests" && (
              <div className="space-y-6">
                <div className="border-b border-brand-border pb-4">
                  <h3 className="text-lg font-black flex items-center gap-2 text-brand-text">
                    <Play size={20} className="text-brand-primary" />
                    Regression Testing Suite
                  </h3>
                  <p className="text-xs text-brand-muted mt-0.5">Author input variables and assert expected output BOM quantities. Run validation checks to verify correctness.</p>
                </div>

                <div className="space-y-4 max-w-3xl">
                  {testCases.map((tc) => (
                    <div 
                      key={tc.id} 
                      className="bg-brand-bg border border-brand-border rounded-2xl p-5 space-y-4"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-brand-border/40 pb-3">
                        <div>
                          <h4 className="font-extrabold text-brand-text">{tc.name}</h4>
                          <p className="text-[11px] text-brand-muted mt-0.5">Asserts correct slat panel counts & fastening accessories.</p>
                        </div>
                        <Button 
                          variant="primary" 
                          size="small" 
                          icon={Play}
                          onClick={() => runRegressionTest(tc)}
                          className="shadow-sm shrink-0"
                        >
                          Execute Test Case
                        </Button>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                        <div className="space-y-1 bg-brand-card p-3 rounded-lg border border-brand-border/40">
                          <span className="font-bold text-brand-muted uppercase text-[9px] block">Test Inputs</span>
                          <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
                            {Object.entries(tc.inputs).map(([k, v]) => (
                              <div key={k}>
                                <span className="text-brand-muted">{k}:</span> <span className="text-brand-accent font-bold">{v}</span>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="space-y-1 bg-brand-card p-3 rounded-lg border border-brand-border/40">
                          <span className="font-bold text-brand-muted uppercase text-[9px] block">Assert Expected Outputs</span>
                          <div className="space-y-1 text-[11px] font-mono">
                            {tc.expectedOutputs.map((out) => (
                              <div key={out.sku} className="flex justify-between">
                                <span className="text-brand-muted">{out.sku}:</span>
                                <span className="text-brand-text font-black">{out.quantity} items</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Test Case Status Bar */}
                      {tc.status && tc.status !== "idle" && (
                        <div className={`flex items-center gap-2 p-3 rounded-xl border text-xs font-semibold ${
                          tc.status === "passed"
                            ? "bg-brand-success/10 border-brand-success/30 text-brand-success"
                            : "bg-brand-danger/10 border-brand-danger/30 text-brand-danger"
                        }`}>
                          {tc.status === "passed" ? (
                            <>
                              <CheckCircle2 size={16} />
                              <span>PASSED: Outputs matched assertion expectations exactly!</span>
                            </>
                          ) : (
                            <>
                              <XCircle size={16} />
                              <div className="flex-1">
                                <span>FAILED: Calculations did not match assertions.</span>
                                {tc.errorLog && <p className="text-[10px] font-mono text-brand-muted mt-1">{tc.errorLog}</p>}
                              </div>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          </div>

          <div className="lg:col-span-4">
            <BuildForgeChatPanel
              onApplyMeta={handleApplyMeta}
              onAddVariable={handleApplyAddVariable}
              onAddRule={handleApplyAddRule}
              onMapSelector={handleApplyMapSelector}
              onAddTest={handleApplyAddTest}
              onComplete={handleApplyComplete}
              currentValues={{
                name: calcName,
                description: calcDescription,
                supplierId: selectedSupplierId,
                archetypeId: selectedArchetypeId,
                visibility: visibility,
                variables: variables,
                rules: rules,
                selectors: selectors,
                tests: testCases,
              }}
            />
          </div>
        </div>
        </div>
      </div>

      {showWizard && (
        <CalculatorBuilderWizard
          onClose={() => setShowWizard(false)}
          onApply={handleApplyWizard}
          supplierId={selectedSupplierId}
          archetypeId={selectedArchetypeId}
          calcName={calcName}
          calcDescription={calcDescription}
        />
      )}
    </AppShell>
  );
}

