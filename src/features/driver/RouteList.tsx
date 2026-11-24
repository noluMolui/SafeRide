import { BusFront, ChevronRight, Plus } from "lucide-react";
import { Link } from "react-router-dom";
import { DriverShell } from "./DriverShell";

const routes = [
  { id: "route-1", name: "Fourways to Crawford", direction: "Morning", time: "07:15", learners: 9, pending: 2 },
  { id: "route-2", name: "Crawford to Fourways", direction: "Afternoon", time: "14:30", learners: 9, pending: 0 },
];

export function RouteList() {
  return (
    <DriverShell title="Routes">
      <div className="driver-toolbar"><p>Manage your routes and learner rosters.</p><Link className="icon-text-button filled" to="/driver/routes/new"><Plus size={18} />New route</Link></div>
      <section className="route-list" aria-label="Active routes">
        {routes.map((route) => (
          <Link className="route-list-card" key={route.id} to={`/driver/routes/${route.id}`}>
            <div className="route-list-icon"><BusFront size={22} /></div>
            <div className="route-list-copy"><div><span className="direction-chip">{route.direction}</span>{route.pending > 0 && <span className="pending-chip">{route.pending} pending</span>}</div><h2>{route.name}</h2><p>{route.time} · CA 123-456 · {route.learners} learners</p></div>
            <ChevronRight size={20} />
          </Link>
        ))}
      </section>
      <section className="inactive-section"><h2>Inactive routes</h2><p>No inactive routes.</p></section>
    </DriverShell>
  );
}
