import { ArrowLeft, ArrowRight, BusFront, Check, UsersRound } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Brand, Field } from "./ui";
import { signupSchema } from "./validation";

export type SignupValues = {
  role: "parent" | "driver";
  name: string;
  email: string;
  phone: string;
  password: string;
  consent: boolean;
};

export const emptySignup: SignupValues = {
  role: "parent", name: "", email: "", phone: "", password: "", consent: false,
};

type Errors = Partial<Record<keyof SignupValues, string>>;

export function Signup({ values, onChange }: { values: SignupValues; onChange: (values: SignupValues) => void }) {
  const navigate = useNavigate();
  const [errors, setErrors] = useState<Errors>({});
  const [message, setMessage] = useState("");
  function update<K extends keyof SignupValues>(key: K, value: SignupValues[K]) {
    onChange({ ...values, [key]: value });
  }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = signupSchema.safeParse(values);
    if (!result.success) {
      const next: Errors = {};
      for (const issue of result.error.issues) {
        const key = issue.path[0] as keyof SignupValues;
        if (!next[key]) next[key] = issue.message;
      }
      setErrors(next);
      setMessage("");
      return;
    }
    setErrors({});
    if (values.role === "driver") {
      navigate("/signup/driver");
    } else {
      setMessage("Account creation is not available yet. Your details have not been saved or sent.");
    }
  }

  return (
    <main className="auth-page">
      <header className="page-header">
        <Link className="back-button" to="/login" aria-label="Back to login"><ArrowLeft /></Link>
        <Brand />
      </header>
      <h1>Create your account</h1>
      <p className="intro">Join SafeRide to get started with scholar transport.</p>
      <form className="form-stack signup-form" noValidate onSubmit={submit}>
        <fieldset>
          <legend className="field-label">I am joining as:</legend>
          <div className="role-grid">
            {(["parent", "driver"] as const).map((role) => (
              <label key={role} className={`role-card ${values.role === role ? "selected" : ""}`}>
                <input type="radio" name="role" value={role} checked={values.role === role} onChange={() => update("role", role)} />
                <span className="role-icon">{role === "parent" ? <UsersRound /> : <BusFront />}</span>
                {values.role === role && <span className="role-check"><Check size={16} /></span>}
                <strong>I&apos;m a {role === "parent" ? "Parent" : "Driver"}</strong>
                <span>{role === "parent" ? "Follow your child's trip" : "Run routes & track fees"}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <Field id="name" label="Full name" autoComplete="name" maxLength={100} placeholder="e.g. Naledi Molefe" value={values.name} onChange={(e) => update("name", e.target.value)} error={errors.name} />
        <Field id="email" label="Email address" type="email" autoComplete="email" placeholder="naledi@example.co.za" value={values.email} onChange={(e) => update("email", e.target.value)} error={errors.email} />
        <Field id="phone" label="Mobile phone number" type="tel" autoComplete="tel" placeholder="082 123 4567 or +27 82 123 4567" value={values.phone} onChange={(e) => update("phone", e.target.value)} error={errors.phone} />
        <div>
          <Field id="password" label="Create password" type="password" autoComplete="new-password" placeholder="Enter a secure password" value={values.password} onChange={(e) => update("password", e.target.value)} error={errors.password} />
          <ul className="password-rules" aria-label="Password requirements">
            <li>{values.password.length >= 8 ? "✓" : "○"} 8 or more characters</li>
            <li>{/[a-z]/i.test(values.password) ? "✓" : "○"} At least one letter</li>
            <li>{/\d/.test(values.password) ? "✓" : "○"} At least one number</li>
          </ul>
        </div>
        <div>
          <label className="consent"><input type="checkbox" checked={values.consent} onChange={(e) => update("consent", e.target.checked)} aria-invalid={Boolean(errors.consent)} aria-describedby={errors.consent ? "consent-error" : undefined} /> <span>I agree to the privacy notice and consent to SafeRide processing my personal data in accordance with POPIA. The notice will be published before launch.</span></label>
          {errors.consent && <p id="consent-error" className="field-error" role="alert">{errors.consent}</p>}
        </div>
        <button className="primary-button" type="submit">{values.role === "driver" ? "Continue" : "Create account"} <ArrowRight size={20} /></button>
        {message && <p className="form-message" role="status">{message}</p>}
      </form>
      <p className="bottom-link">Already have an account? <Link to="/login">Log in</Link></p>
    </main>
  );
}
