import { useLocation, useNavigate } from 'react-router-dom';

function getLevel(pct) {
  if (pct < 30) return { cls: 'low', label: 'Low Risk' };
  if (pct <= 60) return { cls: 'mid', label: 'Moderate' };
  return { cls: 'high', label: 'High Risk' };
}

function validateICUResult(result) {
  if (!result || typeof result !== 'object') return 'Invalid prediction response.';
  const { ICU_Risk, Readmission_Risk, ICU_LOS_hours } = result;
  const okNum = (v) => typeof v === 'number' && Number.isFinite(v);
  if (!okNum(ICU_Risk) || ICU_Risk < 0 || ICU_Risk > 1) {
    return 'ICU risk is missing or outside the valid range (0–100%). Results cannot be shown.';
  }
  if (!okNum(Readmission_Risk) || Readmission_Risk < 0 || Readmission_Risk > 1) {
    return 'Readmission risk is missing or outside the valid range (0–100%). Results cannot be shown.';
  }
  if (!okNum(ICU_LOS_hours) || ICU_LOS_hours < 0 || ICU_LOS_hours > 2000) {
    return 'Predicted ICU stay is missing or outside the valid range (0–2000 hours). Results cannot be shown.';
  }
  return null;
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
  const validationError = validateICUResult(result);

  if (validationError) {
    return (
      <div className="page-wrap">
        <h1 className="page-title">Prediction Results</h1>
        <div className="auth-error" style={{ textAlign: 'left', maxWidth: '36rem', margin: '0 auto 2rem' }}>
          {validationError}
        </div>
        <button className="btn-primary" onClick={() => navigate('/predict')}>New Prediction</button>
      </div>
    );
  }

  const icuPct = Math.round((result.ICU_Risk ?? 0) * 100);
  const readPct = Math.round((result.Readmission_Risk ?? 0) * 100);
  const losHours = Math.round((result.ICU_LOS_hours ?? 0) * 10) / 10;
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
          <p style={{ color: 'var(--muted)', fontSize: '0.9rem', fontWeight: 600, margin: '0 0 0.5rem' }}>
            ICU Risk: <span style={{ color: 'var(--white)' }}>{icuPct}%</span>
          </p>
          <div className={`gauge-circle ${icu.cls}`}>
            <span className="gauge-pct">{icuPct}%</span>
            <span className="gauge-label">{icu.label}</span>
          </div>
          <p style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>Likelihood of complicated ICU course</p>
        </div>

        <div className="gauge-card">
          <div className="gauge-title">30-Day Readmission</div>
          <p style={{ color: 'var(--muted)', fontSize: '0.9rem', fontWeight: 600, margin: '0 0 0.5rem' }}>
            Readmission Risk: <span style={{ color: 'var(--white)' }}>{readPct}%</span>
          </p>
          <div className={`gauge-circle ${read.cls}`}>
            <span className="gauge-pct">{readPct}%</span>
            <span className="gauge-label">{read.label}</span>
          </div>
          <p style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>Probability of readmission within 30 days</p>
        </div>

        <div className="gauge-card">
          <div className="gauge-title">Predicted ICU Stay</div>
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
