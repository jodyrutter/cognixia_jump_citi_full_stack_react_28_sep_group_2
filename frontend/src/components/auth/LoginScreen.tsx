import { useState } from "react";
import { authApi } from "../../api/auth";
import { ApiError } from "../../api/client";
import { authStore } from "../../auth/authStore";

export function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await authApi.login({ email, password });
      authStore.set({ token: res.access_token, email });
    } catch (err) {
      setError(err instanceof ApiError ? err.detail ?? err.message : "Sign in failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-brand">
          <div className="dot" title="Citi" />
          <div>
            <div className="wordmark">citi</div>
            <div className="app-name">Banking Console</div>
          </div>
        </div>

        <h1 className="login-title">Sign in</h1>
        <p className="login-sub">Use your Citi employee credentials to continue.</p>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Email</label>
            <input
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              autoFocus
            />
          </div>
          <div className="form-group">
            <label>Password</label>
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </div>

          {error && (
            <div className="err-banner" style={{ marginBottom: 12 }}>
              <svg className="ico" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <div className="msg">{error}</div>
            </div>
          )}

          <button type="submit" className="btn btn-primary" style={{ width: "100%", justifyContent: "center" }} disabled={submitting || !email || !password}>
            {submitting ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <div className="login-foot">
          <span>Protected area · Session expires in 30 minutes</span>
        </div>
      </div>
    </div>
  );
}
