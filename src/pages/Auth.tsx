import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Mail, Lock, Eye, EyeOff } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate("/");
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
        });
        if (error) throw error;
        toast({ title: "Check your email", description: "We've sent you a verification link." });
      }
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-[400px] bg-card rounded-3xl border border-outline-variant p-10 shadow-card">
        {/* Logo */}
        <div className="flex items-center gap-2.5 mb-8">
          <img src="/eternity-logo.svg" alt="EternityX" className="w-8 h-8 rounded-full bg-white object-cover" />
          <span className="text-xl font-medium text-foreground tracking-tight">EternityX</span>
        </div>

        <h1 className="text-2xl font-normal text-foreground mb-1">
          {isLogin ? "Sign in" : "Create account"}
        </h1>
        <p className="text-sm text-on-surface-variant mb-8">
          {isLogin ? "to continue to EternityX" : "to start using EternityX"}
        </p>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="text-xs text-on-surface-variant mb-1.5 block">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-4 py-3 rounded-lg bg-background border border-outline text-sm text-foreground placeholder:text-on-surface-variant focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
            />
          </div>
          <div>
            <label className="text-xs text-on-surface-variant mb-1.5 block">Password</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="w-full px-4 py-3 pr-10 rounded-lg bg-background border border-outline text-sm text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-3.5 text-on-surface-variant hover:text-foreground"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            <button
              type="button"
              onClick={() => setIsLogin(!isLogin)}
              className="text-sm text-primary font-medium hover:underline"
            >
              {isLogin ? "Create account" : "Sign in instead"}
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2.5 rounded-full bg-primary text-primary-foreground text-sm font-medium hover:shadow-elevated transition-all disabled:opacity-50"
            >
              {loading ? "Please wait..." : "Next"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
