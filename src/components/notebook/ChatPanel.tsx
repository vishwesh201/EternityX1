import { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { Copy, ThumbsUp, ThumbsDown, Sparkles, ArrowUp, RotateCcw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { MarkdownRenderer } from "@/components/ui/markdown-renderer";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

const suggestions = [
  "Summarize these sources",
  "What are the key themes?",
  "Create a study guide",
  "What are the main arguments?",
  "Generate an FAQ",
  "Create a timeline",
];

interface Props {
  notebookId: string;
}

export function ChatPanel({ notebookId }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (!notebookId) return;
    supabase
      .from("chat_messages")
      .select("*")
      .eq("notebook_id", notebookId)
      .order("created_at", { ascending: true })
      .then(({ data }) => {
        if (data) setMessages(data.map((m) => ({ id: m.id, role: m.role as "user" | "assistant", content: m.content })));
      });
  }, [notebookId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const handleSend = async (text?: string) => {
    const content = (text || input).trim();
    if (!content || isStreaming) return;
    setInput("");

    const userMsg: Message = { id: Date.now().toString(), role: "user", content };
    setMessages((prev) => [...prev, userMsg]);

    await supabase.from("chat_messages").insert({
      notebook_id: notebookId, user_id: user!.id, role: "user", content,
    });

    const { data: sources } = await supabase
      .from("sources")
      .select("name, content, excerpt")
      .eq("notebook_id", notebookId);

    setIsStreaming(true);
    let assistantContent = "";
    const assistantId = (Date.now() + 1).toString();

    try {
      const chatMessages = [...messages, userMsg].map((m) => ({ role: m.role, content: m.content }));
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ messages: chatMessages, sources: sources || [] }),
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: "Request failed" }));
        throw new Error(err.error || `Error ${resp.status}`);
      }
      if (!resp.body) throw new Error("No stream");

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        let nl: number;
        while ((nl = buf.indexOf("\n")) !== -1) {
          let line = buf.slice(0, nl);
          buf = buf.slice(nl + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (!line.startsWith("data: ") || line.startsWith(":") || !line.trim()) continue;
          const json = line.slice(6).trim();
          if (json === "[DONE]") break;
          try {
            const c = JSON.parse(json).choices?.[0]?.delta?.content;
            if (c) {
              assistantContent += c;
              setMessages((prev) => {
                const last = prev[prev.length - 1];
                if (last?.id === assistantId) return prev.map((m) => m.id === assistantId ? { ...m, content: assistantContent } : m);
                return [...prev, { id: assistantId, role: "assistant", content: assistantContent }];
              });
            }
          } catch { buf = line + "\n" + buf; break; }
        }
      }

      if (assistantContent) {
        await supabase.from("chat_messages").insert({
          notebook_id: notebookId, user_id: user!.id, role: "assistant", content: assistantContent,
        });
      }
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setIsStreaming(false);
    }
  };

  const copyText = (t: string) => {
    navigator.clipboard.writeText(t);
    toast({ title: "Copied" });
  };

  return (
    <div className="flex flex-col h-full">
      <div ref={scrollRef} className="flex-1 overflow-y-auto scrollbar-thin px-6 py-8">
        <div className="max-w-2xl mx-auto space-y-6">
          {/* Empty state */}
          {messages.length === 0 && !isStreaming && (
            <div className="flex flex-col items-center justify-center pt-16 pb-8">
              <div className="w-14 h-14 rounded-full bg-primary-container flex items-center justify-center mb-6">
                <Sparkles className="w-7 h-7 text-primary" />
              </div>
              <h2 className="text-xl font-normal text-foreground mb-2">
                Ask about your sources
              </h2>
              <p className="text-sm text-on-surface-variant text-center max-w-md mb-8">
                EternityX will answer based on your uploaded sources. Add sources on the left to get started.
              </p>
              <div className="flex flex-wrap justify-center gap-2 max-w-lg">
                {suggestions.map((s) => (
                  <button
                    key={s}
                    onClick={() => handleSend(s)}
                    className="px-4 py-2 text-sm rounded-full border border-outline-variant text-on-surface-variant hover:bg-surface-dim hover:text-foreground transition-colors"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Messages */}
          {messages.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
            >
              {msg.role === "user" ? (
                <div className="flex justify-end">
                  <div className="max-w-lg px-4 py-3 rounded-2xl rounded-br-md bg-chat-user text-foreground text-sm leading-relaxed">
                    {msg.content}
                  </div>
                </div>
              ) : (
                <div className="flex gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary-container flex items-center justify-center shrink-0 mt-1">
                    <Sparkles className="w-4 h-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-foreground leading-relaxed">
                      <MarkdownRenderer content={msg.content} />
                    </div>
                    <div className="flex items-center gap-0.5 mt-3">
                      <button onClick={() => copyText(msg.content)} className="p-2 rounded-full hover:bg-surface-dim text-on-surface-variant transition-colors">
                        <Copy className="w-4 h-4" />
                      </button>
                      <button className="p-2 rounded-full hover:bg-surface-dim text-on-surface-variant transition-colors">
                        <ThumbsUp className="w-4 h-4" />
                      </button>
                      <button className="p-2 rounded-full hover:bg-surface-dim text-on-surface-variant transition-colors">
                        <ThumbsDown className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          ))}

          {/* Typing indicator */}
          {isStreaming && messages[messages.length - 1]?.role !== "assistant" && (
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-primary-container flex items-center justify-center shrink-0">
                <Sparkles className="w-4 h-4 text-primary" />
              </div>
              <div className="flex gap-1.5 py-3">
                <span className="w-2 h-2 rounded-full bg-on-surface-variant animate-pulse-dot" />
                <span className="w-2 h-2 rounded-full bg-on-surface-variant animate-pulse-dot [animation-delay:0.2s]" />
                <span className="w-2 h-2 rounded-full bg-on-surface-variant animate-pulse-dot [animation-delay:0.4s]" />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Floating input — EternityX style */}
      <div className="px-6 pb-6">
        <div className="max-w-2xl mx-auto">
          {messages.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-3">
              {suggestions.slice(0, 4).map((s) => (
                <button
                  key={s}
                  onClick={() => handleSend(s)}
                  className="px-3 py-1.5 text-xs rounded-full border border-outline-variant text-on-surface-variant hover:bg-surface-dim transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          )}
          <div className="flex items-end gap-2 bg-card rounded-3xl border border-outline-variant shadow-card px-4 py-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
              }}
              placeholder="Start typing..."
              rows={1}
              className="flex-1 resize-none bg-transparent text-sm text-foreground placeholder:text-on-surface-variant focus:outline-none py-2 max-h-32"
            />
            <button
              onClick={() => handleSend()}
              disabled={!input.trim() || isStreaming}
              className="p-2.5 rounded-full bg-primary text-primary-foreground disabled:opacity-30 hover:shadow-elevated transition-all mb-0.5"
            >
              <ArrowUp className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
