import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { url } = await req.json();
    if (!url) {
      return new Response(JSON.stringify({ error: "URL is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if YouTube URL
    const ytMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/);
    
    let content = "";
    let title = url;

    if (ytMatch) {
      // For YouTube, try to get video info via oEmbed
      const videoId = ytMatch[1];
      try {
        const oembedResp = await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`);
        if (oembedResp.ok) {
          const oembed = await oembedResp.json();
          title = oembed.title || `YouTube Video: ${videoId}`;
          content = `YouTube Video: ${oembed.title}\nAuthor: ${oembed.author_name}\nURL: https://www.youtube.com/watch?v=${videoId}\n\nNote: Video transcript extraction requires additional API access. The video metadata has been captured.`;
        }
      } catch {
        title = `YouTube Video: ${videoId}`;
        content = `YouTube Video ID: ${videoId}\nURL: https://www.youtube.com/watch?v=${videoId}`;
      }
    } else {
      // Fetch regular webpage
      try {
        const resp = await fetch(url, {
          headers: {
            "User-Agent": "Mozilla/5.0 (compatible; EternityX/1.0)",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          },
          redirect: "follow",
        });

        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

        const html = await resp.text();
        
        // Extract title
        const titleMatch = html.match(/<title[^>]*>(.*?)<\/title>/is);
        if (titleMatch) title = titleMatch[1].replace(/\s+/g, " ").trim();

        // Extract text content - remove scripts, styles, tags
        content = html
          .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
          .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
          .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, "")
          .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, "")
          .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, "")
          .replace(/<[^>]+>/g, " ")
          .replace(/&nbsp;/g, " ")
          .replace(/&amp;/g, "&")
          .replace(/&lt;/g, "<")
          .replace(/&gt;/g, ">")
          .replace(/&quot;/g, '"')
          .replace(/&#39;/g, "'")
          .replace(/\s+/g, " ")
          .trim()
          .slice(0, 50000); // Limit content size
      } catch (e) {
        content = `Failed to fetch content from ${url}: ${e instanceof Error ? e.message : "Unknown error"}`;
      }
    }

    return new Response(JSON.stringify({ title, content, url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("scrape-url error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
