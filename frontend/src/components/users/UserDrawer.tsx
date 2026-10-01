import { useEffect, useState } from "react";
import type { Customer, CustomerCreate, CustomerUpdate } from "../../types/customer";
import { isValidEmail } from "../../utils/validation";

export type UserDrawerMode =
  | { kind: "create"; role: "customer" | "admin" }
  | { kind: "edit"; customer: Customer };

interface Props {
  open: boolean;
  mode: UserDrawerMode;
  submitting: boolean;
  errorDetail?: string;
  onClose: () => void;
  onCreate: (data: CustomerCreate) => void;
  onUpdate: (id: number, data: CustomerUpdate) => void;
}

export function UserDrawer({ open, mode, submitting, errorDetail, onClose, onCreate, onUpdate }: Props) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [address, setAddress] = useState("");
  const [touched, setTouched] = useState(false);

  const isCreate = mode.kind === "create";

  useEffect(() => {
    if (!open) return;
    setTouched(false);
    setPassword("");
    if (mode.kind === "edit") {
      setName(mode.customer.name);
      setEmail(mode.customer.email);
      setAddress(mode.customer.address);
    } else {
      setName("");
      setEmail("");
      setAddress("");
    }
  }, [open, mode]);

  const nameErr = name.trim() === "" ? "Required." : "";
  const emailErr = email.trim() === "" ? "Required." : !isValidEmail(email.trim()) ? "Must be a valid email." : "";
  const addressErr = address.trim() === "" ? "Required." : "";
  const passwordHint = "At least 8 characters, including one special character.";
  const passwordInvalid = password.length < 8 || /^[A-Za-z0-9]*$/.test(password);
  const passwordErr = isCreate ? (passwordInvalid ? passwordHint : "") : password !== "" && passwordInvalid ? passwordHint : "";
  const anyErr = nameErr || emailErr || passwordErr || addressErr;

  function submit() {
    setTouched(true);
    if (anyErr) return;
    if (isCreate) {
      onCreate({ name: name.trim(), email: email.trim(), password, address: address.trim() });
    } else if (mode.kind === "edit") {
      const patch: CustomerUpdate = {};
      if (name.trim() !== mode.customer.name) patch.name = name.trim();
      if (email.trim() !== mode.customer.email) patch.email = email.trim();
      if (address.trim() !== mode.customer.address) patch.address = address.trim();
      if (password !== "") patch.password = password;
      onUpdate(mode.customer.user_id, patch);
    }
  }

  const title = isCreate ? `Create ${mode.role === "admin" ? "Admin" : "Customer"}` : `Edit Customer`;
  const submitLabel = submitting ? "Saving…" : isCreate ? title : "Save changes";

  return (
    <div className={`drawer${open ? " open" : ""}`} role="dialog" aria-modal="true">
      <div className="drawer-head">
        <h3>{title}</h3>
        <button className="close" onClick={onClose} aria-label="Close">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>
      <div className="drawer-body">
        {errorDetail && (
          <div className="err-banner" style={{ marginBottom: 16 }}>
            <svg className="ico" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <div className="msg">{errorDetail}</div>
          </div>
        )}

        {!isCreate && mode.kind === "edit" && (
          <div className="readonly-box">
            <div className="row"><span className="k">Customer ID</span><span className="v">#{String(mode.customer.user_id).padStart(4, "0")}</span></div>
          </div>
        )}

        <div className="form-group">
          <label>Full Name <span className="req">*</span></label>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} onBlur={() => setTouched(true)} placeholder="e.g. Priya Nair" />
          {touched && nameErr && <div className="field-error">{nameErr}</div>}
        </div>

        <div className="form-group">
          <label>Email <span className="req">*</span></label>
          <input type="text" value={email} onChange={(e) => setEmail(e.target.value)} onBlur={() => setTouched(true)} placeholder="priya@example.com" />
          {touched && emailErr && <div className="field-error">{emailErr}</div>}
        </div>

        <div className="form-group">
          <label>Password{isCreate && <span className="req">*</span>}</label>
          <input
            type="text"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onBlur={() => setTouched(true)}
            placeholder={isCreate ? "At least 8 characters, incl. 1 special" : "Leave blank to keep existing password"}
          />
          {touched && passwordErr ? (
            <div className="field-error">{passwordErr}</div>
          ) : (
            <div className="help">
              {isCreate
                ? "Hashed server-side (PBKDF2). Not stored in plaintext."
                : "Leave blank to keep the current password."}
            </div>
          )}
        </div>

        <div className="form-group">
          <label>Address <span className="req">*</span></label>
          <input type="text" value={address} onChange={(e) => setAddress(e.target.value)} onBlur={() => setTouched(true)} placeholder="e.g. 123 Main St, City" />
          {touched && addressErr && <div className="field-error">{addressErr}</div>}
        </div>
      </div>
      <div className="drawer-foot">
        <button className="btn btn-ghost" onClick={onClose} disabled={submitting}>Cancel</button>
        <button className="btn btn-primary" onClick={submit} disabled={submitting}>{submitLabel}</button>
      </div>
    </div>
  );
}
