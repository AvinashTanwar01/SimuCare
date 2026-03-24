import os
import pickle

import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.linear_model import LinearRegression
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler

csv_candidates = ["Data/insurance.csv", "data/insurance.csv", "Data/medical_costs.csv", "insurance.csv"]
df = None
for path in csv_candidates:
    if os.path.exists(path):
        df = pd.read_csv(path)
        print(f"Loaded: {path}")
        break

if df is None:
    print("No CSV found — generating synthetic data...")
    np.random.seed(42)
    n = 1338
    df = pd.DataFrame(
        {
            "age": np.random.randint(18, 65, n),
            "gender": np.random.choice(["male", "female"], n),
            "bmi": np.round(np.random.uniform(16, 53, n), 1),
            "children": np.random.randint(0, 5, n),
            "discount_eligibility": np.random.choice(["yes", "no"], n, p=[0.35, 0.65]),
            "region": np.random.choice(["northeast", "northwest", "southeast", "southwest"], n),
        }
    )
    base = df["age"] * 200 + df["bmi"] * 130 + df["children"] * 550
    discount_mult = np.where(df["discount_eligibility"] == "yes", 0.82, 1.0)
    df["expenses"] = np.round((base * discount_mult + np.random.normal(0, 1800, n)).clip(1121, 65000), 2)
    df["premium"] = np.round(df["expenses"] / 100, 4)

# Normalize incoming dataset schema
if "gender" not in df.columns and "sex" in df.columns:
    df["gender"] = df["sex"]
if "expenses" not in df.columns and "charges" in df.columns:
    df["expenses"] = df["charges"]
if "discount_eligibility" not in df.columns:
    df["discount_eligibility"] = "no"

df_enc = df.copy()
df_enc["gender"] = (df_enc["gender"].astype(str).str.lower() == "male").astype(int)
df_enc["discount_eligibility"] = (
    df_enc["discount_eligibility"].astype(str).str.lower().isin(["yes", "true", "1", "eligible"]).astype(int)
)
df_enc = pd.get_dummies(df_enc, columns=["region"], drop_first=False)
for col in ["region_northeast", "region_northwest", "region_southeast", "region_southwest"]:
    if col not in df_enc.columns:
        df_enc[col] = 0

feature_cols = [
    "age",
    "gender",
    "bmi",
    "children",
    "discount_eligibility",
    "region_northeast",
    "region_northwest",
    "region_southeast",
    "region_southwest",
]
X = df_enc[feature_cols]
y_cost = df_enc["expenses"]
threshold = np.percentile(y_cost, 80)
y_flag = (y_cost >= threshold).astype(int)

X_train, X_test, y_train, y_test = train_test_split(X, y_cost, test_size=0.2, random_state=42)
scaler = StandardScaler()
X_train_sc = scaler.fit_transform(X_train)
lr = LinearRegression()
lr.fit(X_train_sc, y_train)
rf = RandomForestClassifier(n_estimators=100, random_state=42)
rf.fit(X_train, y_flag.iloc[X_train.index])

os.makedirs("models", exist_ok=True)
for name, obj in [
    ("cost_model.pkl", lr),
    ("cost_classifier.pkl", rf),
    ("cost_scaler.pkl", scaler),
    ("cost_threshold.pkl", threshold),
    ("cost_features.pkl", feature_cols),
]:
    with open(f"models/{name}", "wb") as f:
        pickle.dump(obj, f)
print("✅ Models saved to backend/models/")
