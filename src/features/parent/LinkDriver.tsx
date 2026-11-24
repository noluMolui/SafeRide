import { ArrowLeft, CheckCircle2, Search, ShieldCheck } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { Field } from "../auth/ui";
import { ParentShell } from "./ParentShell";

export function LinkDriver() {
  const [code, setCode] = useState("");
  const [preview, setPreview] = useState(false);
  const [sent, setSent] = useState(false);

  function lookup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSent(false);
    setPreview(code.trim().length === 8);
  }

  return (
    <ParentShell title="Link to a driver">
      <Link className="back-link" to="/parent/children"><ArrowLeft size={18} />Back to children</Link>
      {sent ? <section className="route-request-success"><span><CheckCircle2 size={28} /></span><h2>Request sent</h2><p>Waiting for Sipho Dlamini to approve the route link.</p><Link className="primary-button" to="/parent/children">View children</Link></section> : <>
        <form className="link-code-form card" onSubmit={lookup}><Field id="invite-code" label="Driver invite code" value={code} maxLength={8} onChange={(event) => setCode(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))} placeholder="8 characters" /><button className="primary-button" type="submit"><Search size="18" />Look up</button></form>
        {preview ? <section className="driver-preview"><div className="driver-preview-header"><div className="learner-avatar">S</div><div><h2>Sipho Dlamini</h2><p>082 123 4567</p></div><span className="verified-badge"><ShieldCheck size="16" />Verified</span></div><div className="driver-preview-grid"><p><span>Vehicle</span><strong>Toyota Quantum · CA 123-456</strong></p><p><span>Route</span><strong>Fourways to Crawford · Morning</strong></p><p><span>Departure</span><strong>07:15 · Mon–Fri</strong></p><p><span>Compliance</span><strong>PrDP valid · Roadworthy valid</strong></p></div><label className="field-block"><span className="field-label">Select child</span><select className="input"><option>Lethabo Mokoena</option></select></label><button type="button" className="primary-button" onClick={() => setSent(true)}>Confirm request</button></section> : code.length > 0 && code.length < 8 ? <p className="field-error">Enter all 8 invite code characters.</p> : null}
      </>}
    </ParentShell>
  );
}
