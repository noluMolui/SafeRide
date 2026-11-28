import {
  AlertTriangle,
  CheckCircle2,
  FileUp,
  LogOut,
  Trash2,
  Upload,
} from "lucide-react";
import { useEffect, useState, type ChangeEvent } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { southAfricaToday, fileError } from "../auth/validation";
import { DriverShell } from "./DriverShell";
import { AccountDeletionDialog } from "../auth/AccountDeletionDialog";

type Profile = {
  id: string;
  full_name: string;
  phone_e164: string;
  business_name: string | null;
  pdp_number: string | null;
  pdp_expiry_date: string | null;
  pdp_document_path: string | null;
  pdp_verification: string;
  pdp_verification_note: string | null;
  service_suburbs: string[];
};
type Vehicle = {
  id: string;
  registration_number: string;
  make_model: string;
  seating_capacity: number;
  roadworthy_expiry_date: string;
  roadworthy_document_path: string | null;
  roadworthy_verification: string;
  roadworthy_verification_note: string | null;
  is_active: boolean;
};

export function ComplianceProfile() {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setMessage("");
      if (!supabase) {
        if (active) {
          setMessage("The service is not configured.");
          setLoading(false);
        }
        return;
      }
      const { data: authData, error: authError } =
        await supabase.auth.getUser();
      if (!active) return;
      if (authError || !authData.user) {
        setMessage("Please log in to view your compliance profile.");
        setLoading(false);
        return;
      }
      const [profileResult, vehicleResult] = await Promise.all([
        supabase
          .from("profiles")
          .select(
            "id,full_name,phone_e164,business_name,pdp_number,pdp_expiry_date,pdp_document_path,pdp_verification,pdp_verification_note,service_suburbs",
          )
          .eq("id", authData.user.id)
          .maybeSingle(),
        supabase
          .from("vehicles")
          .select(
            "id,registration_number,make_model,seating_capacity,roadworthy_expiry_date,roadworthy_document_path,roadworthy_verification,roadworthy_verification_note,is_active",
          )
          .eq("driver_id", authData.user.id),
      ]);
      if (!active) return;
      if (profileResult.error || !profileResult.data || vehicleResult.error)
        setMessage("Could not load compliance details.");
      else {
        setProfile(profileResult.data as Profile);
        setVehicles(vehicleResult.data ?? []);
      }
      setLoading(false);
    }
    void load();
    return () => {
      active = false;
    };
  }, [retry]);

  function expiryLabel(date: string | null) {
    if (!date) return "Not provided";
    return `${date < southAfricaToday() ? "Expired" : "Valid"} · ${date}`;
  }

  async function uploadDocument(
    event: ChangeEvent<HTMLInputElement>,
    kind: "pdp" | "roadworthy",
    vehicleId?: string,
  ) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !supabase) return;
    const problem = fileError(file);
    if (problem) {
      setMessage(problem);
      return;
    }
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) {
      setMessage("Please log in to upload a document.");
      return;
    }
    const extension = file.name.split(".").pop()?.toLowerCase() || "bin";
    const path = `${authData.user.id}/${kind}/${crypto.randomUUID()}.${extension}`;
    setBusy(true);
    setMessage("");
    const { error: uploadError } = await supabase.storage
      .from("compliance-docs")
      .upload(path, file, { contentType: file.type, upsert: false });
    if (uploadError) {
      setBusy(false);
      setMessage("Could not upload the document. Please try again.");
      return;
    }
    const result =
      kind === "pdp"
        ? await supabase
            .from("profiles")
            .update({ pdp_document_path: path })
            .eq("id", authData.user.id)
            .select("id")
            .maybeSingle()
        : await supabase
            .from("vehicles")
            .update({ roadworthy_document_path: path })
            .eq("id", vehicleId!)
            .select("id")
            .maybeSingle();
    setBusy(false);
    if (result.error || !result.data) {
      setMessage("Uploaded, but could not save the document reference.");
      return;
    }
    setMessage(
      "Document uploaded. Verification is now unverified until reviewed.",
    );
    setRetry((current) => current + 1);
  }

  return (
    <DriverShell title="Profile & compliance">
      {loading && <p role="status">Loading compliance profile…</p>}
      {message && (
        <div role="alert" className="form-message">
          {message}
          {!profile && (
            <button
              className="text-button"
              type="button"
              onClick={() => setRetry((current) => current + 1)}
            >
              Retry
            </button>
          )}
        </div>
      )}
      {!loading && profile && (
        <>
          {vehicles.some(
            (vehicle) => vehicle.roadworthy_expiry_date < southAfricaToday(),
          ) && (
            <section className="profile-banner">
              <AlertTriangle size={20} />
              <p>
                <strong>Roadworthy expired</strong>
                <span>
                  Renew your vehicle documents before starting another trip.
                </span>
              </p>
            </section>
          )}
          <section className="profile-grid">
            <article className="profile-card">
              <div className="profile-card-heading">
                <div>
                  <span>Professional Driving Permit</span>
                  <h2>{profile.pdp_number || "Not provided"}</h2>
                </div>
                <span
                  className={
                    profile.pdp_verification === "verified"
                      ? "verified-badge"
                      : "warning-badge"
                  }
                >
                  <CheckCircle2 size={16} />
                  {profile.pdp_verification}
                </span>
              </div>
              <div className="profile-facts">
                <p>
                  <span>Expiry</span>
                  <strong>{expiryLabel(profile.pdp_expiry_date)}</strong>
                </p>
                <p>
                  <span>Review note</span>
                  <strong>{profile.pdp_verification_note || "No note"}</strong>
                </p>
              </div>
              <label className="secondary-button">
                <Upload size={18} />
                {busy
                  ? "Uploading…"
                  : profile.pdp_document_path
                    ? "Replace document"
                    : "Upload document"}
                <input
                  className="sr-only"
                  type="file"
                  accept=".jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf"
                  onChange={(event) => uploadDocument(event, "pdp")}
                  disabled={busy}
                />
              </label>
            </article>
            {vehicles.map((vehicle) => (
              <article className="profile-card" key={vehicle.id}>
                <div className="profile-card-heading">
                  <div>
                    <span>Vehicle</span>
                    <h2>{vehicle.registration_number}</h2>
                  </div>
                  <span
                    className={
                      vehicle.roadworthy_verification === "verified"
                        ? "verified-badge"
                        : "warning-badge"
                    }
                  >
                    <AlertTriangle size={16} />
                    {vehicle.roadworthy_verification}
                  </span>
                </div>
                <p className="vehicle-name">
                  {vehicle.make_model} · {vehicle.seating_capacity} seats
                </p>
                <div className="profile-facts">
                  <p>
                    <span>Roadworthy expiry</span>
                    <strong>
                      {expiryLabel(vehicle.roadworthy_expiry_date)}
                    </strong>
                  </p>
                  <p>
                    <span>Review note</span>
                    <strong>
                      {vehicle.roadworthy_verification_note || "No note"}
                    </strong>
                  </p>
                </div>
                <label className="secondary-button">
                  <FileUp size={18} />
                  {busy
                    ? "Uploading…"
                    : vehicle.roadworthy_document_path
                      ? "Replace certificate"
                      : "Upload certificate"}
                  <input
                    className="sr-only"
                    type="file"
                    accept=".jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf"
                    onChange={(event) =>
                      uploadDocument(event, "roadworthy", vehicle.id)
                    }
                    disabled={busy}
                  />
                </label>
              </article>
            ))}
          </section>
          {vehicles.length === 0 && <p>No vehicles registered.</p>}
          <section className="settings-card">
            <h2>Service details</h2>
            <div className="settings-grid">
              <p>
                <span>Service suburbs</span>
                <strong>
                  {profile.service_suburbs.join(", ") || "Not provided"}
                </strong>
              </p>
              <p>
                <span>Contact</span>
                <strong>
                  {profile.full_name} · {profile.phone_e164}
                </strong>
              </p>
            </div>
          </section>
          <section className="danger-zone">
            <div>
              <h2>Account actions</h2>
              <p>
                Deleting your account permanently removes its associated
                information.
              </p>
            </div>
            <div className="danger-actions">
              <Link className="secondary-button" to="/login">
                <LogOut size={18} />
                Log out
              </Link>
              <button
                type="button"
                className="delete-button"
                onClick={() => setConfirmDelete(true)}
              >
                <Trash2 size={18} />
                Delete account
              </button>
            </div>
          </section>
          {confirmDelete && (
            <AccountDeletionDialog
              onCancel={() => setConfirmDelete(false)}
              onDeleted={() => window.location.assign("/login")}
            />
          )}
        </>
      )}
    </DriverShell>
  );
}
