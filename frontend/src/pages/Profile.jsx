import { updateProfile } from "firebase/auth";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { useEffect, useState } from "react";
import { auth, db } from "../firebase/config";

export default function Profile() {
  const user = auth.currentUser;
  const [name, setName] = useState(user?.displayName || "");
  const [email, setEmail] = useState(user?.email || "");
  const [role, setRole] = useState("");
  const [hospital, setHospital] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const load = async () => {
      if (!user) return;
      const snap = await getDoc(doc(db, "users", user.uid));
      if (snap.exists()) {
        const data = snap.data();
        setRole(data.role || "");
        setHospital(data.hospital || "");
        if (data.name && !user.displayName) setName(data.name);
      }
    };
    load();
  }, [user]);

  const handleSave = async (e) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    setMessage("");
    setError("");
    try {
      await updateProfile(user, { displayName: name.trim() });
      await setDoc(
        doc(db, "users", user.uid),
        {
          uid: user.uid,
          name: name.trim(),
          email: user.email,
          role: role.trim(),
          hospital: hospital.trim(),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
      setMessage("Profile updated successfully.");
    } catch (_err) {
      setError("Failed to update profile. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="page-wrap">
      <h1 className="page-title">My Profile</h1>
      <p className="page-sub">Manage your professional identity and account details</p>
      <div className="card profile-card">
        {error && <div className="auth-error" style={{ marginBottom: "1rem" }}>{error}</div>}
        {message && <div className="profile-success">{message}</div>}
        <form onSubmit={handleSave} className="profile-form">
          <div className="form-group">
            <label>Full Name</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Dr. Avinash Tanwar" required />
          </div>
          <div className="form-group">
            <label>Email Address</label>
            <input type="email" value={email} disabled />
          </div>
          <div className="form-group">
            <label>Clinical Role</label>
            <input type="text" value={role} onChange={(e) => setRole(e.target.value)} placeholder="ICU Physician" />
          </div>
          <div className="form-group">
            <label>Hospital / Organization</label>
            <input type="text" value={hospital} onChange={(e) => setHospital(e.target.value)} placeholder="City General Hospital" />
          </div>
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? "Saving..." : "Save Profile"}
          </button>
        </form>
      </div>
    </div>
  );
}
