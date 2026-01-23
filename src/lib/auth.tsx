/**
 * GitHub Authentication Context
 *
 * Provides authentication state and methods throughout the app.
 * Handles OAuth flow, session management, and token access.
 */

"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from "react";

interface AuthUser {
  id: number;
  login: string;
  avatar_url: string;
  name: string | null;
}

interface AuthContextType {
  /** Whether the user is authenticated */
  isAuthenticated: boolean;
  /** Whether auth state is still loading */
  isLoading: boolean;
  /** Authenticated user info */
  user: AuthUser | null;
  /** Get the current access token for API calls */
  getToken: () => Promise<string | null>;
  /** Initiate GitHub OAuth sign-in */
  signIn: () => void;
  /** Sign in with a Personal Access Token */
  signInWithPAT: (
    token: string,
  ) => Promise<{ success: boolean; error?: string }>;
  /** Sign out and clear session */
  signOut: () => Promise<void>;
  /** Refresh the session state */
  refreshSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<AuthUser | null>(null);

  /**
   * Check the current session status
   */
  const refreshSession = useCallback(async () => {
    try {
      const response = await fetch("/api/auth/session");
      const data = await response.json();

      setIsAuthenticated(data.isAuthenticated);
      setUser(data.user);
    } catch (error) {
      console.error("Failed to fetch session:", error);
      setIsAuthenticated(false);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Check session on mount and handle auth callback params
   */
  useEffect(() => {
    // Check for auth callback params in URL
    const params = new URLSearchParams(window.location.search);
    const authSuccess = params.get("auth");
    const authError = params.get("auth_error");

    if (authSuccess === "success" || authError) {
      // Clean up URL params
      const url = new URL(window.location.href);
      url.searchParams.delete("auth");
      url.searchParams.delete("auth_error");
      window.history.replaceState({}, "", url.pathname);

      if (authError) {
        console.error("Auth error:", authError);
        // Could show a toast notification here
      }
    }

    // Fetch session status
    refreshSession();
  }, [refreshSession]);

  /**
   * Get the current access token for API calls
   */
  const getToken = useCallback(async (): Promise<string | null> => {
    try {
      const response = await fetch("/api/auth/token");
      const data = await response.json();
      return data.token;
    } catch (error) {
      console.error("Failed to get token:", error);
      return null;
    }
  }, []);

  /**
   * Initiate GitHub OAuth sign-in
   */
  const signIn = useCallback(() => {
    // Redirect to our OAuth initiation endpoint
    window.location.href = "/api/auth/github";
  }, []);

  /**
   * Sign in with a Personal Access Token
   */
  const signInWithPAT = useCallback(
    async (token: string): Promise<{ success: boolean; error?: string }> => {
      try {
        const response = await fetch("/api/auth/pat", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ token }),
        });

        const data = await response.json();

        if (data.success && data.user) {
          setIsAuthenticated(true);
          setUser(data.user);
          return { success: true };
        }

        return { success: false, error: data.error || "Authentication failed" };
      } catch (error) {
        console.error("PAT sign-in failed:", error);
        return { success: false, error: "Failed to authenticate" };
      }
    },
    [],
  );

  /**
   * Sign out and clear session
   */
  const signOut = useCallback(async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      setIsAuthenticated(false);
      setUser(null);
    } catch (error) {
      console.error("Failed to sign out:", error);
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        isLoading,
        user,
        getToken,
        signIn,
        signInWithPAT,
        signOut,
        refreshSession,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

/**
 * Hook to access authentication context
 */
export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
