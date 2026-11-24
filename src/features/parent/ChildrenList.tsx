import { ArrowRight, Plus, Route } from "lucide-react";
import { Link } from "react-router-dom";
import { ParentShell } from "./ParentShell";

export function ChildrenList() {
  return (
    <ParentShell title="My children">
      <div className="parent-toolbar"><p>Manage profiles and route links.</p><Link className="icon-text-button filled" to="/parent/children/new"><Plus size={18} />Add child</Link></div>
      <section className="children-list">
        <article className="child-list-card"><div className="child-list-header"><div className="learner-avatar">L</div><div><h2>Lethabo Mokoena</h2><p>Crawford International · Grade 6</p></div><Link className="secondary-button small-secondary" to="/parent/children/child-1/edit">Edit</Link></div>
          <div className="enrollment-list"><div><span className="direction-chip morning">Morning</span><p><strong>Active</strong><span>Fourways to Crawford · Sipho Dlamini</span></p><button type="button">Leave route</button></div><div><span className="direction-chip afternoon">Afternoon</span><p><strong>Pending approval</strong><span>Crawford to Fourways · Sipho Dlamini</span></p><button type="button">Cancel request</button></div></div>
        </article>
      </section>
      <Link className="link-driver-banner" to="/parent/link"><span><Route size={20} /></span><div><strong>Link another route</strong><p>Enter a driver's 8-character invite code</p></div><ArrowRight size={20} /></Link>
    </ParentShell>
  );
}
