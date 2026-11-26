import { BusFront, ChevronRight, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { DriverShell } from "./DriverShell";

type DriverRoute = { id: string; name: string; direction: "morning" | "afternoon"; departure_time: string; vehicle_id: string; is_active: boolean };
type Vehicle = { id: string; registration_number: string };
type Enrollment = { route_id: string; status: string };

export function RouteList() {
  const [routes, setRoutes] = useState<DriverRoute[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setError("");
      if (!supabase) { if (active) { setError("The service is not configured."); setLoading(false); } return; }
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (!active) return;
      if (authError || !authData.user) { setError("Please log in to view your routes."); setLoading(false); return; }
      const [routeResult, vehicleResult, enrollmentResult] = await Promise.all([
        supabase.from("routes").select("id,name,direction,departure_time,vehicle_id,is_active").order("departure_time"),
        supabase.from("vehicles").select("id,registration_number"),
        supabase.from("route_enrollments").select("route_id,status"),
      ]);
      if (!active) return;
      if (routeResult.error || vehicleResult.error || enrollmentResult.error) setError("Could not load routes. Please try again.");
      else { setRoutes(routeResult.data ?? []); setVehicles(vehicleResult.data ?? []); setEnrollments(enrollmentResult.data ?? []); }
      setLoading(false);
    }
    void load();
    return () => { active = false; };
  }, [retry]);

  function routeCard(route: DriverRoute) {
    const activeCount = enrollments.filter((entry) => entry.route_id === route.id && entry.status === "active").length;
    const pendingCount = enrollments.filter((entry) => entry.route_id === route.id && entry.status === "pending").length;
    const registration = vehicles.find((vehicle) => vehicle.id === route.vehicle_id)?.registration_number ?? "Vehicle unavailable";
    return (
      <Link className="route-list-card" key={route.id} to={`/driver/routes/${route.id}`}>
        <div className="route-list-icon"><BusFront size={22} /></div>
        <div className="route-list-copy"><div><span className="direction-chip">{route.direction === "morning" ? "Morning" : "Afternoon"}</span>{pendingCount > 0 && <span className="pending-chip">{pendingCount} pending</span>}</div><h2>{route.name}</h2><p>{route.departure_time.slice(0, 5)} · {registration} · {activeCount} learners</p></div>
        <ChevronRight size={20} />
      </Link>
    );
  }

  return (
    <DriverShell title="Routes">
      <div className="driver-toolbar"><p>Manage your routes and learner rosters.</p><Link className="icon-text-button filled" to="/driver/routes/new"><Plus size={18} />New route</Link></div>
      {loading && <p role="status">Loading routes...</p>}
      {error && <div role="alert"><p>{error}</p><button className="text-button" type="button" onClick={() => setRetry((current) => current + 1)}>Retry</button></div>}
      {!loading && !error && <><section className="route-list" aria-label="Active routes">{routes.filter((route) => route.is_active).map(routeCard)}{!routes.some((route) => route.is_active) && <p>No active routes yet.</p>}</section>
      <section className="inactive-section"><h2>Inactive routes</h2><div className="route-list">{routes.filter((route) => !route.is_active).map(routeCard)}</div>{!routes.some((route) => !route.is_active) && <p>No inactive routes.</p>}</section></>}
    </DriverShell>
  );
}
