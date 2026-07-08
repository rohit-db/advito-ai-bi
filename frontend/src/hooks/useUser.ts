import { useState, useEffect } from "react";

interface User {
  displayName: string;
  email: string;
  initials: string;
}

interface UseUserResult {
  user: User | null;
  isLoading: boolean;
  error: string | null;
}

function initialsFrom(displayName: string, email: string): string {
  const parts = (displayName || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (email[0] || "?").toUpperCase();
}

export function useUser(): UseUserResult {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchUser() {
      try {
        // Prefer the white-label session identity (the logged-in tenant user)
        // when AUTH_ENABLED. When auth is off / no session, /api/auth/me returns
        // 401 and we fall back to the Databricks (service-principal) identity.
        const session = await fetch("/api/auth/me");
        if (session.ok) {
          const s = await session.json();
          if (s?.authenticated) {
            const displayName = s.display_name || s.email || "User";
            if (!cancelled) {
              setUser({
                displayName,
                email: s.email || "",
                initials: initialsFrom(displayName, s.email || ""),
              });
            }
            return;
          }
        }

        const response = await fetch("/api/me");
        if (!response.ok) {
          throw new Error(`Failed to fetch user: ${response.status}`);
        }
        const data: User = await response.json();
        if (!cancelled) {
          setUser(data);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Unknown error");
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    fetchUser();

    return () => {
      cancelled = true;
    };
  }, []);

  return { user, isLoading, error };
}
