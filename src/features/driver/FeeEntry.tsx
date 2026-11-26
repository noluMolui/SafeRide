import { ArrowLeft, Save, Trash2 } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { Field } from "../auth/ui";
import { DriverShell } from "./DriverShell";

type Learner = { id: string; full_name: string };
type Fee = { id: string; learner_id: string; billing_month: string; amount_cents: number; due_date: string; status: "pending" | "paid" | "overdue"; ever_paid: boolean; note: string | null; payment_method: string | null; paid_at: string | null; payment_reference: string | null };
const thisMonth = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Johannesburg", year: "numeric", month: "2-digit" }).format(new Date());

export function FeeEntry() {
  const { id } = useParams();
  const editing = Boolean(id);
  const [learners, setLearners] = useState<Learner[]>([]);
  const [learnerId, setLearnerId] = useState("");
  const [billingMonth, setBillingMonth] = useState(thisMonth);
  const [amount, setAmount] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [note, setNote] = useState("");
  const [fee, setFee] = useState<Fee | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "eft" | "other">("eft");
  const [paymentReference, setPaymentReference] = useState("");
  const [paidAt, setPaidAt] = useState(new Date().toISOString().slice(0, 10));
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;
    async function load() {
      if (!supabase) { if (active) { setMessage("The service is not configured."); setLoading(false); } return; }
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (!active) return;
      if (authError || !authData.user) { setMessage("Please log in to manage fees."); setLoading(false); return; }
      const enrollmentResult = await supabase.from("route_enrollments").select("learner_id").eq("status", "active");
      if (!active) return;
      if (enrollmentResult.error) { setMessage("Could not load active learners."); setLoading(false); return; }
      const learnerIds = [...new Set((enrollmentResult.data ?? []).map((row) => row.learner_id))];
      const learnerResult = learnerIds.length ? await supabase.from("learners").select("id,full_name").in("id", learnerIds).eq("is_active", true).order("full_name") : { data: [], error: null };
      if (!active) return;
      if (learnerResult.error) { setMessage("Could not load active learners."); setLoading(false); return; }
      setLearners(learnerResult.data ?? []);
      if (id) {
        const { data, error } = await supabase.from("fee_records").select("id,learner_id,billing_month,amount_cents,due_date,status,ever_paid,note,payment_method,paid_at,payment_reference").eq("id", id).maybeSingle();
        if (!active) return;
        if (error || !data) setMessage("Could not load this fee record.");
        else {
          const current = data as Fee;
          setFee(current); setLearnerId(current.learner_id); setBillingMonth(current.billing_month.slice(0, 7));
          setAmount((current.amount_cents / 100).toFixed(2)); setDueDate(current.due_date); setNote(current.note ?? "");
          if (current.payment_method) setPaymentMethod(current.payment_method as typeof paymentMethod);
          if (current.payment_reference) setPaymentReference(current.payment_reference);
          if (current.paid_at) setPaidAt(current.paid_at.slice(0, 10));
        }
      } else if (learnerIds.length === 1) setLearnerId(learnerIds[0]!);
      setLoading(false);
    }
    void load();
    return () => { active = false; };
  }, [id]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase || !learnerId || !billingMonth || !dueDate || Number(amount) <= 0) { setMessage("Select a learner and enter a valid amount and due date."); return; }
    setBusy(true); setMessage("");
    let error;
    if (fee) {
      ({ error } = await supabase.rpc("update_pending_fee", { fee_id: fee.id, new_amount_cents: Math.round(Number(amount) * 100), new_due_date: dueDate, new_note: note || null }));
    } else {
      ({ error } = await supabase.rpc("create_fee", { target_learner_id: learnerId, month: `${billingMonth}-01`, amount: Math.round(Number(amount) * 100), due: dueDate, fee_note: note || null }));
    }
    setBusy(false);
    setMessage(error ? "Could not save this fee. Check the billing month, due date, and active enrollment." : "Fee saved.");
  }

  async function updateStatus(nextStatus: "paid" | "overdue" | "pending") {
    if (!supabase || !fee) return;
    setBusy(true);
    const { error } = await supabase.rpc("set_fee_status", { fee_id: fee.id, new_status: nextStatus, method: nextStatus === "paid" ? paymentMethod : null, reference: nextStatus === "paid" ? paymentReference || null : null, payment_time: nextStatus === "paid" ? `${paidAt}T12:00:00` : null });
    setBusy(false);
    if (error) setMessage("Could not update fee status.");
    else { setFee({ ...fee, status: nextStatus, payment_method: nextStatus === "paid" ? paymentMethod : null, payment_reference: nextStatus === "paid" ? paymentReference : null }); setMessage("Fee status updated."); }
  }

  async function removeFee() {
    if (!supabase || !fee) return;
    setBusy(true);
    const { error } = await supabase.rpc("delete_pending_fee", { fee_id: fee.id });
    setBusy(false);
    setMessage(error ? "This fee cannot be deleted." : "Fee deleted.");
  }

  return (
    <DriverShell title={editing ? "Fee details" : "Add fee"}>
      <Link className="back-link" to="/driver/fees"><ArrowLeft size={18} />Back to fee ledger</Link>
      {loading ? <p role="status">Loading fee details...</p> : <form className="fee-form card form-stack" onSubmit={submit}>
        <label className="field-block"><span className="field-label">Learner</span><select className="input" value={learnerId} onChange={(event) => setLearnerId(event.target.value)} disabled={Boolean(fee && fee.status !== "pending")}><option value="">Select learner</option>{learners.map((learner) => <option key={learner.id} value={learner.id}>{learner.full_name}</option>)}</select>{learners.length === 0 && <p>No active learners on your roster.</p>}</label>
        <Field id="billing-month" label="Billing month" type="month" value={billingMonth} onChange={(event) => setBillingMonth(event.target.value)} readOnly={Boolean(fee)} />
        <Field id="fee-amount" label="Amount (R)" type="number" min="0.01" max="50000" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} readOnly={Boolean(fee && (fee.status !== "pending" || fee.ever_paid))} />
        <Field id="fee-due" label="Due date" type="date" min={`${billingMonth}-01`} value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
        <label className="field-block"><span className="field-label">Note</span><textarea className="input fee-note" maxLength={200} value={note} onChange={(event) => setNote(event.target.value)} placeholder="Optional note" /></label>
        {fee?.status === "paid" && <div className="paid-fields"><label className="field-block"><span className="field-label">Payment method</span><select className="input" value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value as typeof paymentMethod)}><option value="cash">Cash</option><option value="eft">EFT</option><option value="other">Other</option></select></label><Field id="paid-date" label="Paid date" type="date" value={paidAt} onChange={(event) => setPaidAt(event.target.value)} /><Field id="payment-reference" label="Payment reference" maxLength={50} value={paymentReference} onChange={(event) => setPaymentReference(event.target.value)} /></div>}
        <div className="fee-form-actions"><button className="primary-button" type="submit" disabled={busy || (fee?.status === "paid")}><Save size={18} />{busy ? "Saving…" : "Save fee"}</button>{fee?.status === "pending" && <button type="button" className="secondary-button" disabled={busy} onClick={() => updateStatus("paid")}>Mark paid</button>}{fee?.status === "pending" && <button type="button" className="delete-button" disabled={busy || fee.ever_paid} onClick={removeFee}><Trash2 size={18} />Delete</button>}</div>
        {fee && <label className="field-block"><span className="field-label">Status: {fee.status}</span><select className="input" value={fee.status} onChange={(event) => updateStatus(event.target.value as "paid" | "overdue" | "pending")} disabled={busy}><option value={fee.status}>{fee.status}</option>{fee.status !== "paid" && <option value="overdue">Overdue</option>}{fee.status !== "pending" && <option value="pending">Pending</option>}</select></label>}
        {message && <p className="form-message" role="status">{message}</p>}
      </form>}
    </DriverShell>
  );
}
