import { ArrowLeft, Save, Trash2 } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { Field } from "../auth/ui";
import { DriverShell } from "./DriverShell";

export function FeeEntry() {
  const { id } = useParams();
  const editing = Boolean(id);
  const [status, setStatus] = useState("Pending");
  const [message, setMessage] = useState("");

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("Fee saved in this frontend preview.");
  }

  return (
    <DriverShell title={editing ? "Fee details" : "Add fee"}>
      <Link className="back-link" to="/driver/fees"><ArrowLeft size={18} />Back to fee ledger</Link>
      <form className="fee-form card form-stack" onSubmit={submit}>
        <label className="field-block"><span className="field-label">Learner</span><select className="input" defaultValue="Lethabo Mokoena"><option>Lethabo Mokoena</option><option>Amahle Khumalo</option><option>Ruan van Wyk</option></select></label>
        <Field id="billing-month" label="Billing month" type="month" defaultValue="2026-11" />
        <Field id="fee-amount" label="Amount (R)" type="number" min="0" step="0.01" defaultValue="1500.00" />
        <Field id="fee-due" label="Due date" type="date" defaultValue="2026-11-05" />
        <label className="field-block"><span className="field-label">Status</span><div className="fee-status-options">{["Pending", "Paid", "Overdue"].map((item) => <button type="button" key={item} className={status === item ? "active" : ""} onClick={() => setStatus(item)}>{item}</button>)}</div></label>
        {status === "Paid" && <div className="paid-fields"><label className="field-block"><span className="field-label">Payment method</span><select className="input"><option>Cash</option><option>EFT</option><option>Other</option></select></label><Field id="paid-date" label="Paid date" type="date" defaultValue="2026-11-03" /><Field id="payment-reference" label="Payment reference" placeholder="Optional reference" /></div>}
        <label className="field-block"><span className="field-label">Note</span><textarea className="input fee-note" placeholder="Optional note for this fee" /></label>
        <div className="fee-form-actions"><button className="primary-button" type="submit"><Save size={18} />Save fee</button>{status === "Pending" && <button type="button" className="delete-button" onClick={() => setMessage("Pending fee removed in this frontend preview.")}><Trash2 size={18} />Delete</button>}</div>
        {message && <p className="form-message" role="status">{message}</p>}
      </form>
    </DriverShell>
  );
}
