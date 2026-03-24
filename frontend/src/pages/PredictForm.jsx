import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { predictCost, predictICU, saveToHistory } from '../api/predict';
import { auth, db } from '../firebase/config';

const STEP_LABELS = ['Patient Inputs'];

function isNonEmptyNumber(val) {
  const s = String(val ?? '').trim();
  if (s === '') return false;
  const n = Number(s);
  return Number.isFinite(n);
}

function validateIcuForm(form) {
  const errors = {};
  const v = (key) => Number(form[key]);
  const int = (key) => Number.isInteger(v(key));
  const inRange = (key, min, max) => isNonEmptyNumber(form[key]) && v(key) >= min && v(key) <= max;

  if (!inRange('diag_count', 1, 20) || !int('diag_count')) {
    errors.diag_count = 'Required: integer between 1 and 20';
  }
  if (!inRange('vital_mean', 0, 200)) {
    errors.vital_mean = 'Required: number between 0 and 200';
  }
  if (!inRange('lab_mean', 0, 200)) {
    errors.lab_mean = 'Required: number between 0 and 200';
  }
  if (!inRange('age', 0, 120) || !int('age')) {
    errors.age = 'Required: integer between 0 and 120';
  }
  if (!(form.is_male === '1' || form.is_male === '0')) {
    errors.is_male = 'Please select gender';
  }
  if (!inRange('severity_index', 0, 3000) || !int('severity_index')) {
    errors.severity_index = 'Required: integer between 0 and 3000';
  }

  return errors;
}

function formatPredictError(err) {
  const d = err?.response?.data?.detail;
  if (typeof d === 'string') {
    if (d.includes('Model input mismatch')) return d;
    if (d.startsWith('Prediction failed:')) return d;
    if (err?.response?.status === 400) return `Prediction failed: ${d}`;
    return d;
  }
  if (Array.isArray(d) && d.length) {
    const msg = d.map((x) => x?.msg || JSON.stringify(x)).join(' ');
    return `Prediction failed: ${msg}`;
  }
  return 'Prediction failed. Please check your inputs and try again.';
}

const initForm = {
  diag_count: '',
  vital_mean: '',
  lab_mean: '',
  age: '',
  is_male: '1',
  severity_index: '',
};

const initCostForm = {
  age: '',
  gender: 'male',
  bmi: '',
  children: '',
  region: '',
  discount_eligibility: 'no',
};

function InputField({ label, k, value, onChange, type = 'number', placeholder = '', min, max, error }) {
  return (
    <div className="form-group">
      <label>{label}</label>
      <input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(k, e.target.value)}
        min={min}
        max={max}
        aria-invalid={error ? 'true' : undefined}
        style={error ? { borderColor: 'rgba(239, 68, 68, 0.7)' } : undefined}
      />
      {error ? <span className="field-inline-error">{error}</span> : null}
    </div>
  );
}

export default function PredictForm() {
  const [tab, setTab] = useState('icu');
  const [step] = useState(1);
  const [form, setForm] = useState(initForm);
  const [costForm, setCostForm] = useState(initCostForm);
  const [loading, setLoading] = useState(false);
  const [costResult, setCostResult] = useState(null);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const navigate = useNavigate();

  const set = (k, v) => {
    setFieldErrors((e) => {
      if (!e[k]) return e;
      const next = { ...e };
      delete next[k];
      return next;
    });
    setForm((f) => ({ ...f, [k]: v }));
  };
  const setC = (k, v) => setCostForm((f) => ({ ...f, [k]: v }));

  const handleSubmitICU = async () => {
    setError('');
    const allErrs = validateIcuForm(form);
    if (Object.keys(allErrs).length) {
      setFieldErrors(allErrs);
      setError('Please fill in all required fields with valid ranges.');
      return;
    }
    setFieldErrors({});
    setLoading(true);
    setError('');
    try {
      const user = auth.currentUser;
      const token = user ? await user.getIdToken() : null;
      const payloadData = {
        diag_count: Number(form.diag_count),
        vital_mean: Number(form.vital_mean),
        lab_mean: Number(form.lab_mean),
        age: Number(form.age),
        is_male: Number(form.is_male),
        severity_index: Number(form.severity_index),
      };
      const payload = { token, data: payloadData };
      const res = await predictICU(payload);
      const result = res.data;

      if (user && db) await saveToHistory(db, user.uid, payloadData, result);
      navigate('/results', { state: { result, formData: form } });
    } catch (err) {
      setError(formatPredictError(err));
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitCost = async () => {
    setLoading(true);
    setError('');
    setCostResult(null);
    try {
      const res = await predictCost(costForm);
      setCostResult(res.data);
    } catch (_err) {
      setError('Cost prediction failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const steps = [
    <div key={1}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
        <div className="form-group">
          <label>Number of Diagnosed Conditions</label>
          <input type="number" min={1} max={20} step={1} placeholder="e.g. 2" value={form.diag_count} onChange={(e) => set('diag_count', e.target.value)} />
          <span style={{ color: 'var(--muted)', fontSize: '0.75rem' }}>Total conditions diagnosed (e.g. Diabetes + Hypertension = 2)</span>
          {fieldErrors.diag_count ? <span className="field-inline-error">{fieldErrors.diag_count}</span> : null}
        </div>

        <div className="form-group">
          <label>Average Vital Signs Score</label>
          <input type="number" min={0} max={200} step="any" placeholder="e.g. 75" value={form.vital_mean} onChange={(e) => set('vital_mean', e.target.value)} />
          <span style={{ color: 'var(--muted)', fontSize: '0.75rem' }}>Normal: 60-90 | Moderate: 90-120 | Critical: 120-180</span>
          {fieldErrors.vital_mean ? <span className="field-inline-error">{fieldErrors.vital_mean}</span> : null}
        </div>

        <div className="form-group">
          <label>Average Lab Test Result</label>
          <input type="number" min={0} max={200} step="any" placeholder="e.g. 35" value={form.lab_mean} onChange={(e) => set('lab_mean', e.target.value)} />
          <span style={{ color: 'var(--muted)', fontSize: '0.75rem' }}>Normal: 20-40 | Abnormal: 40-70 | Severe: 70-120</span>
          {fieldErrors.lab_mean ? <span className="field-inline-error">{fieldErrors.lab_mean}</span> : null}
        </div>

        <div className="form-group">
          <label>Patient Age</label>
          <input type="number" min={0} max={120} step={1} placeholder="e.g. 58" value={form.age} onChange={(e) => set('age', e.target.value)} />
          <span style={{ color: 'var(--muted)', fontSize: '0.75rem' }}>Age in years</span>
          {fieldErrors.age ? <span className="field-inline-error">{fieldErrors.age}</span> : null}
        </div>

        <div className="form-group">
          <label>Gender</label>
          <select value={form.is_male} onChange={(e) => set('is_male', e.target.value)}>
            <option value="1">Male</option>
            <option value="0">Female</option>
          </select>
          {fieldErrors.is_male ? <span className="field-inline-error">{fieldErrors.is_male}</span> : null}
        </div>

        <div className="form-group">
          <label>Overall Severity Score</label>
          <input type="number" min={0} max={3000} step={1} placeholder="e.g. 600" value={form.severity_index} onChange={(e) => set('severity_index', e.target.value)} />
          <span style={{ color: 'var(--muted)', fontSize: '0.75rem' }}>Mild: 200-500 | Moderate: 500-1000 | Severe: 1000-2000+</span>
          {fieldErrors.severity_index ? <span className="field-inline-error">{fieldErrors.severity_index}</span> : null}
        </div>
      </div>

      {error && <div className="auth-error" style={{ marginBottom: '1rem', marginTop: '1.5rem' }}>{error}</div>}
      <button className="btn-primary" style={{ width: '100%', padding: '1rem', marginTop: '1.5rem' }} onClick={handleSubmitICU} disabled={loading}>
        {loading ? 'Running Prediction...' : '⚡ Predict ICU Risk Now'}
      </button>
    </div>,
  ];

  return (
    <div className="page-wrap">
      <div className="tab-switcher">
        <button className={`tab-btn ${tab === 'icu' ? 'active' : ''}`} onClick={() => setTab('icu')}>🫀 ICU Predictor</button>
        <button className={`tab-btn ${tab === 'cost' ? 'active' : ''}`} onClick={() => setTab('cost')}>💰 Cost Predictor</button>
      </div>

      {tab === 'icu' && (
        <div className="card">
          <div className="step-progress">
            {STEP_LABELS.map((label, i) => {
              const n = i + 1;
              return (
                <div key={n} className={`step-item ${n < step ? 'completed' : n === step ? 'active' : ''}`}>
                  <div className="step-dot">{n < step ? '✓' : n}</div>
                  <span className="step-label">{label}</span>
                </div>
              );
            })}
          </div>

          <div style={{ marginBottom: '2rem' }}>
            <h2 style={{ fontFamily: 'Syne, sans-serif', fontSize: '1.2rem', fontWeight: 800, color: 'var(--white)', marginBottom: '0.3rem' }}>
              Step {step} - {STEP_LABELS[step - 1]}
            </h2>
            <p style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>Six health metrics below — used only for this risk estimate</p>
          </div>

          {steps[step - 1]}

          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '2rem' }}>
            <button className="btn-secondary" disabled style={{ opacity: 0.4 }}>
              ← Back
            </button>
            <button className="btn-primary" disabled style={{ opacity: 0.4 }}>Next →</button>
          </div>
        </div>
      )}

      {tab === 'cost' && (
        <div className="card">
          <h2 style={{ fontFamily: 'Syne, sans-serif', fontSize: '1.2rem', fontWeight: 800, color: 'var(--white)', marginBottom: '0.3rem' }}>
            Model 2 - Medical Cost Predictor
          </h2>
          <p style={{ color: 'var(--muted)', fontSize: '0.85rem', marginBottom: '2rem' }}>
            Predicts estimated medical expenses and flags high-cost patients (top 20%).
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '2rem' }}>
            <div className="form-group">
              <label>Age (years)</label>
              <input type="number" placeholder="e.g. 35" value={costForm.age} onChange={(e) => setC('age', e.target.value)} />
            </div>
            <div className="form-group">
              <label>BMI</label>
              <input type="number" step="0.1" placeholder="e.g. 27.5" value={costForm.bmi} onChange={(e) => setC('bmi', e.target.value)} />
            </div>
            <div className="form-group">
              <label>Number of Children</label>
              <input type="number" placeholder="e.g. 2" value={costForm.children} onChange={(e) => setC('children', e.target.value)} />
            </div>
            <div className="form-group">
              <label>Region</label>
              <select value={costForm.region} onChange={(e) => setC('region', e.target.value)}>
                <option value="">Select region</option>
                {['northeast', 'northwest', 'southeast', 'southwest'].map((r) => (
                  <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Gender</label>
              <div className="radio-group">
                {['male', 'female'].map((s) => (
                  <label key={s} className={`radio-option ${costForm.gender === s ? 'selected' : ''}`}>
                    <input type="radio" value={s} checked={costForm.gender === s} onChange={() => setC('gender', s)} />
                    {s.charAt(0).toUpperCase() + s.slice(1)}
                  </label>
                ))}
              </div>
            </div>
            <div className="form-group">
              <label>Discount Eligibility</label>
              <div className="radio-group">
                {['yes', 'no'].map((s) => (
                  <label key={s} className={`radio-option ${costForm.discount_eligibility === s ? 'selected' : ''}`}>
                    <input type="radio" value={s} checked={costForm.discount_eligibility === s} onChange={() => setC('discount_eligibility', s)} />
                    {s.charAt(0).toUpperCase() + s.slice(1)}
                  </label>
                ))}
              </div>
            </div>
          </div>

          {error && <div className="auth-error" style={{ marginBottom: '1rem' }}>{error}</div>}

          <button className="btn-primary" style={{ width: '100%', padding: '1rem', marginBottom: costResult ? '2rem' : '0' }} onClick={handleSubmitCost} disabled={loading}>
            {loading ? 'Calculating...' : '💰 Predict Medical Cost'}
          </button>

          {costResult && (
            <div className="cost-result-grid">
              <div className="card" style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--muted)', marginBottom: '1rem' }}>
                  Estimated Expenses
                </div>
                {costResult.predicted_cost != null ? (
                  <div className="cost-amount">${costResult.predicted_cost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                ) : (
                  <div style={{ color: 'var(--muted)' }}>{costResult.details || 'Cost prediction unavailable'}</div>
                )}
                {costResult.premium_estimate != null && (
                  <div style={{ color: 'var(--muted)', fontSize: '0.8rem', marginTop: '0.75rem' }}>
                    Estimated Premium: {Number(costResult.premium_estimate).toFixed(4)}
                  </div>
                )}
              </div>
              <div className="card" style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--muted)', marginBottom: '1rem' }}>
                  Cost Category
                </div>
                {costResult.high_cost_flag != null ? (
                  <>
                    <div className={`cost-badge ${costResult.high_cost_flag ? 'high-cost' : 'standard'}`}>
                      {costResult.high_cost_flag ? '⚠ High-Cost Patient' : '✓ Standard Cost'}
                    </div>
                    {costResult.confidence != null && (
                      <div style={{ color: 'var(--muted)', fontSize: '0.8rem', marginTop: '0.75rem' }}>
                        Confidence: {costResult.confidence}%
                      </div>
                    )}
                    <div style={{ color: 'var(--muted)', fontSize: '0.8rem', marginTop: '0.75rem' }}>
                      Discount Eligibility: {String(costResult.discount_eligibility ?? costForm.discount_eligibility)}
                    </div>
                    {costResult.expenses_input != null && (
                      <div style={{ color: 'var(--muted)', fontSize: '0.8rem', marginTop: '0.35rem' }}>
                        Expenses Input: ${Number(costResult.expenses_input).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                    )}
                    {costResult.premium_input != null && (
                      <div style={{ color: 'var(--muted)', fontSize: '0.8rem', marginTop: '0.35rem' }}>
                        Premium Input: {Number(costResult.premium_input).toFixed(4)}
                      </div>
                    )}
                    {costResult.premium_estimate != null && (
                      <div style={{ color: 'var(--muted)', fontSize: '0.8rem', marginTop: '0.35rem' }}>
                        Premium Estimate: {Number(costResult.premium_estimate).toFixed(4)}
                      </div>
                    )}
                  </>
                ) : (
                  <div style={{ color: 'var(--muted)' }}>{costResult.details || 'Classifier prediction unavailable'}</div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
