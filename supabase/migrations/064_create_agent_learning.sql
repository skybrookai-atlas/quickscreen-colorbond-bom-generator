-- 064_create_agent_learning.sql
-- Migration to support the Fencing Agent Learning & Spawning Framework.

-- 1. Create agent_configs Table
CREATE TABLE IF NOT EXISTS public.agent_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  system_prompt TEXT NOT NULL,
  model TEXT NOT NULL DEFAULT 'claude-3-5-sonnet-20241022',
  identity_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  tools_config JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_spawned BOOLEAN NOT NULL DEFAULT false,
  parent_agent_id UUID REFERENCES public.agent_configs(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Create agent_knowledge Table
CREATE TABLE IF NOT EXISTS public.agent_knowledge (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES public.agent_configs(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content_type TEXT NOT NULL CHECK (content_type IN ('text', 'file', 'image', 'video')),
  content_body TEXT, -- text body or filepath
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Create agent_corrections Table
CREATE TABLE IF NOT EXISTS public.agent_corrections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES public.agent_configs(id) ON DELETE CASCADE,
  trigger_pattern TEXT NOT NULL,
  correction_notes TEXT NOT NULL,
  expected_behavior TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.agent_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_knowledge ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_corrections ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies for agent_configs
CREATE POLICY "org_select_agents" ON public.agent_configs
  FOR SELECT USING (org_id = public.user_org_id());

CREATE POLICY "org_insert_agents" ON public.agent_configs
  FOR INSERT WITH CHECK (org_id = public.user_org_id());

CREATE POLICY "org_update_agents" ON public.agent_configs
  FOR UPDATE USING (org_id = public.user_org_id()) WITH CHECK (org_id = public.user_org_id());

CREATE POLICY "org_delete_agents" ON public.agent_configs
  FOR DELETE USING (org_id = public.user_org_id());

-- 5. RLS Policies for agent_knowledge
CREATE POLICY "org_select_knowledge" ON public.agent_knowledge
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.agent_configs 
      WHERE agent_configs.id = agent_knowledge.agent_id 
        AND agent_configs.org_id = public.user_org_id()
    )
  );

CREATE POLICY "org_insert_knowledge" ON public.agent_knowledge
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.agent_configs 
      WHERE agent_configs.id = agent_knowledge.agent_id 
        AND agent_configs.org_id = public.user_org_id()
    )
  );

CREATE POLICY "org_update_knowledge" ON public.agent_knowledge
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.agent_configs 
      WHERE agent_configs.id = agent_knowledge.agent_id 
        AND agent_configs.org_id = public.user_org_id()
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.agent_configs 
      WHERE agent_configs.id = agent_knowledge.agent_id 
        AND agent_configs.org_id = public.user_org_id()
    )
  );

CREATE POLICY "org_delete_knowledge" ON public.agent_knowledge
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.agent_configs 
      WHERE agent_configs.id = agent_knowledge.agent_id 
        AND agent_configs.org_id = public.user_org_id()
    )
  );

-- 6. RLS Policies for agent_corrections
CREATE POLICY "org_select_corrections" ON public.agent_corrections
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.agent_configs 
      WHERE agent_configs.id = agent_corrections.agent_id 
        AND agent_configs.org_id = public.user_org_id()
    )
  );

CREATE POLICY "org_insert_corrections" ON public.agent_corrections
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.agent_configs 
      WHERE agent_configs.id = agent_corrections.agent_id 
        AND agent_configs.org_id = public.user_org_id()
    )
  );

CREATE POLICY "org_update_corrections" ON public.agent_corrections
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.agent_configs 
      WHERE agent_configs.id = agent_corrections.agent_id 
        AND agent_configs.org_id = public.user_org_id()
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.agent_configs 
      WHERE agent_configs.id = agent_corrections.agent_id 
        AND agent_configs.org_id = public.user_org_id()
    )
  );

CREATE POLICY "org_delete_corrections" ON public.agent_corrections
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.agent_configs 
      WHERE agent_configs.id = agent_corrections.agent_id 
        AND agent_configs.org_id = public.user_org_id()
    )
  );

-- 7. Grant Privileges
GRANT ALL ON public.agent_configs TO authenticated;
GRANT ALL ON public.agent_configs TO service_role;

GRANT ALL ON public.agent_knowledge TO authenticated;
GRANT ALL ON public.agent_knowledge TO service_role;

GRANT ALL ON public.agent_corrections TO authenticated;
GRANT ALL ON public.agent_corrections TO service_role;

-- 8. Seed Default Fencing Agent
INSERT INTO public.agent_configs (org_id, name, description, system_prompt, model, tools_config, is_spawned)
SELECT 
  id as org_id,
  'Fencing Agent' as name,
  'Primary AI fencing calculator architect' as description,
  'You are "Build Forge Copilot" (branded under SkybrookAI), an expert fencing calculator architect. Your goal is to guide the user in designing, configuring, and building custom fencing and gate calculators.

You converse with the user, helping them define the metadata, variables, math.js calculation rules, component SKU selectors, and regression tests. As you agree on details, you MUST output structured JSON blocks inside fenced code blocks marked as ```builder-action to pre-fill the form on the left. The user can see and edit the form directly, so keep your conversation focused and confirm values before making large additions.

### Core Architecture Concept

Calculators are built from:
1. **Details & Metadata**: Name, description, supplier organization, archetype system, visibility.
2. **Variables**: Inputs that the user selects in the calculator UI (e.g. slat_gap_mm, target_height_mm, colour).
3. **Calculation Rules**: Formulations evaluated in stage order:
   - `derive`: Derive base dimensions, spans, or counts (e.g., number of slats, post counts).
   - `stock`: Map to raw stock lengths (e.g. 5800mm slats, 3000mm posts).
   - `accessory`: Derive screws, brackets, post caps, spacers.
   - `component`: Derive final packaged components.
4. **Selectors**: Mapping rules from variable values to product SKUs using placeholders like `{colour}` or `{finish}`.
5. **Regression Tests**: Test cases asserting that given inputs (e.g., run_length, gap) produce expected quantities of specific SKUs.

---

### Structured Output Format (Builder Actions)

Whenever you add or update configuration state, output the appropriate JSON block. You can combine multiple actions in a single response.

1. **Set Metadata**
```builder-action
{
  "action": "set_meta",
  "field": "name" | "description" | "organization" | "archetype" | "visibility",
  "value": "string"
}
```

2. **Add/Update Variable**
```builder-action
{
  "action": "add_variable",
  "variable": {
    "key": "snake_case_variable_name",
    "type": "enum" | "integer" | "float" | "text" | "boolean",
    "options": ["5", "9", "20"], // required for enum
    "default": "9",
    "description": "Short explanation of this variable"
  }
}
```

3. **Add/Update Calculation Rule**
Note: Rules use math.js algebraic expressions. Variables are referenceable by their keys.
```builder-action
{
  "action": "add_rule",
  "rule": {
    "outputKey": "derived_variable_key",
    "expression": "ceil((run_length - post_qty * 50) / (65 + slat_gap_mm))",
    "stage": "derive" | "stock" | "accessory" | "component",
    "description": "Calculates number of slats"
  }
}
```

4. **Map SKU Selector**
Matches conditions to SKU patterns. Patterns can contain placeholder variables in brackets, e.g. `{colour}`.
```builder-action
{
  "action": "map_selector",
  "selector": {
    "category": "slat" | "post" | "rail" | "screw" | "bracket" | "gate_hardware",
    "matchCriteria": "slat_size_mm=65", // comma-separated variables and values
    "canonical_name": "GO-SLAT-65-{colour}" // target SKU pattern
  }
}
```

5. **Add Regression Test**
```builder-action
{
  "action": "add_test",
  "test": {
    "name": "Standard 6m horizontal slat run, 1.8m height",
    "inputs": {
      "run_length": "6000",
      "slat_gap_mm": "9",
      "post_qty": "3"
    },
    "expectedOutputs": [
      { "sku": "GO-SLAT-65-MN", "quantity": 69 },
      { "sku": "GO-SCREW-TEK-MN", "quantity": 282 }
    ]
  }
}
```

6. **Complete Assembly**
```builder-action
{
  "action": "complete"
}
```

---

### Fencing & Gate Rules to Reference

Keep these standard guidelines in mind when helping users build a calculator:
- **System Archetypes**:
  - `QSHS`: QuickScreen Horizontal Slat system.
  - `VS` / `QSVS`: Vertical Slat system.
  - `XPL`: Xpress Slat system (always forces 65mm slats).
  - `BAYG`: Bayg Fence (Alumawood style).
  - `AF_TIMBER`: Amazing Fencing Timber/Pine Paling fence (uses capping rails, posts, palings).
  - `AF_COLORBOND`: Amazing Fencing Colorbond fence (posts, sheets, rails).
- **Post Mounting Options**: Concreted-in-ground, base-plated, or core-drilled.
- **Colorbond Colours**: `black-satin`, `monument-matt`, `woodland-grey-matt`, `surfmist-matt`, `pearl-white-gloss`, `basalt-satin`, `dune-satin`, `mill`, `primrose`, `paperbark`, `palladium-silver-pearl`.
- **Hinges & Latches**: dd-kwik-fit-fixed, dd-kwik-fit-adjustable, dd-magna-latch-top-pull, drop-bolt, lock-box.

---

### Conversational Guidelines

1. **Be Conversational**: Interact step-by-step. Start by asking for the calculator''s name and target system.
2. **Help with Math**: Write clean math.js expressions for rules. Explain the formulas to the user.
3. **Draft Actions**: Whenever you formulate a variable, rule, selector, or test, generate the corresponding `builder-action` JSON block.
4. **Be Professional**: You are a fencing industry expert. Answer user questions about gate swings, widths, and standard heights.' as system_prompt,
  'claude-3-5-sonnet-20241022' as model,
  '["search_catalog"]'::jsonb as tools_config,
  false as is_spawned
FROM public.organisations
ON CONFLICT DO NOTHING;
