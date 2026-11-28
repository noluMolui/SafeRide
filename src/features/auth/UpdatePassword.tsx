import { ArrowLeft } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { Brand, Field } from "./ui";
import { supabase } from "../../lib/supabase";

export function UpdatePassword() {
  const [ready, setReady] = useState(false);
  const [hasRecoverySession, setHasRecoverySession] = useState(false);
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [complete, setComplete] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!supabase) {
      setReady(true);
      return;
    }
    let active = true;
    const { data: listener } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (active && event === "PASSWORD_RECOVERY" && session)
          setHasRecoverySession(true);
      },
    );
    void supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setHasRecoverySession(Boolean(data.session));
      setReady(true);
    });
    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!/^(?=.*[a-zA-Z])(?=.*\d).{8,}$/.test(password)) {
      setMessage("Use at least 8 characters, including a letter and a number.");
      return;
    }
    if (!supabase || !hasRecoverySession) {
      setMessage(
        "This password reset link is invalid or has expired. Request a new link.",
      );
      return;
    }
    setBusy(true);
    setMessage("");
    const { error } = await supabase.auth.updateUser({ password });
    if (!error) await supabase.auth.signOut({ scope: "local" });
    setBusy(false);
    if (error) {
      setMessage(
        "We couldn't update your password. Request a new reset link and try again.",
      );
      return;
    }
    setComplete(true);
  }

  return (
    <main className="auth-page">
      <header className="page-header">
        <Link className="back-button" to="/login" aria-label="Back to login">
          <ArrowLeft />
        </Link>
        <Brand />
      </header>
      <h1>Choose a new password</h1>
      {!ready && <p role="status">Checking your reset link…</p>}
      {ready && complete && (
        <section className="card reset-success" role="status">
          <h2>Password updated</h2>
          <p>You can now sign in with your new password.</p>
          <Link className="primary-button" to="/login">
            Back to login
          </Link>
        </section>
      )}
      {ready && !complete && hasRecoverySession && (
        <form className="card form-stack" onSubmit={submit}>
          <Field
            id="new-password"
            label="New password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
          <p className="intro">
            Use at least 8 characters, including a letter and a number.
          </p>
          <button className="primary-button" type="submit" disabled={busy}>
            {busy ? "Updating…" : "Update password"}
          </button>
          {message && (
            <p className="form-message" role="alert">
              {message}
            </p>
          )}
        </form>
      )}
      {ready && !complete && !hasRecoverySession && (
        <section className="card reset-success" role="status">
          <p>
            {supabase
              ? "This password reset link is invalid or has expired."
              : "Password reset is not configured for this deployment."}
          </p>
          <Link className="primary-button" to="/reset-password">
            Request a new link
          </Link>
        </section>
      )}
    </main>
  );
}
