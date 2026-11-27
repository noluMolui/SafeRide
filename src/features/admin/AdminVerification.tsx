import { CheckCircle2, FileText, LogOut, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { useEffect } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../../lib/supabase";

type Status = "unverified" | "pending" | "rejected" | "verified";
type Driver = { id: string; full_name: string; phone_e164: string; pdp_number: string | null; pdp_expiry_date: string | null; pdp_document_path: string | null; pdp_verification: Status; pdp_verification_note: string | null };
type Vehicle = { id: string; driver_id: string; registration_number: string; make_model: string; roadworthy_expiry_date: string; roadworthy_document_path: string | null; roadworthy_verification: Status; roadworthy_verification_note: string | null };

export function AdminVerification() {
  const [filter, setFilter] = useState<"All" | Status>("All");
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [rejectTarget, setRejectTarget] = useState<{ id: string; documentType: "pdp" | "roadworthy" } | null>(null);
  const [reason, setReason] = useState("");
  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setError("");
      if (!supabase) { if (active) { setError("The service is not configured."); setLoading(false); } return; }
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (!active) return;
      if (authError || !authData.user) { setError("Please log in with an admin account."); setLoading(false); return; }
      const { data: profile } = await supabase.from("profiles").select("role").eq("id", authData.user.id).maybeSingle();
      if (!active) return;
      if (profile?.role !== "admin") { setError("Admin access is required."); setLoading(false); return; }
      const [driverResult, vehicleResult] = await Promise.all([
        supabase.from("profiles").select("id,full_name,phone_e164,pdp_number,pdp_expiry_date,pdp_document_path,pdp_verification,pdp_verification_note").eq("role", "driver"),
        supabase.from("vehicles").select("id,driver_id,registration_number,make_model,roadworthy_expiry_date,roadworthy_document_path,roadworthy_verification,roadworthy_verification_note"),
      ]);
      if (!active) return;
      if (driverResult.error || vehicleResult.error) setError("Could not load the verification queue.");
      else { setDrivers((driverResult.data ?? []) as Driver[]); setVehicles((vehicleResult.data ?? []) as Vehicle[]); }
      setLoading(false);
    }
    void load();
    return () => { active = false; };
  }, [refresh]);

  const rows = drivers.map((driver) => ({ driver, vehicle: vehicles.find((vehicle) => vehicle.driver_id === driver.id) ?? null }));
  const visible = rows.filter(({ driver, vehicle }) => filter === "All" || driver.pdp_verification === filter || vehicle?.roadworthy_verification === filter);

  async function verify(id: string, documentType: "pdp" | "roadworthy") {
    if (!supabase) return;
    setBusy(true); setError("");
    const { error: rpcError } = await supabase.rpc("verify_compliance", { target_id: id, document_type: documentType, new_status: "verified", reason: null });
    setBusy(false);
    if (rpcError) { setError("Could not verify this document. Confirm the document is uploaded."); return; }
    setRefresh((current) => current + 1);
  }
  async function reject() {
    if (!supabase || !rejectTarget) return;
    setBusy(true); setError("");
    const { error: rpcError } = await supabase.rpc("verify_compliance", { target_id: rejectTarget.id, document_type: rejectTarget.documentType, new_status: "rejected", reason: reason || null });
    setBusy(false);
    if (rpcError) { setError("Could not reject this document. Confirm the document is uploaded."); return; }
    setRejectTarget(null); setReason(""); setRefresh((current) => current + 1);
  }
  async function openDocument(path: string | null) {
    if (!supabase || !path) return;
    const { data, error: urlError } = await supabase.storage.from("compliance-docs").createSignedUrl(path, 60);
    if (urlError || !data?.signedUrl) { setError("Could not open the private document."); return; }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  }

  return (
    <div className="admin-app">
      <aside className="admin-sidebar"><Link className="admin-brand" to="/admin/verifications"><span><ShieldCheck size={22} /></span>SafeRide Admin</Link><nav><Link className="active" to="/admin/verifications"><CheckCircle2 size={20} />Verification queue</Link></nav><Link className="sidebar-logout" to="/login"><LogOut size={20} />Log out</Link></aside>
      <main className="admin-main"><div className="admin-content"><header className="admin-header"><div><p>Compliance review</p><h1>Verification queue</h1></div><span className="admin-count">{visible.length} records</span></header>
        {error && <p role="alert" className="form-message">{error}</p>}
        <div className="admin-filter-row" aria-label="Verification status filters">{(["All", "Unverified", "Pending", "Rejected", "Verified"] as const).map((item) => <button type="button" key={item} className={filter === (item === "All" ? "All" : item.toLowerCase()) ? "active" : ""} onClick={() => setFilter(item === "All" ? "All" : item.toLowerCase() as Status)}>{item}</button>)}</div>
        {loading && <p role="status">Loading verification queue…</p>}
        {!loading && !error && <section className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Driver</th><th>PrDP / expiry</th><th>Vehicle / roadworthy</th><th>Status</th><th>Documents</th><th><span className="sr-only">Actions</span></th></tr></thead><tbody>{visible.map(({ driver, vehicle }) => <tr key={driver.id}><td><strong>{driver.full_name}</strong><span>{driver.phone_e164}</span></td><td>{driver.pdp_number || "PrDP missing"} · {driver.pdp_expiry_date || "No expiry"}</td><td>{vehicle ? `${vehicle.registration_number} · ${vehicle.roadworthy_expiry_date}` : "Vehicle missing"}</td><td><div><span className={`verification-status ${driver.pdp_verification.toLowerCase()}`}>PrDP {driver.pdp_verification}</span><span className={`verification-status ${(vehicle?.roadworthy_verification ?? "unverified").toLowerCase()}`}>Vehicle {vehicle?.roadworthy_verification ?? "missing"}</span></div></td><td><button type="button" className="document-link" disabled={!driver.pdp_document_path} onClick={() => openDocument(driver.pdp_document_path)}><FileText size={16} />PrDP</button><button type="button" className="document-link" disabled={!vehicle?.roadworthy_document_path} onClick={() => openDocument(vehicle?.roadworthy_document_path ?? null)}><FileText size={16} />Roadworthy</button></td><td><div className="admin-actions"><button type="button" className="verify-button" disabled={busy || !driver.pdp_document_path || driver.pdp_verification === "verified"} onClick={() => verify(driver.id, "pdp")}>Verify PrDP</button><button type="button" className="reject-button" disabled={busy || !driver.pdp_document_path} onClick={() => setRejectTarget({ id: driver.id, documentType: "pdp" })}>Reject</button>{vehicle && <><button type="button" className="verify-button" disabled={busy || !vehicle.roadworthy_document_path || vehicle.roadworthy_verification === "verified"} onClick={() => verify(vehicle.id, "roadworthy")}>Verify vehicle</button><button type="button" className="reject-button" disabled={busy || !vehicle.roadworthy_document_path} onClick={() => setRejectTarget({ id: vehicle.id, documentType: "roadworthy" })}>Reject</button></>}</div></td></tr>)}</tbody></table>{visible.length === 0 && <p className="admin-empty">Nothing to review.</p>}</section>}
        {rejectTarget && <div className="reject-dialog" role="dialog" aria-modal="true"><h2>Reject verification</h2><p>Optional reason shown to the driver.</p><textarea className="input" maxLength={200} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Reason (maximum 200 characters)" /><span>{reason.length}/200</span><div><button type="button" className="secondary-button" onClick={() => setRejectTarget(null)}>Cancel</button><button type="button" className="delete-button" disabled={busy} onClick={reject}>Reject</button></div></div>}
      </div></main>
    </div>
  );
}
