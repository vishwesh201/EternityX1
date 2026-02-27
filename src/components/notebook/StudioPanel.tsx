import { useState, useEffect, useRef } from "react";
import {
  Headphones,
  FileText,
  BookOpen,
  Clock,
  HelpCircle,
  Video,
  Plus,
  Trash2,
  StickyNote,
  X,
  Pause,
  Play,
  Square,
  Loader2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { VideoPlayer } from "./VideoPlayer";
import { MarkdownRenderer } from "@/components/ui/markdown-renderer";

interface Props {
  notebookId: string;
}

const studioActions = [
  { id: "audio", label: "Audio Overview", description: "Generate a podcast-style discussion", icon: Headphones, color: "bg-purple-100 text-purple-700", prompt: "Create a podcast-style audio script discussion about the sources. Write it as a natural conversation between two hosts discussing the key topics, findings, and insights. Make it engaging and educational. Format with Host 1: and Host 2: labels." },
  { id: "briefing", label: "Briefing Doc", description: "Create a comprehensive summary", icon: FileText, color: "bg-blue-100 text-blue-700", prompt: "Create a comprehensive briefing document summarizing all the sources. Include an executive summary, key findings, important details, and conclusions. Use headers and bullet points for clarity." },
  { id: "guide", label: "Study Guide", description: "Generate a study guide with key concepts", icon: BookOpen, color: "bg-green-100 text-green-700", prompt: "Create a detailed study guide based on the sources. Include key concepts, definitions, important facts, review questions, and study tips. Organize by topic with clear headers." },
  { id: "timeline", label: "Timeline", description: "Build a chronological timeline", icon: Clock, color: "bg-orange-100 text-orange-700", prompt: "Create a chronological timeline of events, developments, and milestones mentioned in the sources. Format each entry with a date/period and description. Use arrow notation (→) for sequence." },
  { id: "faq", label: "FAQ", description: "Generate frequently asked questions", icon: HelpCircle, color: "bg-pink-100 text-pink-700", prompt: "Generate a comprehensive FAQ (Frequently Asked Questions) based on the sources. Include 8-12 questions that someone studying this material would likely ask, with clear, detailed answers citing the sources." },
  { id: "video", label: "Video", description: "Create a presentation with voiceover", icon: Video, color: "bg-cyan-100 text-cyan-700", prompt: "" },
];

interface VideoData {
  title: string;
  slides: { title: string; points: string[]; narration: string; color: string }[];
}

export function StudioPanel({ notebookId }: Props) {
  const [notes, setNotes] = useState<any[]>([]);
  const [newNote, setNewNote] = useState("");
  const [generatedContent, setGeneratedContent] = useState<{ id: string; label: string; content: string } | null>(null);
  const [editedContent, setEditedContent] = useState<string>("");
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [videoData, setVideoData] = useState<VideoData | null>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (!notebookId) return;
    supabase
      .from("notes")
      .select("*")
      .eq("notebook_id", notebookId)
      .order("created_at", { ascending: false })
      .then(({ data }) => setNotes(data || []));
  }, [notebookId]);

  const fetchSources = async () => {
    const { data: sources } = await supabase
      .from("sources")
      .select("name, content, excerpt")
      .eq("notebook_id", notebookId);
    if (!sources || sources.length === 0) {
      toast({ title: "No sources", description: "Add sources to your notebook first.", variant: "destructive" });
      return null;
    }
    return sources;
  };

  const handleVideoAction = async () => {
    if (loadingAction) return;
    setLoadingAction("video");
    setVideoData(null);
    setGeneratedContent(null);

    try {
      const sources = await fetchSources();
      if (!sources) { setLoadingAction(null); return; }

      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-slides`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ sources }),
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: `Error ${resp.status}` }));
        throw new Error(err.error || `Error ${resp.status}`);
      }

      const data = await resp.json();
      setVideoData(data);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setLoadingAction(null);
    }
  };

  const handleAction = async (action: typeof studioActions[0]) => {
    if (action.id === "video") {
      handleVideoAction();
      return;
    }

    if (loadingAction) return;
    setLoadingAction(action.id);
    setGeneratedContent(null);
    setVideoData(null);

    try {
      const sources = await fetchSources();
      if (!sources) { setLoadingAction(null); return; }

      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          messages: [{ role: "user", content: action.prompt }],
          sources,
        }),
      });

      if (!resp.ok) throw new Error(`Error ${resp.status}`);
      if (!resp.body) throw new Error("No stream");

      let content = "";
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
              content += c;
              setGeneratedContent({ id: action.id, label: action.label, content });
            }
          } catch {
            buf = line + "\n" + buf;
            break;
          }
        }
      }

      if (content) {
        setGeneratedContent({ id: action.id, label: action.label, content });
      }
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setLoadingAction(null);
    }
  };

  const playAudio = (text: string) => {
    if (!("speechSynthesis" in window)) {
      toast({ title: "Not supported", description: "Your browser doesn't support text-to-speech.", variant: "destructive" });
      return;
    }
    speechSynthesis.cancel();
    const clean = text.replace(/^(Host [12]:|[\[\]#*→]|\[SCENE\]|\[NARRATION\]|\[VISUAL\])/gm, "").trim();
    const utterance = new SpeechSynthesisUtterance(clean);
    utterance.rate = 1;
    utterance.pitch = 1;
    utterance.onend = () => { setIsPlaying(false); setIsPaused(false); };
    utterance.onerror = () => { setIsPlaying(false); setIsPaused(false); };
    utteranceRef.current = utterance;
    speechSynthesis.speak(utterance);
    setIsPlaying(true);
    setIsPaused(false);
  };

  useEffect(() => {
    setEditedContent(generatedContent?.content || "");
  }, [generatedContent]);

  const togglePause = () => {
    if (isPaused) { speechSynthesis.resume(); setIsPaused(false); }
    else { speechSynthesis.pause(); setIsPaused(true); }
  };

  const stopAudio = () => {
    speechSynthesis.cancel();
    setIsPlaying(false);
    setIsPaused(false);
  };

  const addNote = async () => {
    if (!newNote.trim() || !user) return;
    const { data } = await supabase
      .from("notes")
      .insert({ notebook_id: notebookId, user_id: user.id, text: newNote.trim() })
      .select()
      .single();
    if (data) { setNotes((prev) => [data, ...prev]); setNewNote(""); }
  };

  const deleteNote = async (id: string) => {
    await supabase.from("notes").delete().eq("id", id);
    setNotes((prev) => prev.filter((n) => n.id !== id));
  };

  const saveAsNote = async () => {
    if (!generatedContent || !user) return;
    const textToSave = (generatedContent.id === "audio" ? (editedContent || generatedContent.content) : generatedContent.content) || "";
    const { data } = await supabase
      .from("notes")
      .insert({
        notebook_id: notebookId,
        user_id: user.id,
        text: `[${generatedContent.label}]\n${textToSave}`,
        tag: generatedContent.id,
      })
      .select()
      .single();
    if (data) { setNotes((prev) => [data, ...prev]); toast({ title: "Saved as note" }); }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b border-outline-variant">
        <h2 className="text-sm font-medium text-foreground">Studio</h2>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin px-4 py-3 space-y-4">
        {/* Video player */}
        {videoData && (
          <VideoPlayer
            title={videoData.title}
            slides={videoData.slides as any}
            onClose={() => setVideoData(null)}
          />
        )}

        {/* Generated content display */}
        {generatedContent && (
          <div className="rounded-2xl border border-outline-variant bg-card p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-foreground">{generatedContent.label}</h3>
              <div className="flex items-center gap-1">
                {generatedContent.id === "audio" && (
                  <>
                    {!isPlaying ? (
                      <button onClick={() => playAudio(editedContent || generatedContent.content)} className="p-1.5 rounded-full hover:bg-surface-dim text-on-surface-variant transition-colors" title="Play audio">
                        <Play className="w-4 h-4" />
                      </button>
                    ) : (
                      <>
                        <button onClick={togglePause} className="p-1.5 rounded-full hover:bg-surface-dim text-on-surface-variant transition-colors">
                          {isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
                        </button>
                        <button onClick={stopAudio} className="p-1.5 rounded-full hover:bg-surface-dim text-on-surface-variant transition-colors">
                          <Square className="w-3.5 h-3.5" />
                        </button>
                      </>
                    )}
                  </>
                )}
                <button onClick={saveAsNote} className="p-1.5 rounded-full hover:bg-surface-dim text-on-surface-variant transition-colors" title="Save as note">
                  <StickyNote className="w-4 h-4" />
                </button>
                <button onClick={() => { setGeneratedContent(null); stopAudio(); }} className="p-1.5 rounded-full hover:bg-surface-dim text-on-surface-variant transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="text-xs text-foreground leading-relaxed max-h-64 overflow-y-auto scrollbar-thin">
              {generatedContent.id === "audio" ? (
                <div className="space-y-3">
                  <textarea
                    value={editedContent}
                    onChange={(e) => setEditedContent(e.target.value)}
                    className="w-full bg-transparent text-xs text-foreground focus:outline-none resize-none p-0"
                    rows={6}
                  />
                  <div className="pt-2 border-t border-outline-variant">
                    <div className="text-[11px] text-on-surface-variant mb-1">Preview</div>
                    <div className="prose prose-xs dark:prose-invert max-h-40 overflow-y-auto">
                      <MarkdownRenderer content={editedContent || generatedContent.content} />
                    </div>
                  </div>
                </div>
              ) : (
                <MarkdownRenderer content={generatedContent.content} />
              )}
            </div>
          </div>
        )}

        {/* Loading indicator */}
        {loadingAction && !generatedContent && !videoData && (
          <div className="flex flex-col items-center py-6">
            <Loader2 className="w-6 h-6 text-primary animate-spin mb-2" />
            <p className="text-xs text-on-surface-variant">
              {loadingAction === "video" ? "Creating presentation..." : "Generating..."}
            </p>
          </div>
        )}

        {/* Action cards */}
        <div className="grid grid-cols-2 gap-2">
          {studioActions.map((action) => (
            <button
              key={action.id}
              onClick={() => handleAction(action)}
              disabled={!!loadingAction}
              className="flex flex-col items-start p-3 rounded-2xl border border-outline-variant bg-card hover:bg-surface-dim hover:border-outline transition-all text-left group disabled:opacity-50"
            >
              <div className={`w-8 h-8 rounded-xl ${action.color} flex items-center justify-center mb-2`}>
                {loadingAction === action.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <action.icon className="w-4 h-4" />}
              </div>
              <span className="text-xs font-medium text-foreground">{action.label}</span>
            </button>
          ))}
        </div>

        {/* FAQ panel removed */}

        {/* Notes section */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-medium text-on-surface-variant uppercase tracking-wider">Notes</h3>
            <button onClick={() => document.getElementById("note-input")?.focus()} className="p-1 rounded-full hover:bg-surface-dim text-on-surface-variant transition-colors">
              <Plus className="w-4 h-4" />
            </button>
          </div>
          <div className="flex gap-2 mb-3">
            <input
              id="note-input"
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              placeholder="Add a note..."
              onKeyDown={(e) => e.key === "Enter" && addNote()}
              className="flex-1 px-3 py-2 text-xs rounded-xl bg-card border border-outline-variant text-foreground placeholder:text-on-surface-variant focus:outline-none focus:border-primary transition-colors"
            />
          </div>
          <div className="space-y-1.5">
            {notes.length === 0 && (
              <div className="flex flex-col items-center py-6 text-center">
                <StickyNote className="w-8 h-8 text-on-surface-variant mb-2 opacity-40" />
                <p className="text-xs text-on-surface-variant">Save notes from your research</p>
              </div>
            )}
            {notes.map((n) => (
              <div key={n.id} className="group flex items-start gap-2 p-3 rounded-xl bg-card border border-outline-variant hover:border-outline transition-colors">
                <StickyNote className="w-3.5 h-3.5 text-on-surface-variant shrink-0 mt-0.5" />
                <div className="text-xs text-foreground flex-1 leading-relaxed">
                  <MarkdownRenderer content={n.text} />
                </div>
                <button onClick={() => deleteNote(n.id)} className="p-0.5 rounded opacity-0 group-hover:opacity-100 hover:text-destructive text-on-surface-variant transition-all shrink-0">
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
