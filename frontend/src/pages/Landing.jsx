import { Link } from 'react-router-dom';

export default function Landing() {
  return (
    <div>
      <section className="landing-hero">
        <div className="hero-badge">
          <span className="hero-badge-dot" />
          AI-Powered Clinical Intelligence
        </div>
        <h1 className="hero-title">
          Predict ICU Risk
          <br />
          <span className="accent">Before It's Critical</span>
        </h1>
        <p className="hero-sub">
          SimuCare uses machine learning trained on real ICU data to give clinicians instant risk scores - ICU
          admission, 30-day readmission, and predicted length of stay.
        </p>
        <div className="hero-actions">
          <Link to="/signup">
            <button className="btn-primary">Get Started Free</button>
          </Link>
          <Link to="/login">
            <button className="btn-secondary">Sign In</button>
          </Link>
        </div>
      </section>

      <div className="stats-bar">
        <div className="stat-item">
          <div className="stat-number">158</div>
          <div className="stat-label">Clinical Features Analyzed</div>
        </div>
        <div className="stat-item">
          <div className="stat-number">2</div>
          <div className="stat-label">Prediction Models</div>
        </div>
        <div className="stat-item">
          <div className="stat-number">Real-time</div>
          <div className="stat-label">Risk Assessment</div>
        </div>
      </div>

      <section className="features-section">
        <div className="features-label">What SimuCare Does</div>
        <h2 className="features-title">Clinical AI at the Point of Care</h2>
        <div className="features-grid">
          <div className="feature-card">
            <div className="feature-icon">🫀</div>
            <h3>ICU Risk Score</h3>
            <p>Predicts likelihood of ICU admission or complicated course using vitals, labs, and clinical scores.</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">🔄</div>
            <h3>Readmission Risk</h3>
            <p>Estimates 30-day readmission probability to support discharge planning and follow-up care.</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">⏱️</div>
            <h3>Length of Stay</h3>
            <p>Forecasts expected ICU hours so teams can optimize staffing, bed allocation, and resources.</p>
          </div>
        </div>
      </section>
    </div>
  );
}
