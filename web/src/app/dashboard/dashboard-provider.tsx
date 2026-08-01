"use client";

import { createContext, useContext, ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/utils/supabase/client";
import { User } from "@/app/types/supabase";

type AuthContextType = {
  user: User | null;
  isLoading: boolean;
  error: Error | null;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

type DashboardProviderProps = {
  children: ReactNode;
  initialUser: User | null;
};

export function DashboardProvider({
  children,
  initialUser,
}: DashboardProviderProps) {
  const supabase = createClient();

  const {
    data: user,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["auth", "user"],
    queryFn: async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      return user as User | null;
    },
    initialData: initialUser,
    staleTime: 5 * 60 * 1000, // 5 minutes - user data rarely changes
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  return (
    <AuthContext.Provider value={{ user, isLoading, error: error as Error | null }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within DashboardProvider");
  }
  return context;
}
