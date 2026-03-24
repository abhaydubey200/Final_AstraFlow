import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  loading: true,
  signOut: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const isDebug = import.meta.env.VITE_ASTRA_DEBUG_MODE === "true";

    const injectMockUser = () => {
      const mockUser = {
        id: "debug-admin-id",
        email: "admin@astra.local",
        app_metadata: { provider: "email", role: "admin" },
        user_metadata: { full_name: "Debug Admin" },
        aud: "authenticated",
        role: "authenticated",
        created_at: new Date().toISOString()
      } as User;
      setUser(mockUser);
      setSession({ 
        user: mockUser, 
        access_token: "mock-token", 
        refresh_token: "mock-refresh",
        expires_in: 3600,
        token_type: "bearer"
      } as Session);
      setLoading(false);
    };

    const checkSession = async () => {
      if (isDebug) {
        injectMockUser();
        return;
      }

      const timeoutPromise = new Promise<null>((_, reject) => 
        setTimeout(() => reject(new Error("Supabase timeout")), 5000)
      );

      try {
        const sessionResult = await Promise.race([
          supabase.auth.getSession(),
          timeoutPromise
        ]);

        if (!sessionResult) return;

        const session = (sessionResult as { data: { session: Session | null } }).data?.session;
        if (session) {
          setSession(session);
          setUser(session.user);
        }
      } catch (error) {
        console.error("Auth session check error:", error);
      } finally {
        setLoading(false);
      }
    };

    checkSession();

    // Only subscribe to auth changes if not in debug mode
    let subscription: { unsubscribe: () => void } | null = null;
    
    if (!isDebug) {
      const { data } = supabase.auth.onAuthStateChange(
        (_event, currentSession) => {
          if (currentSession) {
            setSession(currentSession);
            setUser(currentSession.user);
          }
          setLoading(false);
        }
      );
      subscription = data.subscription;
    }

    return () => {
      if (subscription) subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}
