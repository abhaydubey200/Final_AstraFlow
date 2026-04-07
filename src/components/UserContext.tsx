/**
 * Simple User Context - Single Admin Mode
 * NO auth complexity, NO Supabase, just works
 */
import { createContext, useContext, ReactNode } from "react";

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
}

interface UserContextType {
  user: User;
  loading: false;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

// Hardcoded SUPER_ADMIN user
const SUPER_ADMIN: User = {
  id: "admin-001",
  email: "dubeyabhay430@gmail.com",
  name: "Abhay Dubey",
  role: "SUPER_ADMIN",
};

export function UserProvider({ children }: { children: ReactNode }) {
  return (
    <UserContext.Provider value={{ user: SUPER_ADMIN, loading: false }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error("useUser must be used within UserProvider");
  }
  return context;
}
