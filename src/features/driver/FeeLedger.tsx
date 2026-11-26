import { ChevronLeft, ChevronRight, Plus, Search, Sparkles } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { useEffect } from "react";
import { supabase } from "../../lib/supabase";
import { DriverShell } from "./DriverShell";

type Fee = { id: string; learner_id: string; learner_name: string; amount_cents: number; due_date: string; status: "pending" | "paid" | "overdue"; billing_month: string };
const money = new Intl.NumberFormat("en-ZA", { style: "currency", currency: "ZAR" });
const currentMonth = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Johannesburg", year: "numeric", month: "2-digit" }).format(new Date());

export function FeeLedger() {
  const [filter, setFilter] = useState("All");
  const [query, setQuery] = useState("");
  const [month, setMonth] = useState(currentMonth);
  const [fees, setFees] = useState<Fee[]>([]);
  const [summary, setSummary] = useState({ billed_cents: 0, collected_cents: 0, outstanding_cents: 0 });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [retry, setRetry] = useState(0);
  const [generateOpen, setGenerateOpen] = useState(false);
  const [amount, setAmount] = useState("1500.00");
  const [dueDate, setDueDate] = useState(`${currentMonth()}-05`);
  const [paying, setPaying] = useState<Fee | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "eft" | "other">("eft");

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setError("");
      if (!supabase) { if (active) { setError("The service is not configured."); setLoading(false); } return; }
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (!active) return;
      if (authError || !authData.user) { setError("Please log in to view the fee ledger."); setLoading(false); return; }
      const { data, error: queryError } = await supabase.rpc("get_driver_fee_ledger", { target_month: `${month}-01` });
      if (!active) return;
      if (queryError) setError("Could not load the fee ledger. Please retry.");
      else { setFees(data?.fees ?? []); setSummary(data?.summary ?? { billed_cents: 0, collected_cents: 0, outstanding_cents: 0 }); }
      setLoading(false);
    }
    void load();
    return () => { active = false; };
  }, [month, retry]);

  const visible = fees.filter((fee) => (filter === "All" || fee.status === filter.toLowerCase()) && fee.learner_name.toLowerCase().includes(query.toLowerCase()));
  function shiftMonth(amountBy: number) {
    const [year, selectedMonth] = month.split("-").map(Number);
    const next = new Date(Date.UTC(year!, selectedMonth! - 1 + amountBy, 1));
    const updated = `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, "0")}`;
    setMonth(updated);
    setDueDate(`${updated}-05`);
  }
  async function generateFees(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase || Number(amount) <= 0 || !dueDate) { setError("Enter a valid fee amount and due date."); return; }
    setBusy(true);
    setError("");
    const { data, error: rpcError } = await supabase.rpc("generate_monthly_fees", { month: `${month}-01`, amount_cents: Math.round(Number(amount) * 100), due_date: dueDate, route_id: null });
    setBusy(false);
    if (rpcError) { setError("Could not generate fees. Check the amount and due date."); return; }
    setGenerateOpen(false);
    setMessage(`Created ${data?.created ?? 0}, skipped ${data?.skipped ?? 0}.`);
    setRetry((current) => current + 1);
  }
  async function markPaid(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase || !paying) return;
    setBusy(true);
    const { error: rpcError } = await supabase.rpc("set_fee_status", { fee_id: paying.id, new_status: "paid", method: paymentMethod, reference: null, payment_time: new Date().toISOString() });
    setBusy(false);
    if (rpcError) { setError("Could not mark this fee as paid."); return; }
    setPaying(null);
    setRetry((current) => current + 1);
  }

  return (
    <DriverShell title="Fee ledger">
      <div className="fee-toolbar"><div className="month-picker"><button type="button" aria-label="Previous month" onClick={() => shiftMonth(-1)}><ChevronLeft size={18} /></button><strong>{new Intl.DateTimeFormat("en-ZA", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${month}-01T12:00:00Z`))}</strong><button type="button" aria-label="Next month" onClick={() => shiftMonth(1)}><ChevronRight size={18} /></button></div><div className="fee-actions"><button type="button" className="secondary-button" onClick={() => setGenerateOpen(true)}><Sparkles size={18} />Generate fees</button><Link className="icon-text-button filled" to="/driver/fees/new"><Plus size={18} />Add fee</Link></div></div>
      <section className="fee-summary"><article><span>Billed</span><strong>{money.format(summary.billed_cents / 100)}</strong></article><article><span>Collected</span><strong>{money.format(summary.collected_cents / 100)}</strong></article><article className="outstanding"><span>Outstanding</span><strong>{money.format(summary.outstanding_cents / 100)}</strong></article></section>
      {message && <p className="form-message" role="status">{message}</p>}{error && <div role="alert"><p>{error}</p><button className="text-button" type="button" onClick={() => setRetry((current) => current + 1)}>Retry</button></div>}
      <div className="fee-filter-row"><div className="filter-chips">{["All", "Pending", "Paid", "Overdue"].map((item) => <button type="button" key={item} className={filter === item ? "active" : ""} onClick={() => setFilter(item)}>{item}</button>)}</div><label className="fee-search"><Search size="18" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search learner" /></label></div>
      {loading && <p role="status">Loading fees…</p>}
      {!loading && !error && fees.length === 0 && <p>No fees recorded for this month.</p>}
      {!loading && !error && fees.length > 0 && <section className="fee-list">{visible.length ? visible.map((fee) => <article className="fee-row" key={fee.id}><div className="learner-avatar">{fee.learner_name.charAt(0)}</div><Link className="fee-copy" to={`/driver/fees/${fee.id}`}><strong>{fee.learner_name}</strong><span>Due {fee.due_date}</span></Link><div className="fee-value"><strong>{money.format(fee.amount_cents / 100)}</strong><span className={`fee-status ${fee.status}`}>{fee.status}</span></div>{fee.status !== "paid" && <button type="button" className="mark-paid" onClick={() => setPaying(fee)}>Mark paid</button>}</article>) : <p className="empty-row">No fees match this filter.</p>}</section>}
      {generateOpen && <div className="confirm-panel" role="dialog" aria-modal="true"><form onSubmit={generateFees}><h2>Generate monthly fees</h2><label className="field-block"><span className="field-label">Default amount (R)</span><input className="input" type="number" min="0.01" max="50000" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} required /></label><label className="field-block"><span className="field-label">Due date</span><input className="input" type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} required /></label><div><button type="button" className="secondary-button" onClick={() => setGenerateOpen(false)}>Cancel</button><button type="submit" className="primary-button" disabled={busy}>{busy ? "Generating…" : "Generate"}</button></div></form></div>}
      {paying && <div className="confirm-panel" role="dialog" aria-modal="true"><form onSubmit={markPaid}><h2>Record payment</h2><p>{paying.learner_name} · {money.format(paying.amount_cents / 100)}</p><label className="field-block"><span className="field-label">Payment method</span><select className="input" value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value as typeof paymentMethod)}><option value="cash">Cash</option><option value="eft">EFT</option><option value="other">Other</option></select></label><div><button type="button" className="secondary-button" onClick={() => setPaying(null)}>Cancel</button><button type="submit" className="primary-button" disabled={busy}>{busy ? "Saving…" : "Confirm payment"}</button></div></form></div>}
    </DriverShell>
  );
}
