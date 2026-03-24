import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getFeatures, predictCost, predictICU, saveToHistory } from '../api/predict';
import { auth, db } from '../firebase/config';

const STEP_LABELS = ['Demographics', 'Vitals', 'Labs', 'Clinical', 'Admission', 'History'];

/** Step → form keys that must be non-empty valid numbers before Next / submit */
const REQUIRED_BY_STEP = {
  1: ['age'],
  2: ['heartRate', 'systolicBP', 'diastolicBP', 'respiratoryRate', 'temperature', 'spo2', 'map'],
  3: ['wbc', 'hemoglobin', 'platelets', 'creatinine', 'bun', 'sodium', 'potassium', 'glucose'],
  4: ['gcsScore', 'sofaScore', 'diagnosisCount', 'severityIndex'],
  5: ['prevIcuAdmissions'],
};

function isNonEmptyNumber(val) {
  const s = String(val ?? '').trim();
  if (s === '') return false;
  const n = Number(s);
  return Number.isFinite(n);
}

function validateStepFields(step, form) {
  const keys = REQUIRED_BY_STEP[step] || [];
  const errors = {};
  keys.forEach((k) => {
    if (!isNonEmptyNumber(form[k])) errors[k] = 'This field is required';
  });
  return errors;
}

function validateAllICUSteps(form) {
  const errors = {};
  for (let s = 1; s <= 5; s += 1) {
    Object.assign(errors, validateStepFields(s, form));
  }
  return errors;
}

function firstStepWithErrors(form) {
  for (let s = 1; s <= 5; s += 1) {
    if (Object.keys(validateStepFields(s, form)).length) return s;
  }
  return null;
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
  age: '', gender: 'Male',
  heartRate: '', systolicBP: '', diastolicBP: '', respiratoryRate: '', temperature: '', spo2: '', map: '',
  wbc: '', hemoglobin: '', platelets: '', creatinine: '', bun: '', sodium: '', potassium: '', glucose: '',
  gcsScore: '', sofaScore: '', diagnosisCount: '', severityIndex: '',
  admissionType: 'Emergency', icuType: 'Medical', prevIcuAdmissions: '', insuranceType: 'Medicare',
  diabetes: false, hypertension: false, heartDisease: false, ckd: false, copd: false, onVentilator: false, onVasopressors: false,
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
  const [step, setStep] = useState(1);
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

  const goNext = () => {
    setError('');
    const errs = validateStepFields(step, form);
    if (Object.keys(errs).length) {
      setFieldErrors(errs);
      return;
    }
    setFieldErrors({});
    setStep((s) => Math.min(6, s + 1));
  };

  const handleSubmitICU = async () => {
    setError('');
    const allErrs = validateAllICUSteps(form);
    if (Object.keys(allErrs).length) {
      setFieldErrors(allErrs);
      const first = firstStepWithErrors(form);
      if (first != null) setStep(first);
      setError('Please fill in all required fields before running the prediction.');
      return;
    }
    setFieldErrors({});
    setLoading(true);
    setError('');
    try {
      const user = auth.currentUser;
      const token = user ? await user.getIdToken() : null;
      const colsRes = await getFeatures();
      const allCols = colsRes.data;
      const features = {};
      allCols.forEach((c) => { features[c] = 0; });

      features.age = parseFloat(form.age) || 0;
      features.heart_rate = parseFloat(form.heartRate) || 0;
      features.systolic_bp = parseFloat(form.systolicBP) || 0;
      features.diastolic_bp = parseFloat(form.diastolicBP) || 0;
      features.resp_rate = parseFloat(form.respiratoryRate) || 0;
      features.temperature = parseFloat(form.temperature) || 0;
      features.spo2 = parseFloat(form.spo2) || 0;
      features.map = parseFloat(form.map) || 0;
      features.wbc = parseFloat(form.wbc) || 0;
      features.hemoglobin = parseFloat(form.hemoglobin) || 0;
      features.platelets = parseFloat(form.platelets) || 0;
      features.creatinine = parseFloat(form.creatinine) || 0;
      features.bun = parseFloat(form.bun) || 0;
      features.sodium = parseFloat(form.sodium) || 0;
      features.potassium = parseFloat(form.potassium) || 0;
      features.glucose = parseFloat(form.glucose) || 0;
      features.gcs_score = parseFloat(form.gcsScore) || 0;
      features.sofa_score = parseFloat(form.sofaScore) || 0;
      features.diagnosis_count = parseFloat(form.diagnosisCount) || 0;
      features.severity_index = parseFloat(form.severityIndex) || 0;
      features.previous_icu_admissions = parseFloat(form.prevIcuAdmissions) || 0;
      if (form.gender === 'Male') features.gender_Male = 1;
      if (form.gender === 'Female') features.gender_Female = 1;
      features[`admission_type_${form.admissionType}`] = 1;
      features[`icu_type_${form.icuType}`] = 1;
      features[`insurance_${form.insuranceType}`] = 1;
      features.diabetes = form.diabetes ? 1 : 0;
      features.hypertension = form.hypertension ? 1 : 0;
      features.heart_disease = form.heartDisease ? 1 : 0;
      features.ckd = form.ckd ? 1 : 0;
      features.copd = form.copd ? 1 : 0;
      features.on_ventilator = form.onVentilator ? 1 : 0;
      features.on_vasopressors = form.onVasopressors ? 1 : 0;

      const payload = token ? { token, data: features } : { features };
      const res = await predictICU(payload);
      const result = res.data;

      if (user && db) await saveToHistory(db, user.uid, form, result);
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
        <InputField label="Age (years)" k="age" value={form.age} onChange={set} min={0} max={120} placeholder="e.g. 65" error={fieldErrors.age} />
        <div className="form-group">
          <label>Gender</label>
          <div className="radio-group">
            {['Male', 'Female'].map((g) => (
              <label key={g} className={`radio-option ${form.gender === g ? 'selected' : ''}`}>
                <input type="radio" value={g} checked={form.gender === g} onChange={() => set('gender', g)} /> {g}
              </label>
            ))}
          </div>
        </div>
      </div>
    </div>,
    <div key={2} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
      <InputField label="Heart Rate (bpm)" k="heartRate" value={form.heartRate} onChange={set} placeholder="60-100" error={fieldErrors.heartRate} />
      <InputField label="Systolic BP (mmHg)" k="systolicBP" value={form.systolicBP} onChange={set} placeholder="e.g. 120" error={fieldErrors.systolicBP} />
      <InputField label="Diastolic BP (mmHg)" k="diastolicBP" value={form.diastolicBP} onChange={set} placeholder="e.g. 80" error={fieldErrors.diastolicBP} />
      <InputField label="Respiratory Rate (breaths/min)" k="respiratoryRate" value={form.respiratoryRate} onChange={set} placeholder="12-20" error={fieldErrors.respiratoryRate} />
      <InputField label="Temperature (°C)" k="temperature" value={form.temperature} onChange={set} placeholder="e.g. 37.0" error={fieldErrors.temperature} />
      <InputField label="SpO2 (%)" k="spo2" value={form.spo2} onChange={set} placeholder="95-100" error={fieldErrors.spo2} />
      <InputField label="Mean Arterial Pressure (mmHg)" k="map" value={form.map} onChange={set} placeholder="e.g. 93" error={fieldErrors.map} />
    </div>,
    <div key={3} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
      <InputField label="WBC Count (K/uL)" k="wbc" value={form.wbc} onChange={set} placeholder="4-11" error={fieldErrors.wbc} />
      <InputField label="Hemoglobin (g/dL)" k="hemoglobin" value={form.hemoglobin} onChange={set} placeholder="12-17" error={fieldErrors.hemoglobin} />
      <InputField label="Platelet Count (K/uL)" k="platelets" value={form.platelets} onChange={set} placeholder="150-400" error={fieldErrors.platelets} />
      <InputField label="Serum Creatinine (mg/dL)" k="creatinine" value={form.creatinine} onChange={set} placeholder="0.6-1.2" error={fieldErrors.creatinine} />
      <InputField label="Blood Urea Nitrogen (mg/dL)" k="bun" value={form.bun} onChange={set} placeholder="7-20" error={fieldErrors.bun} />
      <InputField label="Serum Sodium (mEq/L)" k="sodium" value={form.sodium} onChange={set} placeholder="136-145" error={fieldErrors.sodium} />
      <InputField label="Serum Potassium (mEq/L)" k="potassium" value={form.potassium} onChange={set} placeholder="3.5-5.0" error={fieldErrors.potassium} />
      <InputField label="Blood Glucose (mg/dL)" k="glucose" value={form.glucose} onChange={set} placeholder="70-100" error={fieldErrors.glucose} />
    </div>,
    <div key={4} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
      <InputField label="GCS Score (3-15)" k="gcsScore" value={form.gcsScore} onChange={set} min={3} max={15} placeholder="e.g. 14" error={fieldErrors.gcsScore} />
      <InputField label="SOFA Score (0-24)" k="sofaScore" value={form.sofaScore} onChange={set} min={0} max={24} placeholder="e.g. 4" error={fieldErrors.sofaScore} />
      <InputField label="Diagnosis Count" k="diagnosisCount" value={form.diagnosisCount} onChange={set} placeholder="e.g. 3" error={fieldErrors.diagnosisCount} />
      <InputField label="Severity Index (0-10)" k="severityIndex" value={form.severityIndex} onChange={set} min={0} max={10} placeholder="e.g. 6" error={fieldErrors.severityIndex} />
    </div>,
    <div key={5} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
      {[
        ['Admission Type', 'admissionType', ['Emergency', 'Elective', 'Urgent']],
        ['ICU Type', 'icuType', ['Medical', 'Surgical', 'Cardiac', 'Neuro']],
        ['Insurance Type', 'insuranceType', ['Medicare', 'Medicaid', 'Private', 'Other']],
      ].map(([label, k, opts]) => (
        <div key={k} className="form-group">
          <label>{label}</label>
          <select value={form[k]} onChange={(e) => set(k, e.target.value)}>
            {opts.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>
      ))}
      <InputField label="Previous ICU Admissions" k="prevIcuAdmissions" value={form.prevIcuAdmissions} onChange={set} placeholder="e.g. 0" error={fieldErrors.prevIcuAdmissions} />
    </div>,
    <div key={6}>
      <div className="form-group" style={{ marginBottom: '2rem' }}>
        <label>Medical History</label>
        <div className="checkbox-group">
          {[
            ['diabetes', 'Diabetes'], ['hypertension', 'Hypertension'], ['heartDisease', 'Heart Disease'],
            ['ckd', 'Chronic Kidney Disease'], ['copd', 'COPD'], ['onVentilator', 'On Ventilator'],
            ['onVasopressors', 'On Vasopressors'],
          ].map(([k, label]) => (
            <label key={k} className={`checkbox-option ${form[k] ? 'checked' : ''}`}>
              <input type="checkbox" checked={form[k]} onChange={(e) => set(k, e.target.checked)} /> {label}
            </label>
          ))}
        </div>
      </div>
      {error && <div className="auth-error" style={{ marginBottom: '1rem' }}>{error}</div>}
      <button className="btn-primary" style={{ width: '100%', padding: '1rem' }} onClick={handleSubmitICU} disabled={loading}>
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
            <p style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>Fill in the patient details below</p>
          </div>

          {steps[step - 1]}

          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '2rem' }}>
            <button className="btn-secondary" onClick={() => setStep((s) => Math.max(1, s - 1))} disabled={step === 1} style={{ opacity: step === 1 ? 0.4 : 1 }}>
              ← Back
            </button>
            {step < 6 && <button className="btn-primary" onClick={goNext}>Next →</button>}
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
