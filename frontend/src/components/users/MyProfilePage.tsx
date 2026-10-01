import { useEffect, useState } from "react";
import { meApi } from "../../api/me";
import { ApiError } from "../../api/client";
import type { CustomerUpdate } from "../../types/customer";
import type { Me } from "../../types/me";
import { Toast, type ToastMessage } from "../ui/Toast";
import { isValidEmail } from "../../utils/validation";

interface Props {
  me: Me;
  onProfileUpdated: (next: { name: string; email: string; address: string }) => void;
}

export function MyProfilePage({ me, onProfileUpdated }: Props) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(me.name);
  const [email, setEmail] = useState(me.email);
  const [address, setAddress] = useState(me.address);
  const [password, setPassword] = useState("");
  const [touched, setTouched] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorDetail, setErrorDetail] = useState<string | undefined>(undefined);
  const [toast, setToast] = useState<ToastMessage | null>(null);

  useEffect(() => {
    if (!editing) {
      setName(me.name);
      setEmail(me.email);
      setAddress(me.address);
      setPassword("");
      setTouched(false);
      setErrorDetail(undefined);
    }
  }, [editing, me]);

  const nameErr = name.trim() === "" ? "Required." : "";
  const emailErr = email.trim() === "" ? "Required." : !isValidEmail(email.trim()) ? "Must be a valid email." : "";
  const addressErr = address.trim() === "" ? "Required." : "";
  const passwordInvalid = password.length < 8 || /^[A-Za-z0-9]*$/.test(password);
  const passwordErr = password !== "" && passwordInvalid ? "At least 8 characters, including one special character." : "";
  const anyErr = nameErr || emailErr || addressErr || passwordErr;

  async function handleSave() {
    setTouched(true);
    if (anyErr) return;
    const patch: CustomerUpdate = {};
    if (name.trim() !== me.name) patch.name = name.trim();
    if (email.trim() !== me.email) patch.email = email.trim();
    if (address.trim() !== me.address) patch.address = address.trim();
    if (password !== "") patch.password = password;

    if (Object.keys(patch).length === 0) {
      setEditing(false);
      return;
    }

    setSubmitting(true);
    setErrorDetail(undefined);
    try {
      const updated = await meApi.update(patch);
      onProfileUpdated({ name: updated.name, email: updated.email, address: updated.address });
      setEditing(false);
      setToast({ id: Date.now(), message: "Profile updated" });
    } catch (err) {
      setErrorDetail(err instanceof ApiError ? err.detail ?? err.message : "Update failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <div className="crumbs">Home <span className="sep">/</span> <span className="now">My Profile</span></div>
      <div className="page-head">
        <div>
          <h1>My Profile</h1>
          <div className="subtitle">View and update your own account details.</div>
        </div>
        {!editing && (
          <div className="page-head-actions">
            <button className="btn btn-primary" onClick={() => setEditing(true)}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
              Edit Profile
            </button>
          </div>
        )}
      </div>

      {errorDetail && (
        <div className="err-banner">
          <svg className="ico" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <div className="msg">{errorDetail}</div>
        </div>
      )}

      {!editing ? (
        <div className="readonly-box" style={{ maxWidth: 480 }}>
          <div className="row"><span className="k">Full Name</span><span className="v">{me.name}</span></div>
          <div className="row"><span className="k">Email</span><span className="v">{me.email}</span></div>
          <div className="row"><span className="k">Address</span><span className="v">{me.address}</span></div>
        </div>
      ) : (
        <div style={{ maxWidth: 480, marginTop: 12 }}>
          <div className="form-group">
            <label>Full Name <span className="req">*</span></label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} onBlur={() => setTouched(true)} />
            {touched && nameErr && <div className="field-error">{nameErr}</div>}
          </div>
          <div className="form-group">
            <label>Email <span className="req">*</span></label>
            <input type="text" value={email} onChange={(e) => setEmail(e.target.value)} onBlur={() => setTouched(true)} />
            {touched && emailErr && <div className="field-error">{emailErr}</div>}
          </div>
          <div className="form-group">
            <label>Address <span className="req">*</span></label>
            <input type="text" value={address} onChange={(e) => setAddress(e.target.value)} onBlur={() => setTouched(true)} />
            {touched && addressErr && <div className="field-error">{addressErr}</div>}
          </div>
          <div className="form-group">
            <label>New Password</label>
            <input
              type="text"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onBlur={() => setTouched(true)}
              placeholder="Leave blank to keep current password"
            />
            {touched && passwordErr ? (
              <div className="field-error">{passwordErr}</div>
            ) : (
              <div className="help">Leave blank to keep your current password.</div>
            )}
          </div>
          <div className="drawer-foot" style={{ position: "static", border: "none", padding: "8px 0" }}>
            <button className="btn btn-ghost" onClick={() => setEditing(false)} disabled={submitting}>Cancel</button>
            <button className="btn btn-primary" onClick={handleSave} disabled={submitting}>
              {submitting ? "Saving…" : "Save Changes"}
            </button>
          </div>
        </div>
      )}
      <Toast toast={toast} onClose={() => setToast(null)} />
    </>
  );
}
