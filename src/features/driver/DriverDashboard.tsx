import { AlertTriangle, ArrowRight, BusFront, CheckCircle2, Clock3, MapPin, Plus } from "lucide-react";
import { Link } from "react-router-dom";
import { DriverShell } from "./DriverShell";

export function DriverDashboard() {
  return (
    <DriverShell title="Good morning, Sipho">
      <section className="driver-date"><span>Tuesday, 24 November</span><span className="online-chip"><i />Online</span></section>
      <section className="compliance-strip">
        <div><span className="compliance-icon"><CheckCircle2 size={20} /></span><p><strong>PrDP</strong><span>Valid · 18 Mar 2027</span></p></div>
        <div><span className="compliance-icon warning"><AlertTriangle size={20} /></span><p><strong>Roadworthy</strong><span>Expiring soon · 8 Dec</span></p></div>
        <Link to="/driver/profile" aria-label="View compliance profile"><ArrowRight size={20} /></Link>
      </section>
      <section className="driver-section-heading"><div><p>Today&apos;s routes</p><span>2 routes scheduled</span></div><Link className="icon-text-button" to="/driver/routes/new"><Plus size={18} />New route</Link></section>
      <div className="route-card-grid">
        <article className="route-card featured">
          <div className="route-card-top"><span className="direction-chip morning">Morning</span><span>07:15</span></div>
          <h2>Fourways to Crawford</h2>
          <p><MapPin size={17} />Fourways · Sandton</p>
          <div className="route-card-meta"><span><BusFront size={17} />9 learners</span><span>CA 123-456</span></div>
          <Link className="primary-button" to="/driver/trip/trip-1">Start trip <ArrowRight size={19} /></Link>
        </article>
        <article className="route-card">
          <div className="route-card-top"><span className="direction-chip afternoon">Afternoon</span><span>14:30</span></div>
          <h2>Crawford to Fourways</h2>
          <p><MapPin size={17} />Crawford · Fourways</p>
          <div className="route-card-meta"><span><BusFront size={17} />9 learners</span><span>CA 123-456</span></div>
          <button className="secondary-button" type="button">View route</button>
        </article>
      </div>
      <section className="dashboard-requests"><div><span className="request-icon"><Clock3 size={20} /></span><p><strong>2 pending requests</strong><span>Waiting for your approval</span></p></div><Link to="/driver/routes/route-1">Review <ArrowRight size={18} /></Link></section>
    </DriverShell>
  );
}
