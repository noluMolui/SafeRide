import { AlertTriangle, CheckCircle2, FileUp, LogOut, Trash2, Upload } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { DriverShell } from "./DriverShell";

export function ComplianceProfile() {
  const [confirmDelete, setConfirmDelete] = useState(false);
  return (
    <DriverShell title="Profile & compliance">
      <section className="profile-banner"><AlertTriangle size={20} /><p><strong>Roadworthy expires soon</strong><span>Renew it by 8 December to keep trip access.</span></p></section>
      <section className="profile-grid">
        <article className="profile-card"><div className="profile-card-heading"><div><span>Professional Driving Permit</span><h2>PrDP 123456789</h2></div><span className="verified-badge"><CheckCircle2 size={16} />Verified</span></div><div className="profile-facts"><p><span>Expiry</span><strong>18 March 2027</strong></p><p><span>Status</span><strong className="valid-text">Valid</strong></p></div><button type="button" className="secondary-button"><Upload size={18} />Replace document</button></article>
        <article className="profile-card"><div className="profile-card-heading"><div><span>Vehicle</span><h2>CA 123-456</h2></div><span className="warning-badge"><AlertTriangle size={16} />Pending review</span></div><p className="vehicle-name">Toyota Quantum · 15 seats</p><div className="profile-facts"><p><span>Roadworthy expiry</span><strong>8 December 2026</strong></p><p><span>Expiry status</span><strong className="warning-text">Expiring soon</strong></p></div><button type="button" className="secondary-button"><FileUp size={18} />Replace certificate</button></article>
      </section>
      <section className="settings-card"><h2>Service details</h2><div className="settings-grid"><p><span>Service suburbs</span><strong>Fourways, Sandton, Bryanston</strong></p><p><span>Contact</span><strong>Sipho Dlamini · +27 82 123 4567</strong></p></div></section>
      <section className="danger-zone"><div><h2>Account actions</h2><p>These actions affect access and stored account data.</p></div><div className="danger-actions"><Link className="secondary-button" to="/login"><LogOut size={18} />Log out</Link><button type="button" className="delete-button" onClick={() => setConfirmDelete(true)}><Trash2 size={18} />Delete account</button></div></section>
      {confirmDelete && <div className="confirm-panel" role="alertdialog" aria-modal="true"><h2>Delete SafeRide account?</h2><p>This preview cannot delete a real account. In the live app, all owned profiles and records will be permanently removed.</p><div><button type="button" className="secondary-button" onClick={() => setConfirmDelete(false)}>Cancel</button><button type="button" className="delete-button" onClick={() => setConfirmDelete(false)}>Confirm delete</button></div></div>}
    </DriverShell>
  );
}
