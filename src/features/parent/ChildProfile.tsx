import { Archive, ArrowLeft, Save, ShieldCheck } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { z } from "zod";
import { supabase } from "../../lib/supabase";
import { Field } from "../auth/ui";
import { normalizeSouthAfricanPhone } from "../auth/validation";
import { ParentShell } from "./ParentShell";

const childSchema = z.object({
  full_name: z.string().trim().min(2, "Enter the child's full name").max(100),
  school_name: z.string().trim().min(2, "Enter the school name").max(100),
  grade: z.string().refine((value) => ["R", ...Array.from({ length: 12 }, (_, index) => String(index + 1))].includes(value), "Select a grade"),
  home_address: z.string().trim().min(5, "Enter the home address").max(250),
  school_address: z.string().trim().min(5, "Enter the school address").max(250),
  emergency_contact_name: z.string().trim().min(2, "Enter the contact name").max(100),
  emergency_contact_relationship: z.string().trim().min(2, "Enter the relationship").max(50),
  emergency_contact_phone: z.string().refine((value) => /^(?:0|\+27)[6-8]\d{8}$/.test(value.replace(/[\s-]/g, "")), "Enter a valid South African mobile number"),
  medical_notes: z.string().max(1000),
  allergy_notes: z.string().max(1000),
});

type ChildValues = z.infer<typeof childSchema>;
type ChildErrors = Partial<Record<keyof ChildValues, string>>;
const emptyChild: ChildValues = {
  full_name: "", school_name: "", grade: "", home_address: "", school_address: "",
  emergency_contact_name: "", emergency_contact_relationship: "", emergency_contact_phone: "",
  medical_notes: "", allergy_notes: "",
};

export function ChildProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [values, setValues] = useState<ChildValues>(emptyChild);
  const [errors, setErrors] = useState<ChildErrors>({});
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(Boolean(id));
  const [saving, setSaving] = useState(false);
  const [confirmArchive, setConfirmArchive] = useState(false);

  useEffect(() => {
    if (!id) return;
    let active = true;
    async function loadChild() {
      if (!supabase) {
        if (active) { setMessage("The service is not configured."); setLoading(false); }
        return;
      }
      const { data, error } = await supabase.from("learners")
        .select("full_name,school_name,grade,home_address,school_address,emergency_contact_name,emergency_contact_relationship,emergency_contact_phone,medical_notes,allergy_notes")
        .eq("id", id).eq("is_active", true).maybeSingle();
      if (!active) return;
      if (error || !data) setMessage("Could not load this child profile.");
      else setValues({ ...data, medical_notes: data.medical_notes ?? "", allergy_notes: data.allergy_notes ?? "" });
      setLoading(false);
    }
    void loadChild();
    return () => { active = false; };
  }, [id]);

  function update(key: keyof ChildValues, value: string) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = childSchema.safeParse(values);
    if (!result.success) {
      const next: ChildErrors = {};
      for (const issue of result.error.issues) {
        const key = issue.path[0] as keyof ChildValues;
        if (!next[key]) next[key] = issue.message;
      }
      setErrors(next);
      return;
    }
    if (!supabase) { setMessage("The service is not configured."); return; }
    setSaving(true);
    setMessage("");
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) { setSaving(false); setMessage("Please log in to save a child profile."); return; }
    const child = { ...result.data, emergency_contact_phone: normalizeSouthAfricanPhone(result.data.emergency_contact_phone) };
    const query = id
      ? supabase.from("learners").update(child).eq("id", id).select("id").maybeSingle()
      : supabase.from("learners").insert({ ...child, parent_id: authData.user.id }).select("id").maybeSingle();
    const { data, error } = await query;
    setSaving(false);
    if (error || !data) { setMessage("Could not save this child profile. Please try again."); return; }
    navigate("/parent/children");
  }

  async function archive() {
    if (!supabase || !id) return;
    setSaving(true);
    const { data, error } = await supabase.from("learners").update({ is_active: false }).eq("id", id).select("id").maybeSingle();
    setSaving(false);
    setConfirmArchive(false);
    if (error || !data) { setMessage("Could not archive this child profile. Please try again."); return; }
    navigate("/parent/children");
  }

  return (
    <ParentShell title={id ? "Edit child" : "Add child"}>
      <Link className="back-link" to="/parent/children"><ArrowLeft size={18} />Back to children</Link>
      {loading ? <p role="status">Loading child profile...</p> : <form className="child-form card form-stack" noValidate onSubmit={submit}>
        <div className="child-form-grid">
          <Field id="child-name" label="Child full name" value={values.full_name} onChange={(event) => update("full_name", event.target.value)} error={errors.full_name} />
          <Field id="school-name" label="School name" value={values.school_name} onChange={(event) => update("school_name", event.target.value)} error={errors.school_name} />
          <div><label className="field-label" htmlFor="child-grade">Grade</label><select id="child-grade" className="input" value={values.grade} onChange={(event) => update("grade", event.target.value)} aria-invalid={Boolean(errors.grade)}><option value="">Select grade</option>{["R", ...Array.from({ length: 12 }, (_, index) => String(index + 1))].map((grade) => <option key={grade} value={grade}>Grade {grade}</option>)}</select>{errors.grade && <p className="field-error" role="alert">{errors.grade}</p>}</div>
        </div>
        <div className="child-form-grid"><Field id="home-address" label="Home address" value={values.home_address} onChange={(event) => update("home_address", event.target.value)} error={errors.home_address} /><Field id="school-address" label="School address" value={values.school_address} onChange={(event) => update("school_address", event.target.value)} error={errors.school_address} /></div>
        <fieldset className="emergency-section"><legend className="field-label">Emergency contact</legend><div className="child-form-grid"><Field id="emergency-name" label="Contact name" value={values.emergency_contact_name} onChange={(event) => update("emergency_contact_name", event.target.value)} error={errors.emergency_contact_name} /><Field id="emergency-relation" label="Relationship" value={values.emergency_contact_relationship} onChange={(event) => update("emergency_contact_relationship", event.target.value)} error={errors.emergency_contact_relationship} /><Field id="emergency-phone" label="Phone number" type="tel" value={values.emergency_contact_phone} onChange={(event) => update("emergency_contact_phone", event.target.value)} error={errors.emergency_contact_phone} /></div></fieldset>
        <div className="notes-grid"><label className="field-block"><span className="field-label">Medical notes <small>{values.medical_notes.length}/1000</small></span><textarea className="input child-note" maxLength={1000} value={values.medical_notes} onChange={(event) => update("medical_notes", event.target.value)} /></label><label className="field-block"><span className="field-label">Allergy notes <small>{values.allergy_notes.length}/1000</small></span><textarea className="input child-note" maxLength={1000} value={values.allergy_notes} onChange={(event) => update("allergy_notes", event.target.value)} /></label></div>
        <p className="privacy-helper"><ShieldCheck size={18} />Only the child&apos;s approved driver can see these details.</p>
        <div className="child-form-actions"><button className="primary-button" type="submit" disabled={saving}><Save size={18} />{saving ? "Saving..." : "Save child"}</button>{id && <button type="button" className="delete-button" onClick={() => setConfirmArchive(true)} disabled={saving}><Archive size={18} />Archive child</button>}</div>
        {message && <p className="form-message" role="alert">{message}</p>}
      </form>}
      {confirmArchive && <div className="confirm-panel" role="alertdialog" aria-modal="true" aria-labelledby="archive-title"><h2 id="archive-title">Archive this child?</h2><p>Archiving will remove active and pending route links.</p><div><button type="button" className="secondary-button" onClick={() => setConfirmArchive(false)}>Cancel</button><button type="button" className="delete-button" onClick={archive} disabled={saving}>Archive</button></div></div>}
    </ParentShell>
  );
}
