import { AlertTriangle, ArrowRight, BusFront, CheckCircle2, Clock3, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { southAfricaToday } from "../auth/validation";
import { DriverShell } from "./DriverShell";

type DriverRoute = { id: string; name: string; direction: "morning" | "afternoon"; departure_time: string; days_of_week: number[]; vehicle_id: string };
type DriverVehicle = { id: string; registration_number: string; roadworthy_expiry_date: string; is_active: boolean };
type Enrollment = { route_id: string; status: string };
type ActiveTrip = { id: string; route_id: string };

export function DriverDashboard() {
  const navigate = useNavigate();
  const [name, setName] = useState("Driver");
  const [pdpExpiry, setPdpExpiry] = useState("");
  const [routes, setRoutes] = useState<DriverRoute[]>([]);
  const [vehicles, setVehicles] = useState<DriverVehicle[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [activeTrip, setActiveTrip] = useState<ActiveTrip | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [version, setVersion] = useState(0);
  const today = southAfricaToday();
  const weekday = new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: "Africa/Johannesburg" }).format(new Date());
  const dayNumber = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(weekday) + 1;

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setError("");
      if (!supabase) { if (active) { setError("The service is not configured."); setLoading(false); } return; }
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (!active) return;
      if (authError || !authData.user) { setError("Please log in to view your dashboard."); setLoading(false); return; }
      const [profileResult, routeResult, vehicleResult, enrollmentResult, tripResult] = await Promise.all([
        supabase.from("profiles").select("full_name,pdp_expiry_date").eq("id", authData.user.id).maybeSingle(),
        supabase.from("routes").select("id,name,direction,departure_time,days_of_week,vehicle_id").eq("is_active", true).order("departure_time"),
        supabase.from("vehicles").select("id,registration_number,roadworthy_expiry_date,is_active"),
        supabase.from("route_enrollments").select("route_id,status"),
        supabase.from("trips").select("id,route_id").eq("status", "active").maybeSingle(),
      ]);
      if (!active) return;
      if (profileResult.error || !profileResult.data || routeResult.error || vehicleResult.error || enrollmentResult.error || tripResult.error) {
        setError("Could not load your dashboard. Please try again."); setLoading(false); return;
      }
      setName(profileResult.data.full_name.split(" ")[0] || "Driver");
      setPdpExpiry(profileResult.data.pdp_expiry_date ?? "");
      setRoutes(routeResult.data ?? []);
      setVehicles(vehicleResult.data ?? []);
      setEnrollments(enrollmentResult.data ?? []);
      setActiveTrip(tripResult.data);
      setLoading(false);
    }
    void load();
    return () => { active = false; };
  }, [version]);

  async function startTrip(routeId: string) {
    if (!supabase) return;
    setBusy(true);
    setError("");
    const { data, error: startError } = await supabase.rpc("start_trip", { route_id: routeId });
    setBusy(false);
    if (startError || !data) { setError("Could not start this trip. Check compliance and your roster, then try again."); return; }
    navigate(`/driver/trip/${data}`);
  }

  const scheduledRoutes = routes.filter((route) => route.days_of_week.includes(dayNumber));
  const pendingCount = enrollments.filter((entry) => entry.status === "pending").length;

  return (
    <DriverShell title={`Hello, ${name}`}>
      <section className="driver-date"><span>{new Intl.DateTimeFormat("en-ZA", { dateStyle: "full", timeZone: "Africa/Johannesburg" }).format(new Date())}</span></section>
      {loading && <p role="status">Loading dashboard...</p>}
      {error && <div role="alert"><p>{error}</p><button className="text-button" type="button" onClick={() => setVersion((current) => current + 1)}>Retry</button></div>}
      {!loading && !error && <>
      <section className="compliance-strip">
        <div><span className={pdpExpiry && pdpExpiry >= today ? "compliance-icon" : "compliance-icon warning"}>{pdpExpiry && pdpExpiry >= today ? <CheckCircle2 size={20} /> : <AlertTriangle size={20} />}</span><p><strong>PrDP</strong><span>{pdpExpiry ? `${pdpExpiry >= today ? "Valid" : "Expired"} · ${pdpExpiry}` : "Not available"}</span></p></div>
        <div><span className="compliance-icon"><BusFront size={20} /></span><p><strong>Vehicles</strong><span>{vehicles.filter((vehicle) => vehicle.is_active).length} active</span></p></div>
        <Link to="/driver/profile" aria-label="View compliance profile"><ArrowRight size={20} /></Link>
      </section>
      <section className="driver-section-heading"><div><p>Today&apos;s routes</p><span>{scheduledRoutes.length} routes scheduled</span></div><Link className="icon-text-button" to="/driver/routes/new"><Plus size={18} />New route</Link></section>
      <div className="route-card-grid">
        {scheduledRoutes.map((route) => {
          const vehicle = vehicles.find((entry) => entry.id === route.vehicle_id);
          const learnerCount = enrollments.filter((entry) => entry.route_id === route.id && entry.status === "active").length;
          const blocked = !pdpExpiry || pdpExpiry < today || !vehicle?.is_active || vehicle.roadworthy_expiry_date < today || learnerCount === 0 || Boolean(activeTrip);
          return <article className="route-card" key={route.id}><div className="route-card-top"><span className={`direction-chip ${route.direction}`}>{route.direction === "morning" ? "Morning" : "Afternoon"}</span><span>{route.departure_time.slice(0, 5)}</span></div><h2>{route.name}</h2><div className="route-card-meta"><span><BusFront size={17} />{learnerCount} learners</span><span>{vehicle?.registration_number ?? "Vehicle unavailable"}</span></div>{activeTrip?.route_id === route.id ? <Link className="primary-button" to={`/driver/trip/${activeTrip.id}`}>Resume trip <ArrowRight size={19} /></Link> : <button className="primary-button" type="button" onClick={() => startTrip(route.id)} disabled={busy || blocked}>Start trip <ArrowRight size={19} /></button>}{blocked && !activeTrip && <p>Check your compliance, vehicle, and active roster before starting.</p>}</article>;
        })}
      </div>
      {scheduledRoutes.length === 0 && <p>{routes.length ? "No trips scheduled today." : "No routes yet. Create your first route."}</p>}
      {activeTrip && !scheduledRoutes.some((route) => route.id === activeTrip.route_id) && <Link className="primary-button" to={`/driver/trip/${activeTrip.id}`}>Resume active trip</Link>}
      <section className="dashboard-requests"><div><span className="request-icon"><Clock3 size={20} /></span><p><strong>{pendingCount} pending requests</strong><span>Waiting for your approval</span></p></div><Link to="/driver/routes">Review <ArrowRight size={18} /></Link></section>
      </>}
    </DriverShell>
  );
}
