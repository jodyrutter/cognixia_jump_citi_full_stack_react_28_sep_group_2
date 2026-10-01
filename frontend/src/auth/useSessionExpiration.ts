import { useEffect } from "react";
import type { AuthSession } from "../types/auth";
import { authStore } from "./authStore";
import { authApi } from "../api/auth";

const IDLE_TIMEOUT_MS = 1800000;
const RENEW_INTERVAL_MS = 300000;
const CHECK_INTERVAL_MS = 15000;

function readToken(token: string): {sid: string; expiresAt: number;} | null {
  try {
    const part = token.split(".")[1];
    if (!part) return null;

    const base64 = part.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");

    const bytes = Uint8Array.from(atob(padded), (character) => character.charCodeAt(0));

    const payload = JSON.parse(new TextDecoder().decode(bytes));

    if (typeof payload.sid !== "string" || !payload.sid || typeof payload.exp !== "number" || !Number.isFinite(payload.exp)) {
      return null;
    }

    return {sid: payload.sid, expiresAt: payload.exp * 1000,};
  } 
  catch {
    return null;
  }
}

export function useSessionExpiration(session: AuthSession | null) {
  const sessionId = session ? readToken(session.token)?.sid : undefined;

  useEffect(() => {
    if (!sessionId) return;

    const activityKey = `banking-activity:${sessionId}`;

    let renewing = false;
    let stopped = false;
    let lastAttempt = 0;
    let lastRecorded = 0;

    if (localStorage.getItem(activityKey) === null) {
      localStorage.setItem(activityKey, String(Date.now()));
    }

    function getLastActivity(): number {
      const value = Number(localStorage.getItem(activityKey));
      return Number.isFinite(value) ? value : 0;
    }

    function getCurrentSession() {
      const current = authStore.get();
      if (!current) return null;

      const info = readToken(current.token);
      if (!info || info.sid !== sessionId) return null;

      return { current, info };
    }

    function signOut(message: string) {
      if (!getCurrentSession()) return;

      sessionStorage.setItem("auth-notice", message);
      localStorage.removeItem(activityKey);

      void authApi.logout().catch(() => {});
      authStore.clear();
    }

    async function checkSession() {
      if (stopped) return;

      const active = getCurrentSession();
      if (!active) return;

      const now = Date.now();
      const lastActivity = getLastActivity();

      if (now - lastActivity >= IDLE_TIMEOUT_MS) {
        signOut("You were signed out after 30 minutes of inactivity.");
        return;
      }

      if (active.info.expiresAt <= now) {
        signOut("Your session expired. Please sign in again.");
        return;
      }

      if (now - lastActivity >= RENEW_INTERVAL_MS) return;

      const needsRenewal = active.info.expiresAt - now <= IDLE_TIMEOUT_MS - RENEW_INTERVAL_MS;

      if (!needsRenewal || renewing || now - lastAttempt < 60000) {
        return;
      }

      renewing = true;
      lastAttempt = now;

      try {
        const result = await authApi.refresh();

        if (stopped) return;

        const latest = getCurrentSession();
        const replacement = readToken(result.access_token);

        if (!latest ||  !replacement || replacement?.sid !== sessionId) return;

        if (replacement.expiresAt <= latest.info.expiresAt) return;

        authStore.set({...latest.current, token: result.access_token});
      }
      catch {
      } 
      finally {
        renewing = false;
      }
    }

    function recordActivity() {
      if (!getCurrentSession()) return;

      const now = Date.now();

      if (now - getLastActivity() >= IDLE_TIMEOUT_MS) {
        void checkSession();
        return;
      }

      if (now - lastRecorded >= 1000) {
        localStorage.setItem(activityKey, String(now));
        lastRecorded = now;
      }

      void checkSession();
    }

    function handleVisibility() {
      if (document.visibilityState === "visible") {
        void checkSession();
      }
    }

    const events = ["pointerdown", "keydown", "scroll", "touchstart"] as const;

    for (const event of events) {
      window.addEventListener(event, recordActivity, {passive: true, capture: true});
    }

    document.addEventListener("visibilitychange", handleVisibility);

    const timer = window.setInterval(() => void checkSession(), CHECK_INTERVAL_MS);

    void checkSession();

    return () => {
      stopped = true;
      window.clearInterval(timer);

      for (const event of events) {
        window.removeEventListener(event, recordActivity, true);
      }

      document.removeEventListener("visibilitychange", handleVisibility,);
    };
  }, [sessionId]);
}