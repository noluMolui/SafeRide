import { BusFront, Eye, EyeOff, ShieldCheck } from "lucide-react";
import { useState, type InputHTMLAttributes, type ReactNode } from "react";
import { Link } from "react-router-dom";

export function Brand() {
  return (
    <Link to="/login" className="inline-flex items-center gap-3 text-2xl font-bold text-ink">
      <span className="grid h-11 w-11 place-items-center rounded-xl bg-brand text-white">
        <BusFront size={24} aria-hidden="true" />
      </span>
      SafeRide
    </Link>
  );
}

export function Field({
  label,
  error,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string }) {
  const [visible, setVisible] = useState(false);
  const password = props.type === "password";
  return (
    <div>
      <label htmlFor={props.id} className="field-label">{label}</label>
      <div className="relative">
        <input
          {...props}
          type={password && visible ? "text" : props.type}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${props.id}-error` : props["aria-describedby"]}
          className={`input ${password ? "pr-14" : ""}`}
        />
        {password && (
          <button type="button" className="password-toggle" aria-label={visible ? "Hide password" : "Show password"} onClick={() => setVisible(!visible)}>
            {visible ? <EyeOff size={20} /> : <Eye size={20} />}
          </button>
        )}
      </div>
      {error && <p id={`${props.id}-error`} className="field-error" role="alert">{error}</p>}
    </div>
  );
}

export function Notice({ children }: { children: ReactNode }) {
  return <div className="notice" role="status"><ShieldCheck size={20} className="shrink-0 text-brand" /> <span>{children}</span></div>;
}

