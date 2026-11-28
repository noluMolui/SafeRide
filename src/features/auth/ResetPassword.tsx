import { ArrowLeft, MailCheck } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { Brand, Field } from "./ui";
import { supabase } from "../../lib/supabase";

export function ResetPassword() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleanEmail = email.trim();
    if (!/^\S+@\S+\.\S+$/.test(cleanEmail)) {
      setError("Enter a valid email address");
      setSent(false);
      return;
    }
    setError("");
    if (!supabase) {
      setError("Password reset is not configured for this deployment.");
      return;
    }
    setBusy(true);
    const { error: requestError } = await supabase.auth.resetPasswordForEmail(
      cleanEmail,
      {
        redirectTo: `${window.location.origin}/update-password`,
      },
    );
    setBusy(false);
    if (requestError) {
      setError("We couldn't send the reset email. Please wait and try again.");
      setSent(false);
      return;
    }
    setEmail(cleanEmail);
    setSent(true);
  }

  return (
    <main className="auth-page">
      <header className="page-header">
        <Link className="back-button" to="/login" aria-label="Back to login">
          <ArrowLeft />
        </Link>
        <Brand />
      </header>
      <h1>Reset your password</h1>
      <p className="intro">
        Enter your account email and we will send a reset link.
      </p>
      {sent ? (
        <div className="card reset-success" role="status">
          <span className="reset-icon">
            <MailCheck size={26} />
          </span>
          <h2>Check your inbox</h2>
          <p>
            If an account exists for {email.trim()}, a password reset link will
            be sent.
          </p>
          <Link className="primary-button" to="/login">
            Back to login
          </Link>
        </div>
      ) : (
        <form className="card form-stack" noValidate onSubmit={submit}>
          <Field
            id="reset-email"
            label="Email address"
            type="email"
            autoComplete="email"
            placeholder="naledi@example.co.za"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            error={error}
          />
          <button className="primary-button" type="submit" disabled={busy}>
            {busy ? "Sending…" : "Send reset link"}
          </button>
        </form>
      )}
    </main>
  );
}
