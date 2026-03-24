import pandas as pd
import numpy as np
import joblib

# =============================
# LOAD EVERYTHING
# =============================
model_ext = joblib.load("models/model_extended_icu.pkl")
model_read = joblib.load("models/model_readmission.pkl")
model_los = joblib.load("models/model_icu_los.pkl")

scaler = joblib.load("models/scaler.pkl")
feature_cols = joblib.load("models/feature_columns.pkl")

# =============================
# MAIN FUNCTION
# =============================
def predict_patient(input_dict):
    
    # convert input → dataframe
    df = pd.DataFrame([input_dict])

    # align columns (VERY IMPORTANT)
    df = df.reindex(columns=feature_cols, fill_value=0)

    # bool → int
    df = df.apply(lambda col: col.astype(int) if col.dtype == "bool" else col)

    # scale
    X = scaler.transform(df)

    # predictions
    icu_risk = model_ext.predict_proba(X)[0][1]
    readmit_risk = model_read.predict_proba(X)[0][1]
    los_hours = model_los.predict(X)[0]

    return {
        "ICU_Risk": float(icu_risk),
        "Readmission_Risk": float(readmit_risk),
        "ICU_LOS_hours": float(los_hours)
    }

# =============================
# TEST WITH REAL DATA
# =============================
if __name__ == "__main__":
    
    # safest way → use real sample from dataset
    df = pd.read_csv("Data/processed/features.csv")
    df.columns = df.columns.str.strip()

    sample = df.drop(
        ["extended_icu", "readmit_30", "icu_los_hours"], axis=1
    ).iloc[0].to_dict()

    result = predict_patient(sample)

    print("\n PATIENT PREDICTION")
    print("ICU Risk:", result["ICU_Risk"])
    print("Readmission Risk:", result["Readmission_Risk"])
    print("Expected ICU LOS (hours):", result["ICU_LOS_hours"])