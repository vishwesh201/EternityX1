import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Plus, MoreVertical, Trash2, LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

interface NotebookRow {
  id: string;
  title: string;
  emoji: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

function timeAgo(date: string) {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (seconds < 60) return "Just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`;
  return new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function Dashboard() {
  const [notebooks, setNotebooks] = useState<NotebookRow[]>([]);
  const [loading, setLoading] = useState(true);
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    supabase
      .from("notebooks")
      .select("*")
      .order("updated_at", { ascending: false })
      .then(({ data }) => {
        setNotebooks(data || []);
        setLoading(false);
      });
  }, []);

  const createNotebook = async () => {
    const emojis = ["📓", "🧠", "📊", "🚀", "📚", "🌍", "💡", "🔬"];
    const { data, error } = await supabase
      .from("notebooks")
      .insert({
        user_id: user!.id,
        title: "Untitled notebook",
        emoji: emojis[Math.floor(Math.random() * emojis.length)],
      })
      .select()
      .single();
    if (data) navigate(`/notebook/${data.id}`);
  };

  const deleteNotebook = async (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    await supabase.from("notebooks").delete().eq("id", id);
    setNotebooks((prev) => prev.filter((n) => n.id !== id));
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Top bar — matches EternityX */}
      <header className="h-16 border-b border-outline-variant flex items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-2.5">
          <img src="/eternity-logo.svg" alt="EternityX" className="w-8 h-8 rounded-full bg-background object-cover" />
          <span className="text-lg font-medium text-foreground tracking-tight">EternityX</span>
        </div>
        <button
          onClick={signOut}
          className="flex items-center gap-2 px-4 py-2 rounded-full text-sm text-on-surface-variant hover:bg-surface-dim transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Sign out
        </button>
      </header>

      <div className="max-w-5xl mx-auto px-4 py-8 sm:px-6 sm:py-12">
        {/* Welcome section */}
        <div className="text-center mb-10">
          <h1 className="text-3xl font-normal text-foreground mb-2">
            Welcome to EternityX
          </h1>
          <p className="text-base text-on-surface-variant">
            Upload sources and start researching
          </p>
        </div>

        {/* Create new button */}
        <div className="flex justify-center mb-12">
          <button
            onClick={createNotebook}
            className="flex items-center gap-2 px-6 py-3 rounded-full bg-primary-container text-accent-foreground text-sm font-medium hover:shadow-card transition-all"
          >
            <Plus className="w-5 h-5" />
            Create new
          </button>
        </div>

        {/* Notebooks section */}
        <div className="mb-4">
          <h2 className="text-sm font-medium text-on-surface-variant uppercase tracking-wider">
            My notebooks
          </h2>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : notebooks.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-on-surface-variant text-sm">No notebooks yet. Create one to get started.</p>
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3"
          >
            {notebooks.map((nb) => (
              <Link
                key={nb.id}
                to={`/notebook/${nb.id}`}
                className="group flex items-start gap-4 p-4 rounded-2xl bg-card border border-outline-variant hover:border-outline hover:shadow-card transition-all"
              >
                <span className="text-3xl mt-0.5">{nb.emoji}</span>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-medium text-foreground truncate group-hover:text-primary transition-colors">
                    {nb.title}
                  </h3>
                  <p className="text-xs text-on-surface-variant mt-1">
                    {timeAgo(nb.updated_at)}
                  </p>
                </div>
                <button
                  onClick={(e) => deleteNotebook(nb.id, e)}
                  className="p-1.5 rounded-full opacity-0 group-hover:opacity-100 hover:bg-surface-dim text-on-surface-variant transition-all"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </Link>
            ))}
          </motion.div>
        )}
      </div>
    </div>
  );
}
