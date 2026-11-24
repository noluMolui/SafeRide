import { Archive, ArrowLeft, Save, ShieldCheck } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { Field } from "../auth/ui";
import { ParentShell } from "./ParentShell";

export function ChildProfile() {
  const { id } = useParams();
  const editing = Boolean(id);
  const [medical, setMedical] = useState("");
  const [allergies, setAllergies] = useState("");
  const [message, setMessage] = useState("");
  const [confirmArchive, setConfirmArchive] = useState(false);

  function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setMessage("Child profile saved in this frontend preview."); }

  return (
    <ParentShell title={editing ? "Edit child" : "Add child"}>
      <Link className="back-link" to="/parent/children"><ArrowLeft size={18} />Back to children</Link>
      <form className="child-form card form-stack" onSubmit={submit}>
        <div className="child-form-grid"><Field id="child-name" label="Child full name" defaultValue={editing ? "Lethabo Mokoena" : ""} placeholder="Full name" /><Field id="school-name" label="School name" defaultValue={editing ? "Crawford International" : ""} placeholder="School name" /><label className="field-block"><span className="field-label">Grade</span><select className="input" defaultValue={editing ? "6" : ""}><option value="" disabled>Select grade</option>{[...Array.from({ length: 12 }, (_, index) => index + 1), "R"].map((grade) => <option key={grade} value={grade}>Grade {grade}</option>)}</select></label></div>
        <div className="child-form-grid"><Field id="home-address" label="Home address" defaultValue={editing ? "12 Cedar Road, Fourways" : ""} /><Field id="school-address" label="School address" defaultValue={editing ? "Crawford, Sandton" : ""} /></div>
        <fieldset className="emergency-section"><legend className="field-label">Emergency contact</legend><div className="child-form-grid"><Field id="emergency-name" label="Contact name" defaultValue={editing ? "Naledi Mokoena" : ""} /><Field id="emergency-relation" label="Relationship" defaultValue={editing ? "Parent" : ""} /><Field id="emergency-phone" label="Phone number" type="tel" defaultValue={editing ? "082 123 4567" : ""} /></div></fieldset>
        <div className="notes-grid"><label className="field-block"><span className="field-label">Medical notes <small>{medical.length}/1000</small></span><textarea className="input child-note" maxLength={1000} value={medical} onChange={(event) => setMedical(event.target.value)} placeholder="Conditions or care instructions" /></label><label className="field-block"><span className="field-label">Allergy notes <small>{allergies.length}/1000</small></span><textarea className="input child-note" maxLength={1000} value={allergies} onChange={(event) => setAllergies(event.target.value)} placeholder="Known allergies" /></label></div>
        <p className="privacy-helper"><ShieldCheck size={18} />Only the child&apos;s approved driver can see these details.</p>
        <div className="child-form-actions"><button className="primary-button" type="submit"><Save size={18} />Save child</button>{editing && <button type="button" className="delete-button" onClick={() => setConfirmArchive(true)}><Archive size={18} />Archive child</button>}</div>
        {message && <p className="form-message" role="status">{message}</p>}
      </form>
      {confirmArchive && <div className="confirm-panel" role="alertdialog"><h2>Archive this child?</h2><p>Archiving will remove active and pending route links.</p><div><button type="button" className="secondary-button" onClick={() => setConfirmArchive(false)}>Cancel</button><button type="button" className="delete-button" onClick={() => setConfirmArchive(false)}>Archive</button></div></div>}
    </ParentShell>
  );
}
