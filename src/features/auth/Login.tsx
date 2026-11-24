import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { LockKeyhole } from "lucide-react";
import { Brand, Field, PreviewNotice } from "./ui";

export function Login() {
  const [message, setMessage] = useState("");

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("Login is not available yet. No account information was sent.");
  }

  return (
    <main className="auth-page login-page">
      <div className="login-heading">
        <Brand />
        <p>Know your child&apos;s trip status without sending a message.</p>
      </div>
      <PreviewNotice />
      <form className="card form-stack" onSubmit={submit}>
        <Field id="login-email" label="Email" type="email" autoComplete="email" required />
        <Field id="login-password" label="Password" type="password" autoComplete="current-password" required />
        <button className="primary-button" type="submit">Log in</button>
        {message && <p className="form-message" role="status">{message}</p>}
        <button className="text-button" type="button" onClick={() => setMessage("Password reset is not available yet.")}>Forgot password?</button>
      </form>
      <div className="divider"><span>New to SafeRide?</span></div>
      <Link className="secondary-button" to="/signup">Create account</Link>
      <p className="privacy-footer"><LockKeyhole size={18} aria-hidden="true" /> Privacy notice coming before launch</p>
    </main>
  );
}
