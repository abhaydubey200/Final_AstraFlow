import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/components/AuthProvider";
import { Loader2, ArrowRight, Database } from "lucide-react";

type Mode = "login" | "signup" | "forgot";

const AuthPage = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (user && !loading) {
      navigate("/", { replace: true });
    }
  }, [user, loading, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setSubmitting(true);

    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate("/");
      } else if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { display_name: displayName },
            emailRedirectTo: window.location.origin,
          },
        });
        if (error) throw error;
        setMessage("Check your email to confirm your account before signing in.");
        setMode("login");
      } else if (mode === "forgot") {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        setMessage("Password reset link sent to your email.");
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-6">
        {/* Branding */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-primary/10 mb-2">
            <Database className="w-6 h-6 text-primary" />
          </div>
          <h1 className="text-2xl font-display font-bold text-foreground">AstraETL</h1>
          <p className="text-sm text-muted-foreground">
            {mode === "login" && "Sign in to your account"}
            {mode === "signup" && "Create a new account"}
            {mode === "forgot" && "Reset your password"}
          </p>
        </div>

        {/* Messages */}
        {error && (
          <div className="p-3 rounded-md bg-destructive/10 border border-destructive/20 text-xs text-destructive">
            {error}
          </div>
        )}
        {message && (
          <div className="p-3 rounded-md bg-success/10 border border-success/20 text-xs text-success">
            {message}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === "signup" && (
            <div>
              <label className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">
                Display Name
              </label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                required
                className="w-full mt-1 px-3 py-2 rounded-md border border-border bg-card text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                placeholder="Your name"
              />
            </div>
          )}

          <div>
            <label className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full mt-1 px-3 py-2 rounded-md border border-border bg-card text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              placeholder="you@company.com"
            />
          </div>

          {mode !== "forgot" && (
            <div>
              <label className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="w-full mt-1 px-3 py-2 rounded-md border border-border bg-card text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                placeholder="••••••••"
              />
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {submitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                {mode === "login" && "Sign In"}
                {mode === "signup" && "Create Account"}
                {mode === "forgot" && "Send Reset Link"}
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* Footer links */}
        <div className="text-center space-y-2 text-xs text-muted-foreground">
          {mode === "login" && (
            <>
              <button onClick={() => { setMode("forgot"); setError(null); }} className="hover:text-foreground transition-colors">
                Forgot password?
              </button>
              <p>
                Don't have an account?{" "}
                <button onClick={() => { setMode("signup"); setError(null); }} className="text-primary hover:underline">
                  Sign up
                </button>
              </p>
            </>
          )}
          {mode === "signup" && (
            <p>
              Already have an account?{" "}
              <button onClick={() => { setMode("login"); setError(null); }} className="text-primary hover:underline">
                Sign in
              </button>
            </p>
          )}
          {mode === "forgot" && (
            <button onClick={() => { setMode("login"); setError(null); }} className="text-primary hover:underline">
              Back to sign in
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default AuthPage;
