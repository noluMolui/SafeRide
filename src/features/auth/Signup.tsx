import {
  ArrowLeft,
  ArrowRight,
  BusFront,
  Check,
  UsersRound,
} from "lucide-react";
import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Brand, Field } from "./ui";
import { normalizeSouthAfricanPhone, signupSchema } from "./validation";
import { supabase } from "../../lib/supabase";

export type SignupValues = {
  role: "parent" | "driver";
  name: string;
  email: string;
  phone: string;
  password: string;
  consent: boolean;
};

export const emptySignup: SignupValues = {
  role: "parent",
  name: "",
  email: "",
  phone: "",
  password: "",
  consent: false,
};

type Errors = Partial<Record<keyof SignupValues, string>>;

export function Signup({
  values,
  onChange,
}: {
  values: SignupValues;
  onChange: (values: SignupValues) => void;
}) {
  const navigate = useNavigate();
  const [errors, setErrors] = useState<Errors>({});
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  function update<K extends keyof SignupValues>(
    key: K,
    value: SignupValues[K],
  ) {
    onChange({ ...values, [key]: value });
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
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
    if (!supabase) {
      setMessage("Authentication is not configured for this deployment.");
      return;
    }

    setIsSubmitting(true);
    setMessage("");
    const { data, error } = await supabase.auth.signUp({
      email: result.data.email,
      password: values.password,
      options: {
        emailRedirectTo: `${window.location.origin}/login`,
        data: {
          role: values.role,
          full_name: result.data.name,
          phone_e164: normalizeSouthAfricanPhone(result.data.phone),
          consent: true,
        },
      },
    });
    setIsSubmitting(false);

    if (error) {
      setMessage(
        /already registered|already exists/i.test(error.message)
          ? "An account with this email already exists. Log in instead."
          : "We couldn't create your account. Check your details and try again.",
      );
      return;
    }

    if (data.session) {
      navigate(values.role === "driver" ? "/signup/driver" : "/parent/home", {
        replace: true,
      });
      return;
    }
    setMessage(
      values.role === "driver"
        ? "Account created. Confirm your email, then log in to finish driver onboarding."
        : "Account created. Check your email to confirm your account before logging in.",
    );
  }

  return (
    <main className="auth-page">
      <header className="page-header">
        <Link className="back-button" to="/login" aria-label="Back to login">
          <ArrowLeft />
        </Link>
        <Brand />
      </header>
      <h1>Create your account</h1>
      <p className="intro">
        Join SafeRide to get started with scholar transport.
      </p>
      <form className="form-stack signup-form" noValidate onSubmit={submit}>
        <fieldset>
          <legend className="field-label">I am joining as:</legend>
          <div className="role-grid">
            {(["parent", "driver"] as const).map((role) => (
              <label
                key={role}
                className={`role-card ${values.role === role ? "selected" : ""}`}
              >
                <input
                  type="radio"
                  name="role"
                  value={role}
                  checked={values.role === role}
                  onChange={() => update("role", role)}
                />
                <span className="role-icon">
                  {role === "parent" ? <UsersRound /> : <BusFront />}
                </span>
                {values.role === role && (
                  <span className="role-check">
                    <Check size={16} />
                  </span>
                )}
                <strong>
                  I&apos;m a {role === "parent" ? "Parent" : "Driver"}
                </strong>
                <span>
                  {role === "parent"
                    ? "Follow your child's trip"
                    : "Run routes & track fees"}
                </span>
              </label>
            ))}
          </div>
        </fieldset>
        <Field
          id="name"
          label="Full name"
          autoComplete="name"
          maxLength={100}
          placeholder="e.g. Naledi Molefe"
          value={values.name}
          onChange={(e) => update("name", e.target.value)}
          error={errors.name}
        />
        <Field
          id="email"
          label="Email address"
          type="email"
          autoComplete="email"
          placeholder="naledi@example.co.za"
          value={values.email}
          onChange={(e) => update("email", e.target.value)}
          error={errors.email}
        />
        <Field
          id="phone"
          label="Mobile phone number"
          type="tel"
          autoComplete="tel"
          placeholder="082 123 4567 or +27 82 123 4567"
          value={values.phone}
          onChange={(e) => update("phone", e.target.value)}
          error={errors.phone}
        />
        <div>
          <Field
            id="password"
            label="Create password"
            type="password"
            autoComplete="new-password"
            placeholder="Enter a secure password"
            value={values.password}
            onChange={(e) => update("password", e.target.value)}
            error={errors.password}
          />
          <ul className="password-rules" aria-label="Password requirements">
            <li>
              {values.password.length >= 8 ? "✓" : "○"} 8 or more characters
            </li>
            <li>
              {/[a-z]/i.test(values.password) ? "✓" : "○"} At least one letter
            </li>
            <li>
              {/\d/.test(values.password) ? "✓" : "○"} At least one number
            </li>
          </ul>
        </div>
        <div>
          <label className="consent">
            <input
              type="checkbox"
              checked={values.consent}
              onChange={(e) => update("consent", e.target.checked)}
              aria-invalid={Boolean(errors.consent)}
              aria-describedby={errors.consent ? "consent-error" : undefined}
            />{" "}
            <span>
              I have read the <Link to="/privacy">Privacy Notice</Link> and
              consent to the described use of my personal information.
            </span>
          </label>
          {errors.consent && (
            <p id="consent-error" className="field-error" role="alert">
              {errors.consent}
            </p>
          )}
        </div>
        <button
          className="primary-button"
          type="submit"
          disabled={isSubmitting}
        >
          {isSubmitting
            ? "Creating account…"
            : values.role === "driver"
              ? "Continue"
              : "Create account"}{" "}
          <ArrowRight size={20} />
        </button>
        {message && (
          <p className="form-message" role="status">
            {message}
          </p>
        )}
      </form>
      <p className="bottom-link">
        Already have an account? <Link to="/login">Log in</Link>
      </p>
    </main>
  );
}
