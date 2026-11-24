import { AlertTriangle, ArrowRight, BusFront, Clock3, Plus, Route } from "lucide-react";
import { Link } from "react-router-dom";
import { ParentShell } from "./ParentShell";

export function ParentHome() {
  return (
    <ParentShell title="Good morning, Naledi">
      <div className="parent-status-bar"><span>Tuesday, 24 November</span><span>Updated 07:31:42 · <b>Live</b></span></div>
      <section className="parent-actions"><Link className="icon-text-button" to="/parent/children/new"><Plus size={18} />Add child</Link><Link className="icon-text-button filled" to="/parent/link"><Route size={18} />Link to a driver</Link></section>
      <section className="child-status-card"><div className="child-status-header"><div className="learner-avatar">L</div><div><h2>Lethabo Mokoena</h2><p>Crawford International · Grade 6</p></div><span className="status-pill picked">Picked Up · 07:24</span></div>
        <div className="parent-trip-grid"><article><span className="direction-chip morning">Morning</span><h3>Fourways to Crawford</h3><p><BusFront size={16} />Sipho Dlamini · 082 123 4567</p><span className="compliance-mini"><span>PrDP verified</span><span>Roadworthy valid</span></span></article><article><span className="direction-chip afternoon">Afternoon</span><h3>Crawford to Fourways</h3><p><Clock3 size={16} />Not started · 14:30</p><span className="status-pill waiting">No trip update</span></article></div>
        <div className="delay-banner"><AlertTriangle size={18} /><p><strong>Delay notice</strong><span>10 minutes · School traffic near Fourways</span></p></div>
        <Link className="history-link" to="/parent/children/child-1/history">View trip history <ArrowRight size={18} /></Link>
      </section>
    </ParentShell>
  );
}
