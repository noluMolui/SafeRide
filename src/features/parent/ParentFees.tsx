import { AlertTriangle, CheckCircle2, ChevronRight } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import { ParentShell } from "./ParentShell";

type Child = { id: string; full_name: string };
type Fee = { id: string; learner_id: string; billing_month: string; amount_cents: number; due_date: string; status: "pending" | "paid" | "overdue"; paid_at: string | null; payment_method: string | null; payment_reference: string | null };
const money = new Intl.NumberFormat("en-ZA", { style: "currency", currency: "ZAR" });

export function ParentFees() {
  const [child, setChild] = useState("All children");
  const [children, setChildren] = useState<Child[]>([]);
  const [fees, setFees] = useState<Fee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setError("");
      if (!supabase) { if (active) { setError("The service is not configured."); setLoading(false); } return; }
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (!active) return;
      if (authError || !authData.user) { setError("Please log in to view fee history."); setLoading(false); return; }
      const { data: childRows, error: childError } = await supabase.from("learners").select("id,full_name").eq("is_active", true).order("full_name");
      if (!active) return;
      if (childError) { setError("Could not load child profiles."); setLoading(false); return; }
      const ownedChildren = childRows ?? [];
      setChildren(ownedChildren);
      if (ownedChildren.length === 0) { setFees([]); setLoading(false); return; }
      const { data: feeRows, error: feeError } = await supabase.from("fee_records")
        .select("id,learner_id,billing_month,amount_cents,due_date,status,paid_at,payment_method,payment_reference")
        .in("learner_id", ownedChildren.map((item) => item.id)).order("billing_month", { ascending: false });
      if (!active) return;
      if (feeError) setError("Could not load fee history.");
      else setFees((feeRows ?? []) as Fee[]);
      setLoading(false);
    }
    void load();
    return () => { active = false; };
  }, []);

  const visible = useMemo(() => fees.filter((fee) => child === "All children" || fee.learner_id === child), [fees, child]);
  const outstanding = visible.filter((fee) => fee.status === "pending" || fee.status === "overdue");
  const payments = visible.filter((fee) => fee.status === "paid");
  const balance = outstanding.reduce((total, fee) => total + fee.amount_cents, 0);
  const overdueBalance = outstanding.filter((fee) => fee.status === "overdue").reduce((total, fee) => total + fee.amount_cents, 0);
  function monthLabel(value: string) { return new Intl.DateTimeFormat("en-ZA", { month: "long", year: "numeric", timeZone: "Africa/Johannesburg" }).format(new Date(`${value}T12:00:00`)); }
  function dateLabel(value: string) { return new Intl.DateTimeFormat("en-ZA", { day: "numeric", month: "long", timeZone: "Africa/Johannesburg" }).format(new Date(`${value}T12:00:00`)); }

  return (
    <ParentShell title="Fees">
      <label className="parent-child-select"><span>Child</span><select value={child} onChange={(event) => setChild(event.target.value)}><option value="All children">All children</option>{children.map((item) => <option key={item.id} value={item.id}>{item.full_name}</option>)}</select></label>
      {loading && <p role="status">Loading fees…</p>}
      {error && <p role="alert">{error}</p>}
      {!loading && !error && fees.length === 0 && <p>No fees recorded yet.</p>}
      {!loading && !error && fees.length > 0 && <>
      <section className="parent-balance-card"><div><span>Outstanding balance</span><strong>{money.format(balance / 100)}</strong></div>{overdueBalance > 0 && <div className="overdue-balance"><AlertTriangle size={18} /><p><strong>{money.format(overdueBalance / 100)} overdue</strong><span>Contact your driver if you need help.</span></p></div>}{balance === 0 && <div className="overdue-balance"><CheckCircle2 size={18} /><p><strong>All paid up</strong></p></div>}</section>
      <section className="parent-fee-section"><h2>Outstanding</h2>{outstanding.length ? outstanding.map((fee) => <article className="parent-fee-row" key={fee.id}><div className="fee-month-icon"><span>{monthLabel(fee.billing_month).slice(0, 3)}</span></div><div className="fee-copy"><strong>{monthLabel(fee.billing_month)}</strong><span>Due {dateLabel(fee.due_date)}</span></div><div className="fee-value"><strong>{money.format(fee.amount_cents / 100)}</strong><span className={`fee-status ${fee.status}`}>{fee.status}</span></div><ChevronRight size={18} /></article>) : <p>Nothing outstanding.</p>}</section>
      <section className="parent-fee-section"><h2>Payment history</h2>{payments.length ? payments.map((payment) => <article className="parent-fee-row" key={payment.id}><span className="paid-icon"><CheckCircle2 size={20} /></span><div className="fee-copy"><strong>{monthLabel(payment.billing_month)}</strong><span>{payment.paid_at ? `Paid ${dateLabel(payment.paid_at.slice(0, 10))}` : "Paid"} · {payment.payment_method ?? ""}{payment.payment_reference ? ` · ${payment.payment_reference}` : ""}</span></div><div className="fee-value"><strong>{money.format(payment.amount_cents / 100)}</strong><span className="fee-status paid">Paid</span></div></article>) : <p>No payments recorded yet.</p>}</section>
      </>}
      <p className="payment-helper">Pay your driver directly. The driver will mark your payment as paid.</p>
    </ParentShell>
  );
}
