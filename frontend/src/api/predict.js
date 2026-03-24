import axios from "axios";

// Production: set VITE_API_URL in Vercel to your Render URL (no trailing slash), e.g. https://simucare-1.onrender.com
// Local: Vite proxy uses "/api" → localhost:8000
const rawBase = import.meta.env.VITE_API_URL || "/api";
const BASE = typeof rawBase === "string" ? rawBase.replace(/\/$/, "") : "/api";

export const getFeatures = () => axios.get(`${BASE}/features`);

export const predictICU = (payload) => axios.post(`${BASE}/predict`, payload);

export const predictCost = (formData) => axios.post(`${BASE}/predict2`, formData);

export const saveToHistory = async (db, uid, input, result) => {
  const { addDoc, collection, doc, serverTimestamp, setDoc } = await import("firebase/firestore");
  // Ensure the parent user document exists so Firestore hierarchy is clean.
  await setDoc(
    doc(db, "users", uid),
    {
      uid,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
  await addDoc(collection(db, "users", uid, "predictions"), {
    input,
    result,
    timestamp: serverTimestamp(),
  });
};
