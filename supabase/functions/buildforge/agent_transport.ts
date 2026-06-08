// agent_transport.ts
// Swappable agent transport contract for communicating with the Build Forge agent.

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
    onChunk: (chunk: AgentResponseChunk) => void
  ): Promise<void>;
}

/**
 * Mock implementation of Build Forge Agent Transport.
 * Streams canned chat prose and builder-action blocks to test the front-end wizard.
 * 
 * TODO (Dependency D1): Once the hosted agent platform credentials and API endpoints
 * are confirmed, replace this mock with a real platform-specific client (e.g. Claude API or Custom Agent gateway).
 */
export class MockAgentTransport implements AgentTransport {
  async createSession(context: AgentContext): Promise<{ sessionId: string; threadId: string }> {
    console.log('[MockAgent] Creating session with signed context:', context);
    // Simulate API delay
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
    onChunk: (chunk: AgentResponseChunk) => void
  ): Promise<void> {
    console.log(`[MockAgent] Message received for session ${sessionId}: "${message}"`);

    // Determine mock response based on the conversation turn or message keyword
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
          text: "Great! I have updated the calculator details and metadata in the first tab. \n\n```builder-action\n{\n  \"action\": \"set_meta\",\n  \"field\": \"name\",\n  \"value\": \"Premium Modern Slat Screen\"\n}\n```\n```builder-action\n{\n  \"action\": \"set_meta\",\n  \"field\": \"description\",\n  \"value\": \"Visual custom fence calculator for premium horizontal slat configurations.\"\n}\n```\n\nNext, let's configure the variables in the **Variables** tab. I'm adding `slat_gap_mm` with gap options (5, 9, 20) and a default of 9mm.\n\n```builder-action\n{\n  \"action\": \"add_variable\",\n  \"variable\": {\n    \"key\": \"slat_gap_mm\",\n    \"label\": \"Slat Gap (mm)\",\n    \"type\": \"enum\",\n    \"options\": [\"5\", \"9\", \"20\"],\n    \"default\": \"9\",\n    \"description\": \"Space between slats in millimeters\"\n  }\n}\n```\n\nWould you like to add the calculations rules now?",
        },
      ];
    } else if (msgLower.includes('rule') || msgLower.includes('calculation') || msgLower.includes('yes')) {
      steps = [
        {
          text: "Done! I've added a rule for calculating the slat count based on the run length.\n\n```builder-action\n{\n  \"action\": \"add_rule\",\n  \"rule\": {\n    \"id\": \"rule-3\",\n    \"outputKey\": \"slat_count\",\n    \"expression\": \"ceil((run_length - post_qty * 50) / (65 + slat_gap_mm))\",\n    \"stage\": \"derive\",\n    \"description\": \"Calculates the total number of horizontal slats required\"\n  }\n}\n```\n\nNext, we need to map our canonical items to inventory items in the **Selectors** tab. I will map the `slat` category.\n\n```builder-action\n{\n  \"action\": \"map_selector\",\n  \"selector\": {\n    \"canonical_name\": \"GO-SLAT-65-{colour}\",\n    \"supplier_sku\": \"FZSMO17\",\n    \"price_aud\": 16.30,\n    \"unit\": \"each\",\n    \"pack_size\": 1\n  }\n}\n```\n\nShould we set up a regression test next?",
        },
      ];
    } else if (msgLower.includes('test') || msgLower.includes('regression')) {
      steps = [
        {
          text: "Perfect! I've added a regression test case to verify the calculation output for a 6m run.\n\n```builder-action\n{\n  \"action\": \"add_test\",\n  \"test\": {\n    \"name\": \"Standard 6m horizontal slat run, 1.8m height\",\n    \"inputs\": {\n      \"run_length\": \"6000\",\n      \"slat_gap_mm\": \"9\",\n      \"post_qty\": \"3\"\n    },\n    \"expectedOutputs\": [\n      { \"sku\": \"GO-SLAT-65-MN\", \"quantity\": 69 },\n      { \"sku\": \"GO-SCREW-TEK-MN\", \"quantity\": 282 }\n    ]\n  }\n}\n```\n\nEverything looks excellent. We've defined variables, rules, selectors, and tests. We can now mark the builder as complete.\n\n```builder-action\n{\n  \"action\": \"complete\",\n  \"config_ref\": \"fence_system_config.json\",\n  \"submit_for_approval\": true\n}\n```\n\nYour calculator configuration is assembled and ready to be submitted to the National Network!",
        },
      ];
    } else {
      steps = [
        {
          text: `I've received your message: "${message}". Let's continue building. You can tell me to set metadata, add variables, rules, or test cases.`,
        },
      ];
    }

    // Stream the output word by word to simulate streaming latency
    for (const step of steps) {
      const tokens = step.text.split(/(\s+)/);
      for (const token of tokens) {
        onChunk({ type: 'text', content: token });
        // Small delay to simulate streaming tokens
        await new Promise((resolve) => setTimeout(resolve, 15));
      }
    }
  }
}
