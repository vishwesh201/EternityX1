import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { sources } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    if (!sources || sources.length === 0) {
      return new Response(JSON.stringify({ error: "No sources provided" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let sourceContext = "";
    for (const source of sources) {
      sourceContext += `\n--- Source: ${source.name} ---\n${source.content || source.excerpt || "No content available"}\n`;
    }

    const systemPrompt = `You are a presentation creator. Given research sources, create an engaging video presentation with 5-8 slides. Each slide should have a clear title, 2-4 key bullet points, and a narration script that a speaker would read aloud. The narration should be conversational and educational, like a documentary narrator. Make the first slide an introduction and the last slide a conclusion/summary.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Create a video presentation based on these sources:\n${sourceContext}` },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "create_presentation",
              description: "Create a structured video presentation with slides",
              parameters: {
                type: "object",
                properties: {
                  title: { type: "string", description: "Overall presentation title" },
                  slides: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        title: { type: "string", description: "Slide title" },
                        points: {
                          type: "array",
                          items: { type: "string" },
                          description: "2-4 key bullet points for the slide",
                        },
                        narration: { type: "string", description: "Speaker narration script for this slide (2-4 sentences)" },
                        color: { type: "string", enum: ["blue", "purple", "green", "orange", "pink", "cyan"], description: "Accent color theme for the slide" },
                      },
                      required: ["title", "points", "narration", "color"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["title", "slides"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "create_presentation" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI usage credits exhausted." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "AI service error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    
    if (!toolCall) {
      console.error("No tool call in response:", JSON.stringify(data));
      return new Response(JSON.stringify({ error: "Failed to generate presentation" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const presentation = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify(presentation), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-slides error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
