// agent_transport.ts
// Swappable agent transport contract for communicating with the Build Forge agent.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export interface AgentContext {
  email: string;
  userId: string;
  supplierOrg: {
    id: string;
    name: string;
    slug: string;
  };
  role: 'user' | 'staff' | 'admin';
  productsLoaded: boolean;
}

export interface AgentResponseChunk {
  type: 'text' | 'action' | 'ack_request';
  content: string; // The token/chunk text or the action JSON string
}

export interface AgentTransport {
  createSession(context: AgentContext): Promise<{ sessionId: string; threadId: string }>;
  sendMessage(
    sessionId: string,
    message: string,
    history: Array<{ role: 'user' | 'assistant'; content: string | any[] }>,
    compiledPrompt: string,
    model: string,
    tools: string[],
    orgId: string,
    onChunk: (chunk: AgentResponseChunk) => void
  ): Promise<void>;
}

/**
 * Live Anthropic Claude implementation of the Build Forge Agent Transport.
 * Streams responses token-by-token using the Anthropic Messages API.
 * Includes tool use capability for querying the database catalogue.
 */
export class AnthropicAgentTransport implements AgentTransport {
  async createSession(context: AgentContext): Promise<{ sessionId: string; threadId: string }> {
    console.log('[AnthropicAgent] Creating session with context:', context.userId);
    const randomId = Math.random().toString(36).substring(7);
    return {
      sessionId: `bf-session-${randomId}`,
      threadId: `bf-thread-${randomId}`,
    };
  }

  async sendMessage(
    sessionId: string,
    message: string,
    history: Array<{ role: 'user' | 'assistant'; content: string | any[] }>,
    compiledPrompt: string,
    model: string,
    tools: string[],
    orgId: string,
    onChunk: (chunk: AgentResponseChunk) => void
  ): Promise<void> {
    console.log(`[AnthropicAgent] Message received for session ${sessionId}: "${message}" using model ${model}`);
    
    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) {
      console.warn("[AnthropicAgent] ANTHROPIC_API_KEY is not configured.");
      const fallbackText = "Hello! I am ready to be your live Fence Building Agent, but the **ANTHROPIC_API_KEY** environment secret is not set in your Supabase project. \n\nPlease run the following command in your local shell to configure it:\n```bash\nnpx supabase secrets set ANTHROPIC_API_KEY=your_key_here\n```\nOnce configured, I will connect directly to Claude to help you build your custom calculator!";
      const tokens = fallbackText.split(/(\s+)/);
      for (const token of tokens) {
        onChunk({ type: 'text', content: token });
        await new Promise((resolve) => setTimeout(resolve, 15));
      }
      return;
    }

    // Prepare Anthropic Tools schemas
    const availableTools: any[] = [];
    if (tools.includes("search_catalog")) {
      availableTools.push({
        name: "search_catalog",
        description: "Searches the supplier product catalogue for matching SKUs, names, descriptions, or prices. Use this tool when the user asks about what products, slats, posts, rails, or gate components exist, or when mapping selectors.",
        input_schema: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description: "The search term (e.g. woodland grey post, FZSMO17)"
            },
            category: {
              type: "string",
              description: "Optional category filter (e.g. slat, post, rail, screw, bracket, gate_hardware)"
            }
          },
          required: ["query"]
        }
      });
    }

    const messages = [...history];
    const lastMsg = messages[messages.length - 1];
    
    // Normalize last message format to check equivalence
    const isLastUser = lastMsg && lastMsg.role === "user";
    const isEquivalent = isLastUser && (
      typeof lastMsg.content === "string" 
        ? lastMsg.content === message 
        : Array.isArray(lastMsg.content) && lastMsg.content.some(c => c.type === "text" && c.text === message)
    );

    if (!isEquivalent) {
      messages.push({ role: "user", content: message });
    }

    let keepRunning = true;
    let runCount = 0;
    const maxRuns = 5;

    while (keepRunning && runCount < maxRuns) {
      runCount++;
      
      const payload: any = {
        model: model || "claude-3-5-sonnet-20241022",
        max_tokens: 4000,
        system: compiledPrompt,
        messages: messages,
        stream: true
      };

      if (availableTools.length > 0) {
        payload.tools = availableTools;
      }

      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Anthropic API error: ${response.status} - ${errText}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("Failed to get stream reader");

      const decoder = new TextDecoder();
      let buffer = "";
      let responseText = "";
      let toolCalls: any[] = [];
      let activeToolCall: any = null;

      try {
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith("data: ")) continue;

            const dataStr = trimmed.substring(6).trim();
            if (dataStr === "[DONE]") continue;

            try {
              const data = JSON.parse(dataStr);
              
              if (data.type === "content_block_start") {
                if (data.content_block?.type === "tool_use") {
                  activeToolCall = {
                    id: data.content_block.id,
                    name: data.content_block.name,
                    input: ""
                  };
                  onChunk({ 
                    type: 'text', 
                    content: `\n\n*[Agent is using tool: ${data.content_block.name}...]*\n` 
                  });
                }
              } else if (data.type === "content_block_delta") {
                if (data.delta?.type === "text_delta" && data.delta.text) {
                  responseText += data.delta.text;
                  onChunk({ type: 'text', content: data.delta.text });
                } else if (data.delta?.type === "input_json_delta" && data.delta.partial_json) {
                  if (activeToolCall) {
                    activeToolCall.input += data.delta.partial_json;
                  }
                }
              } else if (data.type === "content_block_stop") {
                if (activeToolCall) {
                  try {
                    activeToolCall.input = JSON.parse(activeToolCall.input);
                  } catch (_e) {
                    // Fallback to raw string if JSON parsing is in progress or fails
                  }
                  toolCalls.push(activeToolCall);
                  activeToolCall = null;
                }
              }
            } catch (_err) {
              // Ignore partial JSON splits
            }
          }
        }
      } finally {
        reader.releaseLock();
      }

      if (toolCalls.length === 0) {
        keepRunning = false;
        break;
      }

      // Add assistant message containing the tool use request to history
      const assistantMessageContent: any[] = [];
      if (responseText) {
        assistantMessageContent.push({ type: "text", text: responseText });
      }
      for (const tc of toolCalls) {
        assistantMessageContent.push({
          type: "tool_use",
          id: tc.id,
          name: tc.name,
          input: tc.input
        });
      }
      messages.push({ role: "assistant", content: assistantMessageContent });

      // Execute tool call and append tool result
      const toolResultsMessageContent: any[] = [];
      for (const tc of toolCalls) {
        onChunk({ type: 'text', content: `\n*[Researching: ${tc.name} with search query "${tc.input.query}"]*\n` });
        
        let result = "No result";
        try {
          if (tc.name === "search_catalog") {
            const query = tc.input.query || "";
            const category = tc.input.category || "";
            
            const supabaseAdmin = createClient(
              Deno.env.get("SUPABASE_URL")!,
              Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
            );
            
            let queryBuilder = supabaseAdmin
              .from("product_components")
              .select("sku, name, description, category, unit, default_price")
              .eq("org_id", orgId);

            queryBuilder = queryBuilder.or(`sku.ilike.%${query}%,name.ilike.%${query}%,description.ilike.%${query}%`);
            if (category) {
              queryBuilder = queryBuilder.eq("category", category);
            }

            const { data, error } = await queryBuilder.limit(10);
            if (error) throw error;
            
            result = JSON.stringify(data || []);
            onChunk({ type: 'text', content: `\n*[Research complete: Found ${data?.length || 0} catalog matches]*\n\n` });
          } else {
            result = `Unknown tool: ${tc.name}`;
          }
        } catch (err) {
          result = `Error executing tool: ${err instanceof Error ? err.message : String(err)}`;
        }

        toolResultsMessageContent.push({
          type: "tool_result",
          tool_use_id: tc.id,
          content: result
        });
      }

      messages.push({ role: "user", content: toolResultsMessageContent });
    }
  }
}

/**
 * Mock implementation of Build Forge Agent Transport.
 * Streams canned chat prose and builder-action blocks to test the front-end wizard.
 */
export class MockAgentTransport implements AgentTransport {
  async createSession(context: AgentContext): Promise<{ sessionId: string; threadId: string }> {
    console.log('[MockAgent] Creating session with signed context:', context.userId);
    await new Promise((resolve) => setTimeout(resolve, 300));
    const randomId = Math.random().toString(36).substring(7);
    return {
      sessionId: `bf-session-${randomId}`,
      threadId: `bf-thread-${randomId}`,
    };
  }

  async sendMessage(
    sessionId: string,
    message: string,
    _history: Array<{ role: 'user' | 'assistant'; content: string | any[] }>,
    _compiledPrompt: string,
    _model: string,
    _tools: string[],
    _orgId: string,
    onChunk: (chunk: AgentResponseChunk) => void
  ): Promise<void> {
    console.log(`[MockAgent] Message received for session ${sessionId}: "${message}"`);

    const msgLower = message.toLowerCase();
    let steps: Array<{ text: string; action?: any }> = [];

    if (msgLower.includes('hello') || msgLower.includes('hi') || msgLower.includes('start')) {
      steps = [
        {
          text: "Hi there! I'm Build Forge, your conversational guide to building a custom fence calculator. I see you're logged in and we've loaded your supplier context.\n\nLet's start by setting your calculator's metadata. What name and description should we give your horizontal slat calculator?",
        },
      ];
    } else if (msgLower.includes('name') || msgLower.includes('premium') || msgLower.includes('modern')) {
      steps = [
        {
          text: "Great! I have updated the calculator details and metadata in the first tab. \n\n```builder-action\n{\n  \"action\": \"set_meta\",\n  \"field\": \"name\",\n  \"value\": \"Premium Modern Slat Screen\"\n}\n```\n```builder-action\n{\n  \"action\": \"set_meta\",\n  \"field\": \"description\",\n  \"value\": \"Visual custom fence calculator for premium horizontal slat configurations.\"\n}\n```\n\nNext, let's configure the variables in the **Variables** tab. I'm adding `slat_gap_mm` with gap options (5, 9, 20) and a default of 9mm.\n\n```builder-action\n{\n  \"action\": \"add_variable\",\n  \"variable\": {\n    \"key\": \"slat_gap_mm\",\n    \"type\": \"enum\",\n    \"options\": [\"5\", \"9\", \"20\"],\n    \"default\": \"9\",\n    \"description\": \"Space between slats in millimeters\"\n  }\n}\n```\n\nWould you like to add the calculations rules now?",
        },
      ];
    } else if (msgLower.includes('rule') || msgLower.includes('calculation') || msgLower.includes('yes')) {
      steps = [
        {
          text: "Done! I've added a rule for calculating the slat count based on the run length.\n\n```builder-action\n{\n  \"action\": \"add_rule\",\n  \"rule\": {\n    \"outputKey\": \"slat_count\",\n    \"expression\": \"ceil((run_length - post_qty * 50) / (65 + slat_gap_mm))\",\n    \"stage\": \"derive\",\n    \"description\": \"Calculates the total number of horizontal slats required\"\n  }\n}\n```\n\nNext, we need to map our canonical items to inventory items in the **Selectors** tab. I will map the `slat` category.\n\n```builder-action\n{\n  \"action\": \"map_selector\",\n  \"selector\": {\n    \"category\": \"slat\",\n    \"matchCriteria\": \"slat_size_mm=65\",\n    \"canonical_name\": \"GO-SLAT-65-{colour}\"\n  }\n}\n```\n\nShould we set up a regression test next?",
        },
      ];
    } else if (msgLower.includes('test') || msgLower.includes('regression')) {
      steps = [
        {
          text: "Perfect! I've added a regression test case to verify the calculation output for a 6m run.\n\n```builder-action\n{\n  \"action\": \"add_test\",\n  \"test\": {\n    \"name\": \"Standard 6m horizontal slat run, 1.8m height\",\n    \"inputs\": {\n      \"run_length\": \"6000\",\n      \"slat_gap_mm\": \"9\",\n      \"post_qty\": \"3\"\n    },\n    \"expectedOutputs\": [\n      { \"sku\": \"GO-SLAT-65-MN\", \"quantity\": 69 },\n      { \"sku\": \"GO-SCREW-TEK-MN\", \"quantity\": 282 }\n    ]\n  }\n}\n```\n\nEverything looks excellent. We've defined variables, rules, selectors, and tests. We can now mark the builder as complete.\n\n```builder-action\n{\n  \"action\": \"complete\"\n}\n```\n\nYour calculator configuration is assembled and ready to be submitted to the National Network!",
        },
      ];
    } else {
      steps = [
        {
          text: `I've received your message: "${message}". Let's continue building. You can tell me to set metadata, add variables, rules, or test cases.`,
        },
      ];
    }

    for (const step of steps) {
      const tokens = step.text.split(/(\s+)/);
      for (const token of tokens) {
        onChunk({ type: 'text', content: token });
        await new Promise((resolve) => setTimeout(resolve, 15));
      }
    }
  }
}
