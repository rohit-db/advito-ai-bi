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

export function useUser(): UseUserResult {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchUser() {
      try {
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
