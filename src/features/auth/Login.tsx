import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { LockKeyhole } from "lucide-react";
import { Brand, Field } from "./ui";
import { supabase } from "../../lib/supabase";

export function Login() {
  const navigate = useNavigate();
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) {
      setMessage("Authentication is not configured for this deployment.");
      return;
    }

    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");
    setIsSubmitting(true);
    setMessage("");

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    setIsSubmitting(false);
    if (error || !data.user) {
      setMessage("Incorrect email or password");
      return;
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", data.user.id)
      .maybeSingle();
    if (profileError) {
      setMessage("We couldn't load your profile. Please try again.");
      return;
    }

    const role = profile?.role ?? (data.user.user_metadata.role === "driver" ? "driver" : null);
    if (role === "driver") {
      navigate(profile ? "/driver/dashboard" : "/signup/driver", { replace: true });
      return;
    }
    if (role === "admin") {
      navigate("/admin/verifications", { replace: true });
      return;
    }
    if (role === "parent") {
      navigate("/parent/home", { replace: true });
      return;
    }
    setMessage("Your account role isn't configured. Please contact support.");
  }

  return (
    <main className="auth-page login-page">
      <div className="login-heading">
        <Brand />
        <p>Know your child&apos;s trip status without sending a message.</p>
      </div>
      <form className="card form-stack" onSubmit={submit}>
        <Field id="login-email" name="email" label="Email" type="email" autoComplete="email" required />
        <Field id="login-password" name="password" label="Password" type="password" autoComplete="current-password" required />
        <button className="primary-button" type="submit" disabled={isSubmitting}>{isSubmitting ? "Signing in…" : "Log in"}</button>
        {message && <p className="form-message" role="status">{message}</p>}
        <Link className="text-button" to="/reset-password">Forgot password?</Link>
      </form>
      <div className="divider"><span>New to SafeRide?</span></div>
      <Link className="secondary-button" to="/signup">Create account</Link>
      <p className="privacy-footer"><LockKeyhole size={18} aria-hidden="true" /> Privacy notice coming before launch</p>
    </main>
  );
}
