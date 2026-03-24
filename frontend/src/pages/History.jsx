import { collection, getDocs, orderBy, query } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { auth, db } from '../firebase/config';

export default function History() {
  const [predictions, setPredictions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      const user = auth.currentUser;
      if (!user) {
        setLoading(false);
        return;
      }
      try {
        const q = query(collection(db, 'users', user.uid, 'predictions'), orderBy('timestamp', 'desc'));
        const snap = await getDocs(q);
        setPredictions(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, []);

  const level = (pct) => (pct < 30 ? 'low' : pct <= 60 ? 'mid' : 'high');

  return (
    <div className="page-wrap">
      <h1 className="page-title">Prediction History</h1>
      <p className="page-sub">All previous ICU risk assessments for this account</p>

      {loading && <p style={{ color: 'var(--muted)' }}>Loading...</p>}
      {!loading && predictions.length === 0 && (
        <div className="card" style={{ textAlign: 'center', padding: '4rem' }}>
          <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>📋</div>
          <p style={{ color: 'var(--muted)' }}>No predictions yet. Run your first assessment to see it here.</p>
        </div>
      )}
      {!loading && predictions.length > 0 && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <table className="history-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>ICU Risk</th>
                <th>Readmission</th>
                <th>LOS (hours)</th>
              </tr>
            </thead>
            <tbody>
              {predictions.map((p) => {
                const icuPct = Math.round((p.result?.ICU_Risk ?? 0) * 100);
                const readPct = Math.round((p.result?.Readmission_Risk ?? 0) * 100);
                const los = Math.round(p.result?.ICU_LOS_hours ?? 0);
                const ts = p.timestamp?.toDate?.();
                return (
                  <tr key={p.id}>
                    <td style={{ color: 'var(--muted)' }}>{ts ? ts.toLocaleDateString() : '—'}</td>
                    <td><span className={`risk-chip ${level(icuPct)}`}>{icuPct}%</span></td>
                    <td><span className={`risk-chip ${level(readPct)}`}>{readPct}%</span></td>
                    <td style={{ color: 'var(--white)', fontWeight: 600 }}>{los}h</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
