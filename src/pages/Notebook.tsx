import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { ArrowLeft, Share2, MoreVertical, Trash2, Copy } from "lucide-react";
import { SourcesPanel } from "@/components/notebook/SourcesPanel";
import { ChatPanel } from "@/components/notebook/ChatPanel";
import { StudioPanel } from "@/components/notebook/StudioPanel";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function Notebook() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [notebook, setNotebook] = useState<any>(null);
  const [title, setTitle] = useState("");
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  useEffect(() => {
    if (id === "new" && user) {
      const create = async () => {
        const { data } = await supabase
          .from("notebooks")
          .insert({ user_id: user.id, title: "Untitled notebook", emoji: "📓" })
          .select()
          .single();
        if (data) navigate(`/notebook/${data.id}`, { replace: true });
      };
      create();
    } else if (id) {
      supabase
        .from("notebooks")
        .select("*")
        .eq("id", id)
        .single()
        .then(({ data }) => {
          setNotebook(data);
          setTitle(data?.title || "");
        });
    }
  }, [id, user]);

  const saveTitle = async () => {
    setIsEditingTitle(false);
    if (title.trim() && id) {
      await supabase.from("notebooks").update({ title: title.trim() }).eq("id", id);
    }
  };

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href);
    toast({ title: "Link copied", description: "Notebook link copied to clipboard." });
  };

  const handleDelete = async () => {
    if (!id) return;
    await supabase.from("chat_messages").delete().eq("notebook_id", id);
    await supabase.from("notes").delete().eq("notebook_id", id);
    await supabase.from("highlights").delete().eq("notebook_id", id);
    await supabase.from("sources").delete().eq("notebook_id", id);
    await supabase.from("notebooks").delete().eq("id", id);
    toast({ title: "Notebook deleted" });
    navigate("/");
  };

  const handleClearChat = async () => {
    if (!id) return;
    await supabase.from("chat_messages").delete().eq("notebook_id", id);
    toast({ title: "Chat cleared" });
    window.location.reload();
  };

  if (!notebook && id !== "new") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      <header className="h-14 border-b border-outline-variant flex items-center justify-between px-4 bg-card shrink-0">
        <div className="flex items-center gap-3">
          <Link
            to="/"
            className="p-2 rounded-full hover:bg-surface-dim text-on-surface-variant transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="flex items-center gap-2">
            <span className="text-xl">{notebook?.emoji || "📓"}</span>
            {isEditingTitle ? (
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onBlur={saveTitle}
                onKeyDown={(e) => e.key === "Enter" && saveTitle()}
                autoFocus
                className="text-base font-medium text-foreground bg-transparent border-b-2 border-primary focus:outline-none px-0 py-0.5"
              />
            ) : (
              <button
                onClick={() => setIsEditingTitle(true)}
                className="text-base font-medium text-foreground hover:text-primary transition-colors"
              >
                {title || "Untitled notebook"}
              </button>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={handleShare}
            className="flex items-center gap-2 px-4 py-2 rounded-full text-sm text-on-surface-variant hover:bg-surface-dim transition-colors"
          >
            <Share2 className="w-4 h-4" />
            Share
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="p-2 rounded-full hover:bg-surface-dim text-on-surface-variant transition-colors">
                <MoreVertical className="w-5 h-5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleClearChat}>
                <Copy className="w-4 h-4 mr-2" />
                Clear chat history
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setShowDeleteDialog(true)} className="text-destructive focus:text-destructive">
                <Trash2 className="w-4 h-4 mr-2" />
                Delete notebook
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        <div className="w-72 border-r border-outline-variant bg-card shrink-0 flex flex-col overflow-hidden">
          <SourcesPanel notebookId={id || ""} />
        </div>
        <div className="flex-1 overflow-hidden bg-background">
          <ChatPanel notebookId={id || ""} />
        </div>
        <div className="w-80 border-l border-outline-variant bg-studio shrink-0 flex flex-col overflow-hidden">
          <StudioPanel notebookId={id || ""} />
        </div>
      </div>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete notebook?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the notebook, all sources, notes, and chat history.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
