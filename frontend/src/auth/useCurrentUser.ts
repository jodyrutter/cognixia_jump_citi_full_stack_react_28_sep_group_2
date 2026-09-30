import { useCallback, useEffect, useState } from "react";
import { meApi } from "../api/me";
import type { Me } from "../types/me";
import type { AuthSession } from "../types/auth";

export function useCurrentUser(session: AuthSession | null) {
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!session) {
      setMe(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setMe(await meApi.get());
    } catch {
      setMe(null);
      setError("Couldn't load your profile.");
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { me, loading, error, refresh };
}
