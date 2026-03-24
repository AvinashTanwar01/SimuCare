import { updateProfile } from "firebase/auth";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { useEffect, useState } from "react";
import { auth, db } from "../firebase/config";

export default function Profile() {
  const user = auth.currentUser;
  const [name, setName] = useState(user?.displayName || "");
  const [email, setEmail] = useState(user?.email || "");
  const [age, setAge] = useState("");
  const [gender, setGender] = useState("Male");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const load = async () => {
      if (!user) return;
      const snap = await getDoc(doc(db, "users", user.uid));
      if (snap.exists()) {
        const data = snap.data();
        if (data.name && !user.displayName) setName(data.name);
        if (data.age != null && data.age !== "") setAge(String(data.age));
        if (data.gender) setGender(data.gender);
      }
    };
    load();
  }, [user]);

  const handleSave = async (e) => {
    e.preventDefault();
    if (!user) return;
    const ageNum = Number(age);
    if (age.trim() === "" || !Number.isInteger(ageNum) || ageNum < 0 || ageNum > 120) {
      setError("Please enter a valid age (0–120).");
      return;
    }
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
          age: ageNum,
          gender,
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
      <p className="page-sub">Update your name, age, gender, and email</p>
      <div className="card profile-card">
        {error && <div className="auth-error" style={{ marginBottom: "1rem" }}>{error}</div>}
        {message && <div className="profile-success">{message}</div>}
        <form onSubmit={handleSave} className="profile-form">
          <div className="form-group">
            <label>Name</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Jane Smith" required />
          </div>
          <div className="form-group">
            <label>Email Address</label>
            <input type="email" value={email} disabled />
          </div>
          <div className="form-group">
            <label>Age (years)</label>
            <input type="number" min={0} max={120} step={1} value={age} onChange={(e) => setAge(e.target.value)} placeholder="e.g. 58" required />
          </div>
          <div className="form-group">
            <label>Gender</label>
            <select value={gender} onChange={(e) => setGender(e.target.value)}>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
            </select>
          </div>
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? "Saving..." : "Save Profile"}
          </button>
        </form>
      </div>
    </div>
  );
}
