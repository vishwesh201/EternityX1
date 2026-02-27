import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import type { EmailOtpType } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export default function AuthCallback() {
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    let cancelled = false;

    const finishVerification = async () => {
      try {
        const params = new URLSearchParams(window.location.search);
        const errorDescription = params.get("error_description");

        if (errorDescription) {
          if (!cancelled) {
            toast({
              title: "Verification failed",
              description: decodeURIComponent(errorDescription),
              variant: "destructive",
            });
            navigate("/auth", { replace: true });
          }
          return;
        }

        const code = params.get("code");
        const tokenHash = params.get("token_hash");
        const type = params.get("type") as EmailOtpType | null;

        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
        } else if (tokenHash && type) {
          const { error } = await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type,
          });
          if (error) throw error;
        }

        for (let i = 0; i < 10; i++) {
          const {
            data: { session },
          } = await supabase.auth.getSession();

          if (session) {
            if (!cancelled) navigate("/", { replace: true });
            return;
          }

          await new Promise((resolve) => setTimeout(resolve, 200));
        }

        if (!cancelled) {
          toast({
            title: "Email verified",
            description: "Please sign in to continue.",
          });
          navigate("/auth", { replace: true });
        }
      } catch (error: any) {
        if (!cancelled) {
          toast({
            title: "Verification failed",
            description: error?.message || "Unable to complete verification.",
            variant: "destructive",
          });
          navigate("/auth", { replace: true });
        }
      }
    };

    void finishVerification();

    return () => {
      cancelled = true;
    };
  }, [navigate, toast]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );
}
