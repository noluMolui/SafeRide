import { ArrowRight, Plus, Route } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { ParentShell } from "./ParentShell";

type Child = { id: string; full_name: string; school_name: string; grade: string };
type Enrollment = { learner_id: string; direction: "morning" | "afternoon"; status: "pending" | "active" | "removed" };

export function ChildrenList() {
  const [children, setChildren] = useState<Child[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setError("");
      if (!supabase) {
        if (active) { setError("The service is not configured."); setLoading(false); }
        return;
      }
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (!active) return;
      if (authError || !authData.user) { setError("Please log in to view your children."); setLoading(false); return; }
      const [childResult, enrollmentResult] = await Promise.all([
        supabase.from("learners").select("id,full_name,school_name,grade").eq("is_active", true).order("full_name"),
        supabase.from("route_enrollments").select("learner_id,direction,status"),
      ]);
      if (!active) return;
      if (childResult.error || enrollmentResult.error) setError("Could not load your children. Please try again.");
      else { setChildren(childResult.data ?? []); setEnrollments(enrollmentResult.data ?? []); }
      setLoading(false);
    }
    void load();
    return () => { active = false; };
  }, [retry]);

  return (
    <ParentShell title="My children">
      <div className="parent-toolbar"><p>Manage profiles and route links.</p><Link className="icon-text-button filled" to="/parent/children/new"><Plus size={18} />Add child</Link></div>
      {loading && <p role="status">Loading children...</p>}
      {error && <div role="alert"><p>{error}</p><button type="button" className="text-button" onClick={() => setRetry((current) => current + 1)}>Retry</button></div>}
      {!loading && !error && children.length === 0 && <p>No children yet. Add a child to get started.</p>}
      {!loading && !error && <section className="children-list">
        {children.map((child) => <article className="child-list-card" key={child.id}><div className="child-list-header"><div className="learner-avatar">{child.full_name.charAt(0)}</div><div><h2>{child.full_name}</h2><p>{child.school_name} · Grade {child.grade}</p></div><Link className="secondary-button small-secondary" to={`/parent/children/${child.id}/edit`}>Edit</Link></div>
          <div className="enrollment-list">{(["morning", "afternoon"] as const).map((direction) => {
            const enrollment = enrollments.find((entry) => entry.learner_id === child.id && entry.direction === direction && entry.status !== "removed");
            return <div key={direction}><span className={`direction-chip ${direction}`}>{direction === "morning" ? "Morning" : "Afternoon"}</span><p><strong>{enrollment?.status === "active" ? "Active" : enrollment?.status === "pending" ? "Pending approval" : "Not linked"}</strong></p></div>;
          })}</div>
        </article>)}
      </section>}
      <Link className="link-driver-banner" to="/parent/link"><span><Route size={20} /></span><div><strong>Link another route</strong><p>Enter a driver's 8-character invite code</p></div><ArrowRight size={20} /></Link>
    </ParentShell>
  );
}
