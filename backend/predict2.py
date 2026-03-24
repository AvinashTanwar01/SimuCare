import os
import pickle

import numpy as np

_BASE = os.path.join(os.path.dirname(__file__), "models")


def _load(n):
    p = os.path.join(_BASE, n)
    return pickle.load(open(p, "rb")) if os.path.exists(p) else None


_cm = _load("cost_model.pkl")
_cc = _load("cost_classifier.pkl")
_cs = _load("cost_scaler.pkl")
_ct = _load("cost_threshold.pkl")
_cf = _load("cost_features.pkl")
READY = all([_cm, _cc, _cs, _ct, _cf])


def predict_model2(d: dict) -> dict:
    if not READY:
        return {
            "predicted_cost": None,
            "high_cost_flag": None,
            "confidence": None,
            "details": "Run train_cost_model.py to enable Model 2",
        }
    try:
        age = float(d.get("age", 0))
        gender_raw = str(d.get("gender", d.get("sex", "male"))).lower()
        gender = 1 if gender_raw == "male" else 0
        bmi = float(d.get("bmi", 0))
        children = float(d.get("children", 0))
        region = str(d.get("region", "northeast")).lower().replace(" ", "")
        discount_raw = str(d.get("discount_eligibility", "no")).lower()
        discount_eligibility = discount_raw in {"yes", "true", "1", "eligible"}
        input_expenses = d.get("expenses")
        input_premium = d.get("premium")
        X = np.array(
            [
                [
                    age,
                    gender,
                    bmi,
                    children,
                    1 if discount_eligibility else 0,
                    1 if region == "northeast" else 0,
                    1 if region == "northwest" else 0,
                    1 if region == "southeast" else 0,
                    1 if region == "southwest" else 0,
                ]
            ]
        )
        cost = float(_cm.predict(_cs.transform(X))[0])
        cost = max(0, round(cost, 2))
        flag = bool(_cc.predict(X)[0] == 1)
        conf = round(float(_cc.predict_proba(X)[0][1]) * 100, 1)
        premium_estimate = round(cost / 100, 4)
        return {
            "predicted_cost": cost,
            "high_cost_flag": flag,
            "confidence": conf,
            "threshold": float(_ct),
            "discount_eligibility": discount_eligibility,
            "expenses_input": float(input_expenses) if input_expenses is not None else None,
            "premium_input": float(input_premium) if input_premium is not None else None,
            "premium_estimate": premium_estimate,
            "parsed_input": {
                "age": age,
                "gender": "male" if gender == 1 else "female",
                "bmi": bmi,
                "children": children,
                "region": region,
                "discount_eligibility": discount_eligibility,
            },
            "details": "OK",
        }
    except Exception as e:
        return {"predicted_cost": None, "high_cost_flag": None, "confidence": None, "details": str(e)}
