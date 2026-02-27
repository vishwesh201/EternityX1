import { useState, useEffect } from "react";
import { Upload, FileText, Globe, Trash2, File, Plus, Check, Square, CheckSquare, Search, Video, Loader2, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { MarkdownRenderer } from "@/components/ui/markdown-renderer";

interface Source {
  id: string;
  name: string;
  type: string;
  excerpt: string | null;
  created_at: string;
  selected?: boolean;
}

const typeIcons: Record<string, typeof FileText> = {
  pdf: FileText,
  docx: File,
  url: Globe,
  txt: FileText,
  md: FileText,
  video: Video,
  youtube: Video,
};

interface SearchResult {
  title: string;
  url: string;
  summary: string;
}

interface Props {
  notebookId: string;
}

export function SourcesPanel({ notebookId }: Props) {
  const [sources, setSources] = useState<Source[]>([]);
  const [previewSource, setPreviewSource] = useState<Source | null>(null);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [urlInput, setUrlInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isScrapingUrl, setIsScrapingUrl] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (!notebookId) return;
    supabase
      .from("sources")
      .select("*")
      .eq("notebook_id", notebookId)
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        if (data) {
          setSources(data);
          setSelectedIds(new Set(data.map((s) => s.id)));
        }
      });
  }, [notebookId]);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (selectedIds.size === sources.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(sources.map((s) => s.id)));
  };

  const handleFileUpload = async (files: FileList | null) => {
    if (!files || !user) return;
    for (const file of Array.from(files)) {
      const text = await file.text();
      const ext = file.name.split(".").pop()?.toLowerCase() || "txt";
      const { data, error } = await supabase
        .from("sources")
        .insert({
          notebook_id: notebookId,
          user_id: user.id,
          name: file.name,
          type: ext,
          content: text,
          excerpt: text.slice(0, 200),
        })
        .select()
        .single();
      if (data) {
        setSources((prev) => [data, ...prev]);
        setSelectedIds((prev) => new Set(prev).add(data.id));
        toast({ title: "Source added", description: file.name });
      }
    }
  };

  const addUrl = async () => {
    if (!urlInput.trim() || !user) return;
    setIsScrapingUrl(true);
    
    try {
      // Scrape the URL content
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/scrape-url`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ url: urlInput.trim() }),
      });

      let name = urlInput;
      let content = `Web source: ${urlInput}`;
      let type = "url";

      if (resp.ok) {
        const scraped = await resp.json();
        name = scraped.title || urlInput;
        content = scraped.content || content;
        // Detect video URLs
        if (urlInput.match(/youtube\.com|youtu\.be|vimeo\.com/)) {
          type = "youtube";
        }
      }

      const { data } = await supabase
        .from("sources")
        .insert({
          notebook_id: notebookId,
          user_id: user.id,
          name,
          type,
          url: urlInput.trim(),
          content,
          excerpt: content.slice(0, 200),
        })
        .select()
        .single();
      
      if (data) {
        setSources((prev) => [data, ...prev]);
        setSelectedIds((prev) => new Set(prev).add(data.id));
        setUrlInput("");
        setShowUrlInput(false);
        toast({ title: "Source added", description: name });
      }
    } catch (e) {
      toast({ title: "Error", description: "Failed to fetch URL content", variant: "destructive" });
    } finally {
      setIsScrapingUrl(false);
    }
  };

  const handleWebSearch = async () => {
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    setSearchResults([]);

    try {
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/web-search`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ query: searchQuery.trim() }),
      });

      if (!resp.ok) throw new Error("Search failed");
      const data = await resp.json();
      setSearchResults(data.results || []);
    } catch (e) {
      toast({ title: "Search error", description: "Failed to search. Try again.", variant: "destructive" });
    } finally {
      setIsSearching(false);
    }
  };

  const addSearchResult = async (result: SearchResult) => {
    if (!user) return;
    
    // Scrape the actual content
    try {
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/scrape-url`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ url: result.url }),
      });

      let content = result.summary;
      if (resp.ok) {
        const scraped = await resp.json();
        content = scraped.content || result.summary;
      }

      const { data } = await supabase
        .from("sources")
        .insert({
          notebook_id: notebookId,
          user_id: user.id,
          name: result.title,
          type: "url",
          url: result.url,
          content,
          excerpt: content.slice(0, 200),
        })
        .select()
        .single();

      if (data) {
        setSources((prev) => [data, ...prev]);
        setSelectedIds((prev) => new Set(prev).add(data.id));
        setSearchResults((prev) => prev.filter((r) => r.url !== result.url));
        toast({ title: "Source added", description: result.title });
      }
    } catch {
      toast({ title: "Error", description: "Failed to add source", variant: "destructive" });
    }
  };

  const deleteSource = async (id: string) => {
    await supabase.from("sources").delete().eq("id", id);
    setSources((prev) => prev.filter((s) => s.id !== id));
    setSelectedIds((prev) => { const next = new Set(prev); next.delete(id); return next; });
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-outline-variant">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-medium text-foreground">Sources</h2>
          {sources.length > 0 && (
            <button onClick={selectAll} className="text-xs text-primary hover:underline">
              {selectedIds.size === sources.length ? "Deselect all" : "Select all"}
            </button>
          )}
        </div>
      </div>

      {/* Search panel */}
      {showSearch && (
        <div className="px-3 py-2 border-b border-outline-variant bg-surface-dim/50 space-y-2">
          <div className="flex items-center gap-2">
            <div className="flex-1 flex gap-1">
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search the web..."
                onKeyDown={(e) => e.key === "Enter" && handleWebSearch()}
                className="flex-1 px-3 py-2 text-xs rounded-lg bg-card border border-outline-variant text-foreground placeholder:text-on-surface-variant focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <button
                onClick={handleWebSearch}
                disabled={isSearching}
                className="px-3 py-2 text-xs rounded-lg bg-primary text-primary-foreground font-medium disabled:opacity-50"
              >
                {isSearching ? <Loader2 className="w-3 h-3 animate-spin" /> : <Search className="w-3 h-3" />}
              </button>
            </div>
            <button onClick={() => { setShowSearch(false); setSearchResults([]); }} className="p-1 text-on-surface-variant hover:text-foreground">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Search results */}
          {searchResults.length > 0 && (
            <div className="space-y-1 max-h-48 overflow-y-auto scrollbar-thin">
              {searchResults.map((result, i) => (
                <div key={i} className="flex items-start gap-2 p-2 rounded-lg bg-card border border-outline-variant hover:border-outline transition-colors">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-foreground truncate">{result.title}</p>
                    <p className="text-[10px] text-on-surface-variant line-clamp-2 mt-0.5">{result.summary}</p>
                  </div>
                  <button
                    onClick={() => addSearchResult(result)}
                    className="shrink-0 px-2 py-1 text-[10px] rounded-md bg-primary text-primary-foreground font-medium hover:bg-primary/90"
                  >
                    Add
                  </button>
                </div>
              ))}
            </div>
          )}

          {isSearching && (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="w-4 h-4 animate-spin text-primary" />
              <span className="text-xs text-on-surface-variant ml-2">Searching...</span>
            </div>
          )}
        </div>
      )}

      {/* Sources list */}
      <div className="flex-1 overflow-y-auto scrollbar-thin px-3 py-2">
        {sources.length === 0 ? (
          <div className="text-center py-8 px-4">
            <div className="w-12 h-12 rounded-full bg-surface-dim mx-auto mb-3 flex items-center justify-center">
              <FileText className="w-6 h-6 text-on-surface-variant" />
            </div>
            <p className="text-sm text-on-surface-variant mb-1">No sources added</p>
            <p className="text-xs text-on-surface-variant">Add sources to ground your research</p>
          </div>
        ) : (
          <div className="space-y-1">
            {sources.map((source) => {
              const Icon = typeIcons[source.type] || FileText;
              const isSelected = selectedIds.has(source.id);
              return (
                <div key={source.id} className="group flex items-center gap-2 px-2 py-2.5 rounded-xl hover:bg-surface-dim transition-colors">
                  <button onClick={() => toggleSelect(source.id)} className="shrink-0 text-on-surface-variant">
                    {isSelected ? <CheckSquare className="w-4 h-4 text-primary" /> : <Square className="w-4 h-4" />}
                  </button>
                  <div className="w-7 h-7 rounded-lg bg-primary-container flex items-center justify-center shrink-0">
                    <Icon className="w-3.5 h-3.5 text-accent-foreground" />
                  </div>
                  <button onClick={() => setPreviewSource(source)} className="text-xs text-foreground truncate flex-1 text-left hover:underline">
                    {source.name}
                  </button>
                  <button
                    onClick={() => deleteSource(source.id)}
                    className="p-1 rounded-full opacity-0 group-hover:opacity-100 hover:bg-destructive/10 text-on-surface-variant hover:text-destructive transition-all shrink-0"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              );
            })}
            {/* Preview panel */}
            {previewSource && (
              <div className="mt-3 p-3 rounded-lg border border-outline-variant bg-card">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <div className="text-sm font-medium text-foreground">{previewSource.name}</div>
                    <div className="text-[11px] text-on-surface-variant">{previewSource.type}</div>
                  </div>
                  <button onClick={() => setPreviewSource(null)} className="text-on-surface-variant hover:text-foreground">Close</button>
                </div>
                <div className="text-xs text-foreground leading-relaxed max-h-48 overflow-y-auto scrollbar-thin">
                  <MarkdownRenderer content={previewSource.content || previewSource.excerpt || ""} />
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* URL input */}
      {showUrlInput && (
        <div className="px-3 py-2 border-t border-outline-variant">
          <div className="flex gap-2">
            <input
              type="url"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder="Paste URL or YouTube link..."
              onKeyDown={(e) => e.key === "Enter" && addUrl()}
              className="flex-1 px-3 py-2 text-xs rounded-lg bg-surface-dim border-0 text-foreground placeholder:text-on-surface-variant focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <button
              onClick={addUrl}
              disabled={isScrapingUrl}
              className="px-3 py-2 text-xs rounded-lg bg-primary text-primary-foreground font-medium disabled:opacity-50"
            >
              {isScrapingUrl ? <Loader2 className="w-3 h-3 animate-spin" /> : "Add"}
            </button>
          </div>
        </div>
      )}

      {/* Add source buttons */}
      <div className="p-3 border-t border-outline-variant space-y-2">
        <div className="flex gap-2">
          <label className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-full bg-primary-container text-accent-foreground text-xs font-medium hover:shadow-soft transition-all cursor-pointer">
            <Plus className="w-4 h-4" />
            Add source
            <input
              type="file"
              multiple
              accept=".pdf,.docx,.txt,.md"
              onChange={(e) => handleFileUpload(e.target.files)}
              className="hidden"
            />
          </label>
          <button
            onClick={() => { setShowUrlInput(!showUrlInput); setShowSearch(false); }}
            className="px-4 py-2.5 rounded-full border border-outline text-xs text-on-surface-variant font-medium hover:bg-surface-dim transition-colors"
          >
            URL
          </button>
          <button
            onClick={() => { setShowSearch(!showSearch); setShowUrlInput(false); }}
            className="px-4 py-2.5 rounded-full border border-outline text-xs text-on-surface-variant font-medium hover:bg-surface-dim transition-colors"
          >
            <Search className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
