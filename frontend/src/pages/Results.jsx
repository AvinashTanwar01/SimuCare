import { useLocation, useNavigate } from 'react-router-dom';

function getLevel(pct) {
  if (pct < 30) return { cls: 'low', label: 'Low Risk' };
  if (pct < 70) return { cls: 'mid', label: 'Moderate' };
  return { cls: 'high', label: 'High Risk' };
}

export default function Results() {
  const { state } = useLocation();
  const navigate = useNavigate();

  if (!state?.result) {
    return (
      <div className="page-wrap" style={{ textAlign: 'center', paddingTop: '6rem' }}>
        <p style={{ color: 'var(--muted)', marginBottom: '1.5rem' }}>No prediction data found.</p>
        <button className="btn-primary" onClick={() => navigate('/predict')}>Run a Prediction</button>
      </div>
    );
  }

  const { result } = state;
  const icuPct = Math.round((result.ICU_Risk ?? 0) * 100);
  const readPct = Math.round((result.Readmission_Risk ?? 0) * 100);
  const losHours = Math.round(result.ICU_LOS_hours ?? 0);
  const losDays = (losHours / 24).toFixed(1);
  const losBarPct = Math.min(100, (losHours / 168) * 100);

  const icu = getLevel(icuPct);
  const read = getLevel(readPct);

  return (
    <div className="page-wrap">
      <h1 className="page-title">Prediction Results</h1>
      <p className="page-sub">AI-generated risk assessment based on submitted clinical data</p>

      <div className="results-grid">
        <div className="gauge-card">
          <div className="gauge-title">ICU Risk Score</div>
          <div className={`gauge-circle ${icu.cls}`}>
            <span className="gauge-pct">{icuPct}%</span>
            <span className="gauge-label">{icu.label}</span>
          </div>
          <p style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>Likelihood of complicated ICU course</p>
        </div>

        <div className="gauge-card">
          <div className="gauge-title">30-Day Readmission</div>
          <div className={`gauge-circle ${read.cls}`}>
            <span className="gauge-pct">{readPct}%</span>
            <span className="gauge-label">{read.label}</span>
          </div>
          <p style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>Probability of readmission within 30 days</p>
        </div>

        <div className="gauge-card">
          <div className="gauge-title">ICU Stay Duration</div>
          <div style={{ margin: '1rem 0' }}>
            <div className="los-number">{losHours}h</div>
            <div className="los-sub">≈ {losDays} days</div>
          </div>
          <div className="los-bar-wrap">
            <div className="los-bar" style={{ width: `${losBarPct}%` }} />
          </div>
          <p style={{ color: 'var(--muted)', fontSize: '0.8rem', marginTop: '0.75rem' }}>Max scale: 168h (7 days)</p>
        </div>
      </div>

      <details style={{ marginTop: '2rem' }}>
        <summary style={{ cursor: 'pointer', color: 'var(--muted)', fontSize: '0.9rem', userSelect: 'none', marginBottom: '1rem' }}>
          View Input Summary
        </summary>
        <div className="card" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '1rem', fontSize: '0.85rem' }}>
          {state.formData && Object.entries(state.formData).slice(0, 12).map(([k, v]) => (
            <div key={k}>
              <div style={{ color: 'var(--muted)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{k}</div>
              <div style={{ color: 'var(--white)', fontWeight: 600 }}>{String(v) || '—'}</div>
            </div>
          ))}
        </div>
      </details>

      <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem' }}>
        <button className="btn-primary" onClick={() => navigate('/predict')}>New Prediction</button>
        <button className="btn-secondary" onClick={() => navigate('/history')}>View History</button>
      </div>
    </div>
  );
}
