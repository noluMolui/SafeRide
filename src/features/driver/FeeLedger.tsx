import { ChevronLeft, ChevronRight, Plus, Search, Sparkles } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { DriverShell } from "./DriverShell";

const fees = [
  { id: "fee-1", learner: "Lethabo Mokoena", amount: "R 1 500,00", due: "Due 5 Nov", status: "Paid" },
  { id: "fee-2", learner: "Amahle Khumalo", amount: "R 1 500,00", due: "Due 5 Nov", status: "Pending" },
  { id: "fee-3", learner: "Ruan van Wyk", amount: "R 1 500,00", due: "Overdue 5 Nov", status: "Overdue" },
];

export function FeeLedger() {
  const [filter, setFilter] = useState("All");
  const [query, setQuery] = useState("");
  const visible = fees.filter((fee) => (filter === "All" || fee.status === filter) && fee.learner.toLowerCase().includes(query.toLowerCase()));
  return (
    <DriverShell title="Fee ledger">
      <div className="fee-toolbar"><div className="month-picker"><button type="button" aria-label="Previous month"><ChevronLeft size={18} /></button><strong>November 2026</strong><button type="button" aria-label="Next month"><ChevronRight size={18} /></button></div><div className="fee-actions"><button type="button" className="secondary-button"><Sparkles size={18} />Generate fees</button><Link className="icon-text-button filled" to="/driver/fees/new"><Plus size={18} />Add fee</Link></div></div>
      <section className="fee-summary"><article><span>Billed</span><strong>R 13 500,00</strong></article><article><span>Collected</span><strong>R 7 500,00</strong></article><article className="outstanding"><span>Outstanding</span><strong>R 6 000,00</strong></article></section>
      <div className="fee-filter-row"><div className="filter-chips">{["All", "Pending", "Paid", "Overdue"].map((item) => <button type="button" key={item} className={filter === item ? "active" : ""} onClick={() => setFilter(item)}>{item}</button>)}</div><label className="fee-search"><Search size="18" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search learner" /></label></div>
      <section className="fee-list">{visible.length ? visible.map((fee) => <Link className="fee-row" key={fee.id} to={`/driver/fees/${fee.id}`}><div className="learner-avatar">{fee.learner.charAt(0)}</div><div className="fee-copy"><strong>{fee.learner}</strong><span>{fee.due}</span></div><div className="fee-value"><strong>{fee.amount}</strong><span className={`fee-status ${fee.status.toLowerCase()}`}>{fee.status}</span></div>{fee.status !== "Paid" && <button type="button" className="mark-paid" onClick={(event) => event.preventDefault()}>Mark paid</button>}<ChevronRight size={18} /></Link>) : <p className="empty-row">No fees match this filter.</p>}</section>
    </DriverShell>
  );
}
