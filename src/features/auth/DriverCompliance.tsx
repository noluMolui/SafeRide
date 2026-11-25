import { ArrowLeft, ArrowRight, BusFront, FileUp, ShieldCheck, X } from "lucide-react";
import { useState, type ChangeEvent, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { Field, Notice } from "./ui";
import { complianceSchema, fileError, southAfricaToday } from "./validation";

type Values = {
  pdp: string;
  pdpExpiry: string;
  suburbs: string[];
  registration: string;
  model: string;
  seats: number;
  roadworthyExpiry: string;
};
type Errors = Partial<Record<keyof Values, string>>;

function DocumentInput({ id, label }: { id: string; label: string }) {
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState("");
  function change(event: ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0];
    if (!selected) return;
    const problem = fileError(selected);
    setError(problem ?? "");
    setFile(problem ? null : selected);
    event.target.value = "";
  }
  return (
    <div>
      <span className="field-label">{label} <span className="optional">Optional · max 5 MB</span></span>
      {file ? (
        <div className="file-selected"><span>{file.name}</span><button type="button" onClick={() => setFile(null)} aria-label={`Remove ${label}`}><X size={20} /></button></div>
      ) : (
        <label className="upload-box" htmlFor={id}><FileUp size={22} /> Choose a JPEG, PNG or PDF<input id={id} type="file" accept=".jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf" onChange={change} /></label>
      )}
      {error && <p className="field-error" role="alert">{error}</p>}
    </div>
  );
}

export function DriverCompliance() {
  const [values, setValues] = useState<Values>({ pdp: "", pdpExpiry: "", suburbs: [], registration: "", model: "", seats: 15, roadworthyExpiry: "" });
  const [suburb, setSuburb] = useState("");
  const [suburbError, setSuburbError] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [message, setMessage] = useState("");
  function update<K extends keyof Values>(key: K, value: Values[K]) {
    setValues((current) => ({ ...current, [key]: value }));
  }
  function addSuburb() {
    const name = suburb.trim();
    if (name.length < 2 || name.length > 60) { setSuburbError("Enter a suburb of 2–60 characters."); return; }
    if (values.suburbs.length >= 10) { setSuburbError("You can add up to 10 suburbs."); return; }
    if (values.suburbs.some((item) => item.toLowerCase() === name.toLowerCase())) { setSuburbError("This suburb has already been added."); return; }
    update("suburbs", [...values.suburbs, name]);
    setSuburb("");
    setSuburbError("");
  }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = complianceSchema.safeParse(values);
    if (!result.success) {
      const next: Errors = {};
      for (const issue of result.error.issues) {
        const key = issue.path[0] as keyof Values;
        if (!next[key]) next[key] = issue.message;
      }
      setErrors(next);
      setMessage("");
      return;
    }
    setErrors({});
    setMessage("Registration is not available yet. Your details and documents have not been saved or sent.");
  }
  return (
    <main className="auth-page compliance-page">
      <header className="compliance-header"><Link className="back-button" to="/signup" aria-label="Back to account details"><ArrowLeft /></Link><span>Driver Compliance Onboarding</span></header>
      <div className="stepper"><span>✓ <span>1 Details</span></span><i /><strong>2 Compliance</strong></div>
      <p className="intro">Step 2 of 2: South African road and safety credentials</p>
      <form className="form-stack" noValidate onSubmit={submit}>
        <section className="card form-stack">
          <div className="section-title"><div><h2>Professional Driving Permit</h2><p>Required for scholar transport operators in South Africa.</p></div><ShieldCheck size={22} /></div>
          <Field id="pdp" label="PrDP number" maxLength={20} value={values.pdp} onChange={(e) => update("pdp", e.target.value)} error={errors.pdp} />
          <Field id="pdp-expiry" label="PrDP expiry date" type="date" min={southAfricaToday()} value={values.pdpExpiry} onChange={(e) => update("pdpExpiry", e.target.value)} error={errors.pdpExpiry} />
          <DocumentInput id="pdp-document" label="PrDP document" />
        </section>
        <section className="card form-stack">
          <div className="section-title"><div><h2>Service area</h2><p>Where do you pick up and drop off learners?</p></div></div>
          <div>
            <label className="field-label" htmlFor="suburb">Operating suburbs <span className="optional">{values.suburbs.length} of 10 added</span></label>
            <div className="tags">{values.suburbs.map((item) => <span className="tag" key={item}>{item}<button type="button" aria-label={`Remove ${item}`} onClick={() => update("suburbs", values.suburbs.filter((s) => s !== item))}><X size={16} /></button></span>)}</div>
            <div className="suburb-entry"><input id="suburb" className="input" value={suburb} maxLength={60} placeholder="e.g. Fourways" onChange={(e) => setSuburb(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addSuburb(); } }} /><button className="small-button" type="button" onClick={addSuburb}>+ Add</button></div>
            {(suburbError || errors.suburbs) && <p className="field-error" role="alert">{suburbError || errors.suburbs}</p>}
          </div>
        </section>
        <section className="card form-stack">
          <div className="section-title"><div><h2>Your vehicle</h2><p>Minibus or kombi registered for scholar transport.</p></div><BusFront size={22} /></div>
          <Field id="registration" label="Registration number" placeholder="e.g. CA 123-456" value={values.registration} onChange={(e) => update("registration", e.target.value)} error={errors.registration} />
          <Field id="model" label="Make and model" placeholder="e.g. Toyota Quantum" value={values.model} onChange={(e) => update("model", e.target.value)} error={errors.model} />
          <Field id="seats" label="Seating capacity (excluding driver)" type="number" min={4} max={35} value={values.seats} onChange={(e) => update("seats", e.target.valueAsNumber)} error={errors.seats} />
          <Field id="roadworthy-expiry" label="Roadworthy expiry date" type="date" min={southAfricaToday()} value={values.roadworthyExpiry} onChange={(e) => update("roadworthyExpiry", e.target.value)} error={errors.roadworthyExpiry} />
          <DocumentInput id="roadworthy-document" label="Roadworthy certificate" />
        </section>
        <Notice>Parents will see your compliance status. Documents are intended for private review when the backend is connected.</Notice>
        <button className="primary-button" type="submit">Finish registration <ArrowRight size={20} /></button>
        {message && <p className="form-message" role="status">{message}</p>}
      </form>
    </main>
  );
}
