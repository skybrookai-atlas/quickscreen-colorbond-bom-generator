// index.ts
// Supabase Edge Function serving as the Backend Proxy for Build Forge.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, handleCors } from "../_shared/cors.ts";
import { extractJwt } from "../_shared/auth.ts";
import { MockAgentTransport, AnthropicAgentTransport, AgentContext } from "./agent_transport.ts";
import { FENCING_AGENT_SYSTEM_PROMPT } from "./fencing_agent_prompt.ts";

Deno.serve(async (req: Request) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    // 1. Authenticate user
    const jwt = extractJwt(req);
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const {
      data: { user },
      error: authError,
    } = await supabaseAdmin.auth.getUser(jwt);

    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized user session" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Resolve user's profile and organisation
    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("role, email, org_id")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      return new Response(JSON.stringify({ error: "User profile not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: org, error: orgError } = await supabaseAdmin
      .from("organisations")
      .select("id, name, slug")
      .eq("id", profile.org_id)
      .single();

    if (orgError || !org) {
      return new Response(JSON.stringify({ error: "Supplier organization not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Determine route from pathname or request body
    const url = new URL(req.url);
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const action = body.action || (url.pathname.endsWith("/session") ? "session" : url.pathname.endsWith("/message") ? "message" : "");
    const agentMode = body.agentMode || "mock";
    const transport = agentMode === "live" ? new AnthropicAgentTransport() : new MockAgentTransport();

    // Prepare signed identity context payload (server-side derived)
    const context: AgentContext = {
      email: profile.email || user.email || "",
      userId: user.id,
      supplierOrg: {
        id: org.id,
        name: org.name,
        slug: org.slug,
      },
      role: (profile.role ?? "user") as "user" | "staff" | "admin",
      productsLoaded: true,
    };

    if (action === "session") {
      // 2. Open Build Forge Session
      const sessionData = await transport.createSession(context);

      // Log session start in buildforge_usage
      const { error: logError } = await supabaseAdmin
        .from("buildforge_usage")
        .insert({
          id: sessionData.sessionId.replace("bf-session-", "") || undefined, // use unique part if valid UUID
          user_id: user.id,
          org_id: org.id,
          outcome: "active",
          started_at: new Date().toISOString(),
        });

      if (logError) {
        console.error("Failed to log Build Forge session start:", logError);
      }

      return new Response(JSON.stringify(sessionData), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    } else if (action === "message") {
      const sessionId = body.sessionId;
      const text = body.text;
      const history = body.history || [];
      const agentId = body.agentId; // Allow client to specify which spawned agent to run

      if (!sessionId || !text) {
        return new Response(JSON.stringify({ error: "Missing sessionId or message text" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Fetch active agent config
      let agentConfig = null;
      if (agentId) {
        const { data } = await supabaseAdmin
          .from("agent_configs")
          .select("*")
          .eq("id", agentId)
          .eq("org_id", org.id)
          .maybeSingle();
        agentConfig = data;
      }

      if (!agentConfig) {
        // Fallback to primary Fencing Agent config
        const { data } = await supabaseAdmin
          .from("agent_configs")
          .select("*")
          .eq("is_spawned", false)
          .eq("org_id", org.id)
          .maybeSingle();
        agentConfig = data;
      }

      // Compile system instructions dynamically
      const basePrompt = agentConfig ? agentConfig.system_prompt : FENCING_AGENT_SYSTEM_PROMPT;
      const modelName = agentConfig ? agentConfig.model : "claude-3-5-sonnet-20241022";
      
      // Resolve tools
      let toolsConfig: string[] = ["search_catalog"];
      if (agentConfig && Array.isArray(agentConfig.tools_config)) {
        toolsConfig = agentConfig.tools_config as string[];
      }

      let compiledPrompt = basePrompt;
      if (agentConfig) {
        // Fetch knowledge assets and corrections parallelly
        const [knowledgeRes, correctionsRes] = await Promise.all([
          supabaseAdmin.from("agent_knowledge").select("*").eq("agent_id", agentConfig.id),
          supabaseAdmin.from("agent_corrections").select("*").eq("agent_id", agentConfig.id),
        ]);

        const knowledgeList = knowledgeRes.data || [];
        const correctionsList = correctionsRes.data || [];

        if (knowledgeList.length > 0) {
          compiledPrompt += "\n\n### ADDITIONAL LEARNED KNOWLEDGE (Knowledge Base)\n";
          for (const k of knowledgeList) {
            compiledPrompt += `\n- **Asset: ${k.title} (${k.content_type})**\n${k.content_body}\n`;
          }
        }

        if (correctionsList.length > 0) {
          compiledPrompt += "\n\n### CORRECTIONS & BEHAVIOURAL RULES (Feedback Loop)\n";
          compiledPrompt += "You MUST correct your behavior according to these feedback logs:\n";
          for (const c of correctionsList) {
            compiledPrompt += `\n- When user says/triggers: "${c.trigger_pattern}"\n  Feedback Note: ${c.correction_notes}\n  Expected Correct Response: ${c.expected_behavior}\n`;
          }
        }
      }

      // Increment message count on usage tracker
      const { data: activeUsage } = await supabaseAdmin
        .from("buildforge_usage")
        .select("id, message_count")
        .eq("user_id", user.id)
        .eq("outcome", "active")
        .order("started_at", { ascending: false })
        .limit(1)
        .single();

      if (activeUsage) {
        await supabaseAdmin
          .from("buildforge_usage")
          .update({ message_count: activeUsage.message_count + 1 })
          .eq("id", activeUsage.id);
      }

      // Create SSE Stream Response
      const encoder = new TextEncoder();
      const customStream = new ReadableStream({
        async start(controller) {
          try {
            await transport.sendMessage(
              sessionId, 
              text, 
              history, 
              compiledPrompt, 
              modelName, 
              toolsConfig, 
              org.id, 
              (chunk) => {
                const sseLine = `data: ${JSON.stringify(chunk)}\n\n`;
                controller.enqueue(encoder.encode(sseLine));
              }
            );
          } catch (streamErr) {
            console.error("Streaming error:", streamErr);
            const errLine = `data: ${JSON.stringify({ error: streamErr.message })}\n\n`;
            controller.enqueue(encoder.encode(errLine));
          } finally {
            controller.close();
          }
        },
      });

      return new Response(customStream, {
        headers: {
          ...corsHeaders,
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          "Connection": "keep-alive",
        },
      });

    } else {
      return new Response(JSON.stringify({ error: "Invalid action. Must be 'session' or 'message'" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

  } catch (err) {
    const msg = err instanceof Error ? err.message : "Internal error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
