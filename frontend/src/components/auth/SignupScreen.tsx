import { useState } from "react";
import { authApi } from "../../api/auth";
import { ApiError } from "../../api/client";

interface Props {
  onSignIn: () => void;
}

export function SignupScreen({ onSignIn }: Props) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [created, setCreated] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    if (submitting) return;
    setError(null);

    if (!name.trim() || !email.trim() || !address.trim()) {
      setError("Please fill in every field.");
      return;
    }

    if (
      password.length < 8 ||
      /^[A-Za-z0-9]*$/.test(password)
    ) {
      setError(
        "Use at least 8 characters, including a special character."
      );
      return;
    }

    if (password !== password.trim()) {
      setError("Your password cannot start or end with whitespace.");
      return;
    }

    if (password !== confirmation) {
      setError("Your passwords do not match.");
      return;
    }

    setSubmitting(true);

    try {
      await authApi.signup({
        name: name.trim(),
        email: email.trim(),
        address: address.trim(),
        password,
      });

      setPassword("");
      setConfirmation("");
      setCreated(true);
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 409) {
          setError("That email is already registered. Try signing in.");
        } else if (err.status === 429) {
          setError("Too many signup attempts. Please wait and try again.");
        } else if (err.status === 422) {
          setError("Please check your details and password requirements.");
        } else {
          // Some API errors contain structured details, not text.
          setError(
            typeof err.detail === "string"
              ? err.detail
              : err.message
          );
        }
      } else {
        setError("We couldn't create your profile. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <h1 className="login-title">
          {created ? "Profile created" : "Create your customer profile"}
        </h1>

        {created ? (
          <>
            <p className="login-sub" role="status">
              You can now sign in with your email and password.
            </p>
            <button
              type="button"
              className="btn btn-primary"
              onClick={onSignIn}
            >
              Go to sign in
            </button>
          </>
        ) : (
          <>
            <p className="login-sub">
              Register to open and manage your bank accounts.
            </p>

            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label htmlFor="signup-name">Full name</label>
                <input
                  id="signup-name"
                  autoComplete="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={submitting}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="signup-email">Email</label>
                <input
                  id="signup-email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={submitting}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="signup-address">Address</label>
                <input
                  id="signup-address"
                  autoComplete="street-address"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  disabled={submitting}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="signup-password">Password</label>
                <input
                  id="signup-password"
                  type="password"
                  autoComplete="new-password"
                  aria-describedby="signup-password-help"
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={submitting}
                  required
                />
                <div id="signup-password-help" className="help">
                  At least 8 characters, including a special character.
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="signup-confirmation">
                  Confirm password
                </label>
                <input
                  id="signup-confirmation"
                  type="password"
                  autoComplete="new-password"
                  value={confirmation}
                  onChange={(e) => setConfirmation(e.target.value)}
                  disabled={submitting}
                  required
                />
              </div>

              {error && (
                <div className="err-banner" role="alert">
                  <div className="msg">{error}</div>
                </div>
              )}

              <button
                type="submit"
                className="btn btn-primary"
                disabled={submitting}
              >
                {submitting ? "Creating profile…" : "Create profile"}
              </button>
            </form>

            <div className="login-foot">
              Already registered?{" "}
              <button
                type="button"
                className="btn btn-ghost"
                onClick={onSignIn}
                disabled={submitting}
              >
                Sign in
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}