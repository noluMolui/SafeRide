import { AlertTriangle, CheckCircle2, ChevronRight } from "lucide-react";
import { useState } from "react";
import { ParentShell } from "./ParentShell";

const outstanding = [
  { month: "November 2026", amount: "R 1 500,00", due: "Due 5 November", status: "Overdue" },
  { month: "October 2026", amount: "R 1 500,00", due: "Due 5 October", status: "Pending" },
];

const payments = [
  { month: "September 2026", amount: "R 1 500,00", paid: "Paid 3 September", method: "EFT", reference: "FSP-2409" },
  { month: "August 2026", amount: "R 1 500,00", paid: "Paid 2 August", method: "Cash", reference: "" },
];

export function ParentFees() {
  const [child, setChild] = useState("All children");
  return (
    <ParentShell title="Fees">
      <label className="parent-child-select"><span>Child</span><select value={child} onChange={(event) => setChild(event.target.value)}><option>All children</option><option>Lethabo Mokoena</option><option>Thando Mokoena</option></select></label>
      <section className="parent-balance-card"><div><span>Outstanding balance</span><strong>R 3 000,00</strong></div><div className="overdue-balance"><AlertTriangle size={18} /><p><strong>R 1 500,00 overdue</strong><span>November payment is past due</span></p></div></section>
      <section className="parent-fee-section"><h2>Outstanding</h2>{outstanding.map((fee) => <article className="parent-fee-row" key={fee.month}><div className="fee-month-icon"><span>{fee.month.slice(0, 3)}</span></div><div className="fee-copy"><strong>{fee.month}</strong><span>{fee.due}</span></div><div className="fee-value"><strong>{fee.amount}</strong><span className={`fee-status ${fee.status.toLowerCase()}`}>{fee.status}</span></div><ChevronRight size={18} /></article>)}</section>
      <section className="parent-fee-section"><h2>Payment history</h2>{payments.map((payment) => <article className="parent-fee-row" key={payment.month}><span className="paid-icon"><CheckCircle2 size={20} /></span><div className="fee-copy"><strong>{payment.month}</strong><span>{payment.paid} · {payment.method}{payment.reference ? ` · ${payment.reference}` : ""}</span></div><div className="fee-value"><strong>{payment.amount}</strong><span className="fee-status paid">Paid</span></div></article>)}</section>
      <p className="payment-helper">Pay your driver directly. The driver will mark your payment as paid.</p>
    </ParentShell>
  );
}
