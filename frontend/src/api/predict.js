import axios from "axios";

const BASE = "/api";

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
