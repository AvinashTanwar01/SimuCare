import joblib
import numpy as np
import pandas as pd

# =============================
# LOAD EVERYTHING
# =============================
model_ext = joblib.load("models/model_extended_icu.pkl")
model_read = joblib.load("models/model_readmission.pkl")
model_los = joblib.load("models/model_icu_los.pkl")

scaler = joblib.load("models/scaler.pkl")
feature_cols = joblib.load("models/feature_columns.pkl")

# Canonical ordered list used at training time (same as feature_columns.pkl)
MODEL_FEATURE_NAMES = list(feature_cols)


class ModelInputMismatchError(Exception):
    """Raised when input cannot be aligned to the model's expected feature schema."""


def _is_clinical_form_payload(d: dict) -> bool:
    """True when payload comes from the ICU web form (raw vitals/labs), not pre-aggregated rows."""
    return "heart_rate" in d


def _fnum(x, default: float = 0.0) -> float:
    try:
        if x is None:
            return default
        s = str(x).strip()
        if s == "":
            return default
        return float(s)
    except (TypeError, ValueError):
        return default


def _clinical_form_to_model_row(d: dict) -> dict:
    """
    Map expanded form fields (heart_rate, wbc, insurance_*, …) into the aggregated
    schema used at training time (diag_count, vital_mean, …, drg_code_*).
    """
    row = {name: 0.0 for name in MODEL_FEATURE_NAMES}

    vital_vals = [
        _fnum(d.get("heart_rate")),
        _fnum(d.get("systolic_bp")),
        _fnum(d.get("diastolic_bp")),
        _fnum(d.get("resp_rate")),
        _fnum(d.get("temperature")),
        _fnum(d.get("spo2")),
        _fnum(d.get("map")),
    ]

    lab_vals = [
        _fnum(d.get("wbc")),
        _fnum(d.get("hemoglobin")),
        _fnum(d.get("platelets")),
        _fnum(d.get("creatinine")),
        _fnum(d.get("bun")),
        _fnum(d.get("sodium")),
        _fnum(d.get("potassium")),
        _fnum(d.get("glucose")),
    ]
    v_arr = np.array(vital_vals, dtype=float)
    row["vital_mean"] = float(np.mean(v_arr))
    row["vital_min"] = float(np.min(v_arr))
    row["vital_max"] = float(np.max(v_arr))
    row["vital_std"] = float(np.std(v_arr)) if v_arr.size > 1 else 0.0
    row["vital_count"] = float(v_arr.size)

    l_arr = np.array(lab_vals, dtype=float)
    row["lab_mean"] = float(np.mean(l_arr))
    row["lab_count"] = float(l_arr.size)

    row["diag_count"] = _fnum(d.get("diagnosis_count", d.get("diag_count")))
    row["age"] = _fnum(d.get("age"))
    row["severity_index"] = _fnum(d.get("severity_index"))
    row["is_male"] = 1.0 if (d.get("gender_Male") == 1 or d.get("is_male") == 1) else 0.0

    if d.get("insurance_Medicare") == 1:
        row["insurance_Medicare"] = 1.0
        row["insurance_Other"] = 0.0
    else:
        row["insurance_Medicare"] = 0.0
        row["insurance_Other"] = 1.0

    vm = row["vital_mean"]
    lm = row["lab_mean"]
    row["lab_vital_ratio"] = (lm / vm) if vm else 0.0
    row["log_los"] = float(np.log1p(max(0.0, _fnum(d.get("previous_icu_admissions")))))

    return row


def _build_ordered_frame(input_dict: dict) -> pd.DataFrame:
    """Single row DataFrame with columns in exact training order."""
    row = {name: input_dict.get(name, 0) for name in MODEL_FEATURE_NAMES}
    df = pd.DataFrame([row], columns=MODEL_FEATURE_NAMES)
    if list(df.columns) != MODEL_FEATURE_NAMES:
        raise ModelInputMismatchError("Column order does not match training feature list.")
    return df


def _coerce_features(df: pd.DataFrame) -> pd.DataFrame:
    out = df.copy()
    for c in out.columns:
        if out[c].dtype == bool:
            out[c] = out[c].astype(int)
    out = out.apply(pd.to_numeric, errors="coerce").fillna(0)
    return out


def _validate_outputs(icu_risk: float, readmit_risk: float, los_hours: float) -> None:
    for name, v in (("ICU_Risk", icu_risk), ("Readmission_Risk", readmit_risk)):
        if v is None or (isinstance(v, float) and np.isnan(v)):
            raise ValueError(f"Invalid model output: {name} is null or NaN.")
        if not (0.0 <= float(v) <= 1.0):
            raise ValueError(f"Invalid model output: {name} must be between 0.0 and 1.0 (got {v}).")
    if los_hours is None or (isinstance(los_hours, float) and np.isnan(los_hours)):
        raise ValueError("Invalid model output: ICU_LOS_hours is null or NaN.")
    los = float(los_hours)
    if los < 0 or los > 2000:
        raise ValueError(f"Invalid model output: ICU_LOS_hours must be between 0 and 2000 (got {los}).")


# =============================
# MAIN FUNCTION
# =============================
def predict_patient(input_dict):
    if not isinstance(input_dict, dict):
        raise ModelInputMismatchError("Payload must be a dictionary of feature names to values.")

    aligned = _clinical_form_to_model_row(input_dict) if _is_clinical_form_payload(input_dict) else input_dict

    try:
        df = _build_ordered_frame(aligned)
        df = _coerce_features(df)
        if df.shape[1] != len(MODEL_FEATURE_NAMES):
            raise ModelInputMismatchError("Feature column count does not match training.")

        X = scaler.transform(df)
    except ModelInputMismatchError:
        raise
    except Exception as exc:
        raise ModelInputMismatchError(f"Model input mismatch — check feature list: {exc}") from exc

    try:
        icu_risk = float(model_ext.predict_proba(X)[0][1])
        readmit_risk = float(model_read.predict_proba(X)[0][1])
        los_hours = float(model_los.predict(X)[0])
    except Exception as exc:
        raise RuntimeError(str(exc)) from exc

    _validate_outputs(icu_risk, readmit_risk, los_hours)

    return {
        "ICU_Risk": icu_risk,
        "Readmission_Risk": readmit_risk,
        "ICU_LOS_hours": los_hours,
    }


# =============================
# TEST WITH REAL DATA
# =============================
if __name__ == "__main__":
    df = pd.read_csv("Data/processed/features.csv")
    df.columns = df.columns.str.strip()

    sample = df.drop(["extended_icu", "readmit_30", "icu_los_hours"], axis=1).iloc[0].to_dict()

    result = predict_patient(sample)

    print("\n PATIENT PREDICTION")
    print("ICU Risk:", result["ICU_Risk"])
    print("Readmission Risk:", result["Readmission_Risk"])
    print("Expected ICU LOS (hours):", result["ICU_LOS_hours"])
