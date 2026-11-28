import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "../../lib/supabase";

export function AccountDeletionDialog({
  onCancel,
  onDeleted,
}: {
  onCancel: () => void;
  onDeleted: () => void;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    if (supabase) {
      void supabase.auth.getUser().then(({ data }) => {
        if (active) setEmail(data.user?.email ?? "");
      });
    }
    return () => {
      active = false;
    };
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase || !email || !password) {
      setMessage("Sign in again before deleting your account.");
      return;
    }
    setBusy(true);
    setMessage("");
    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (authError) {
      setBusy(false);
      setMessage(
        "Password could not be verified. Your account has not been deleted.",
      );
      return;
    }
    const { error: deletionError } = await supabase.functions.invoke(
      "delete-account",
      { body: {} },
    );
    if (deletionError) {
      setBusy(false);
      setMessage(
        "We couldn't delete your account. Your data has not been confirmed deleted; try again or contact support.",
      );
      return;
    }
    await supabase.auth.signOut({ scope: "local" });
    setBusy(false);
    onDeleted();
  }

  return (
    <div
      className="confirm-panel"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="delete-account-title"
    >
      <form className="form-stack" onSubmit={submit}>
        <h2 id="delete-account-title">Delete SafeRide account?</h2>
        <p>
          This permanently deletes your account, associated profile and
          transport records, and uploaded compliance documents. This cannot be
          undone.
        </p>
        <label className="field-label" htmlFor="delete-account-email">
          Account email
        </label>
        <input
          id="delete-account-email"
          className="input"
          type="email"
          value={email}
          readOnly
        />
        <label className="field-label" htmlFor="delete-account-password">
          Confirm your password
        </label>
        <input
          id="delete-account-password"
          className="input"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
        />
        {message && (
          <p className="form-message" role="alert">
            {message}
          </p>
        )}
        <div className="danger-actions">
          <button
            type="button"
            className="secondary-button"
            onClick={onCancel}
            disabled={busy}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="delete-button"
            disabled={busy || !email}
          >
            {busy ? "Deleting…" : "Permanently delete"}
          </button>
        </div>
      </form>
    </div>
  );
}
