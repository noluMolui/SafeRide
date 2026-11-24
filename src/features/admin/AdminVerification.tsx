import { CheckCircle2, FileText, LogOut, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";

const drivers = [
  { id: "1", name: "Sipho Dlamini", phone: "+27 82 123 4567", pdp: "123456789 · 18 Mar 2027", vehicle: "CA 123-456 · 8 Dec 2026", status: "Pending" },
  { id: "2", name: "Zanele Ndlovu", phone: "+27 79 555 0182", pdp: "987654321 · 12 Jan 2027", vehicle: "CY 987-654 · 22 Jan 2027", status: "Unverified" },
  { id: "3", name: "Thabo Molefe", phone: "+27 83 222 1044", pdp: "Document missing", vehicle: "KN 556-221 · 14 Feb 2027", status: "Rejected" },
];

type Status = "Unverified" | "Pending" | "Rejected" | "Verified";

export function AdminVerification() {
  const [filter, setFilter] = useState<"All" | Status>("All");
  const [rows, setRows] = useState(drivers);
  const [rejectId, setRejectId] = useState("");
  const [reason, setReason] = useState("");
  const visible = rows.filter((row) => filter === "All" || row.status === filter);

  function verify(id: string) { setRows((current) => current.map((row) => row.id === id ? { ...row, status: "Verified" } : row)); }
  function reject(id: string) { setRows((current) => current.map((row) => row.id === id ? { ...row, status: "Rejected" } : row)); setRejectId(""); setReason(""); }

  return (
    <div className="admin-app">
      <aside className="admin-sidebar"><Link className="admin-brand" to="/admin/verifications"><span><ShieldCheck size={22} /></span>SafeRide Admin</Link><nav><Link className="active" to="/admin/verifications"><CheckCircle2 size={20} />Verification queue</Link></nav><Link className="sidebar-logout" to="/login"><LogOut size={20} />Log out</Link></aside>
      <main className="admin-main"><div className="admin-content"><header className="admin-header"><div><p>Compliance review</p><h1>Verification queue</h1></div><span className="admin-count">{visible.length} records</span></header>
        <div className="admin-filter-row" aria-label="Verification status filters">{(["All", "Unverified", "Pending", "Rejected", "Verified"] as const).map((item) => <button type="button" key={item} className={filter === item ? "active" : ""} onClick={() => setFilter(item)}>{item}</button>)}</div>
        <section className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Driver</th><th>PrDP / expiry</th><th>Vehicle / roadworthy</th><th>Status</th><th>Documents</th><th><span className="sr-only">Actions</span></th></tr></thead><tbody>{visible.map((row) => <tr key={row.id}><td><strong>{row.name}</strong><span>{row.phone}</span></td><td>{row.pdp}</td><td>{row.vehicle}</td><td><span className={`verification-status ${row.status.toLowerCase()}`}>{row.status}</span></td><td><button type="button" className="document-link" disabled={row.pdp.includes("missing")}><FileText size={16} />{row.pdp.includes("missing") ? "Missing" : "View"}</button></td><td><div className="admin-actions"><button type="button" className="verify-button" onClick={() => verify(row.id)} disabled={row.status === "Verified" || row.pdp.includes("missing")}>Verify</button><button type="button" className="reject-button" onClick={() => setRejectId(row.id)}>Reject</button></div></td></tr>)}</tbody></table>{visible.length === 0 && <p className="admin-empty">Nothing to review.</p>}</section>
        {rejectId && <div className="reject-dialog" role="dialog" aria-modal="true"><h2>Reject verification</h2><p>Optional reason shown to the driver.</p><textarea className="input" maxLength={200} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Reason (maximum 200 characters)" /><span>{reason.length}/200</span><div><button type="button" className="secondary-button" onClick={() => setRejectId("")}>Cancel</button><button type="button" className="delete-button" onClick={() => reject(rejectId)}>Reject</button></div></div>}
      </div></main>
    </div>
  );
}
