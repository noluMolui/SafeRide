import { ArrowLeft, Save } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { Field } from "../auth/ui";
import { DriverShell } from "./DriverShell";

export function RouteForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [direction, setDirection] = useState<"morning" | "afternoon">("morning");
  const [name, setName] = useState("");
  const [vehicleId, setVehicleId] = useState("");
  const [departureTime, setDepartureTime] = useState("");
  const [vehicles, setVehicles] = useState<{ id: string; registration_number: string; make_model: string; seating_capacity: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [days, setDays] = useState([1, 2, 3, 4, 5]);

  useEffect(() => {
    let active = true;
    async function load() {
      if (!supabase) { if (active) { setMessage("The service is not configured."); setLoading(false); } return; }
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (!active) return;
      if (authError || !authData.user) { setMessage("Please log in to manage routes."); setLoading(false); return; }
      const { data, error } = await supabase.from("vehicles").select("id,registration_number,make_model,seating_capacity").eq("is_active", true);
      if (!active) return;
      if (error) { setMessage("Could not load vehicles. Please try again."); setLoading(false); return; }
      setVehicles(data ?? []);
      if (id) {
        const { data: route, error: routeError } = await supabase.from("routes").select("name,direction,vehicle_id,departure_time,days_of_week").eq("id", id).maybeSingle();
        if (!active) return;
        if (routeError || !route) setMessage("Could not load this route.");
        else { setName(route.name); setDirection(route.direction); setVehicleId(route.vehicle_id); setDepartureTime(route.departure_time.slice(0, 5)); setDays(route.days_of_week); }
      } else if (data?.length === 1) setVehicleId(data[0]!.id);
      setLoading(false);
    }
    void load();
    return () => { active = false; };
  }, [id]);

  function toggleDay(day: number) {
    setDays((current) => current.includes(day) ? current.filter((item) => item !== day) : [...current, day]);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (name.trim().length < 2 || name.trim().length > 60 || !vehicleId || !departureTime || days.length === 0) {
      setMessage("Enter a route name, select a vehicle and departure time, and choose at least one day.");
      return;
    }
    if (!supabase) { setMessage("The service is not configured."); return; }
    setSaving(true);
    setMessage("");
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) { setSaving(false); setMessage("Please log in to manage routes."); return; }
    const route = { name: name.trim(), direction, vehicle_id: vehicleId, departure_time: departureTime, days_of_week: [...days].sort() };
    const query = id
      ? supabase.from("routes").update(route).eq("id", id).select("id").maybeSingle()
      : supabase.from("routes").insert({ ...route, driver_id: authData.user.id }).select("id").maybeSingle();
    const { data, error } = await query;
    setSaving(false);
    if (error || !data) { setMessage("Could not save this route. Check the details and try again."); return; }
    navigate("/driver/routes");
  }

  return (
    <DriverShell title={id ? "Edit route" : "New route"}>
      <Link className="back-link" to="/driver/routes"><ArrowLeft size={18} />Back to routes</Link>
      {loading ? <p role="status">Loading vehicles...</p> : <form className="route-form card form-stack" noValidate onSubmit={submit}>
        <Field id="route-name" label="Route name" placeholder="e.g. Fourways to Crawford" maxLength={60} value={name} onChange={(event) => setName(event.target.value)} />
        <fieldset><legend className="field-label">Direction</legend><div className="segmented"><button type="button" className={direction === "morning" ? "active" : ""} onClick={() => setDirection("morning")}>Morning</button><button type="button" className={direction === "afternoon" ? "active" : ""} onClick={() => setDirection("afternoon")}>Afternoon</button></div></fieldset>
        <label className="field-block"><span className="field-label">Vehicle</span><select className="input" value={vehicleId} onChange={(event) => setVehicleId(event.target.value)}><option value="">Select a vehicle</option>{vehicles.map((vehicle) => <option key={vehicle.id} value={vehicle.id}>{vehicle.registration_number} · {vehicle.make_model} · {vehicle.seating_capacity} seats</option>)}</select></label>
        {vehicles.length === 0 && <p>No active vehicles. Add a vehicle in your profile first.</p>}
        <Field id="departure-time" label="Departure time" type="time" value={departureTime} onChange={(event) => setDepartureTime(event.target.value)} />
        <fieldset><legend className="field-label">Operating days</legend><div className="day-grid">{["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day, index) => <button type="button" key={day} className={days.includes(index + 1) ? "active" : ""} aria-pressed={days.includes(index + 1)} onClick={() => toggleDay(index + 1)}>{day}</button>)}</div></fieldset>
        <button className="primary-button" type="submit" disabled={saving}><Save size={19} />{saving ? "Saving..." : "Save route"}</button>
        {message && <p className="form-message" role="alert">{message}</p>}
      </form>}
    </DriverShell>
  );
}
