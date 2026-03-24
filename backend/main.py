import json
import os
from typing import Any, Dict, List

import firebase_admin
import joblib
from fastapi import FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from firebase_admin import auth, credentials, firestore
from pydantic import BaseModel

from predict import ModelInputMismatchError, predict_patient
from predict2 import predict_model2

def _init_firebase() -> None:
    if firebase_admin._apps:
        return
    service_account_json = os.getenv("FIREBASE_SERVICE_ACCOUNT_KEY")
    if service_account_json:
        cred = credentials.Certificate(json.loads(service_account_json))
    else:
        cred = credentials.Certificate("firebase-adminsdk.json")
    firebase_admin.initialize_app(cred)


def _allowed_origins() -> List[str]:
    origins_raw = os.getenv("FRONTEND_ORIGINS", "http://localhost:3000,https://simu-care.vercel.app")
    return [origin.strip() for origin in origins_raw.split(",") if origin.strip()]


_init_firebase()
db = firestore.client()

feature_columns = joblib.load("models/feature_columns.pkl")

app = FastAPI(title="SimuCare API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "https://*.vercel.app",
        "https://simu-care.vercel.app",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class PredictRequest(BaseModel):
    token: str
    data: Dict[str, Any]


@app.get("/")
async def root() -> Dict[str, str]:
    return {"status": "ok", "service": "SimuCare API"}


def get_risk_level(icu_risk: float) -> str:
    if icu_risk < 0.3:
        return "Low"
    if icu_risk <= 0.6:
        return "Moderate"
    return "High"


def verify_id_token(token: str) -> Dict[str, Any]:
    try:
        return auth.verify_id_token(token)
    except Exception as exc:
        raise HTTPException(status_code=401, detail="Invalid or expired Firebase token.") from exc


def build_feature_dict(form_data: Dict[str, Any]) -> Dict[str, float]:
    age = float(form_data["age"])
    vital_mean = float(form_data["vital_mean"])
    lab_mean = float(form_data["lab_mean"])
    diag_count = float(form_data["diag_count"])
    severity_index = float(form_data["severity_index"])
    is_male = int(form_data["is_male"])

    vital_std = vital_mean * 0.3
    vital_min = max(0.0, vital_mean - vital_std * 1.5)
    vital_max = vital_mean + vital_std * 1.5
    vital_count = 10.0
    lab_count = diag_count * 5.0
    lab_vital_ratio = lab_count / vital_count if vital_count > 0 else 1.0
    log_los = 3.5

    age_group_young = 1 if age < 35 else 0
    age_group_adult = 1 if 35 <= age < 60 else 0
    age_group_senior = 1 if age >= 60 else 0

    return {
        "diag_count": diag_count,
        "vital_mean": vital_mean,
        "vital_min": vital_min,
        "vital_max": vital_max,
        "vital_std": vital_std,
        "vital_count": vital_count,
        "lab_mean": lab_mean,
        "lab_count": lab_count,
        "age": age,
        "severity_index": severity_index,
        "lab_vital_ratio": lab_vital_ratio,
        "log_los": log_los,
        "is_male": is_male,
        "insurance_Medicare": 0,
        "insurance_Other": 0,
        "age_group_young": age_group_young,
        "age_group_adult": age_group_adult,
        "age_group_senior": age_group_senior,
    }


@app.get("/health")
def health() -> Dict[str, str]:
    return {"status": "ok"}


@app.get("/features")
def get_features() -> List[str]:
    return list(feature_columns)


@app.post("/predict")
async def predict(request: PredictRequest) -> Dict[str, Any]:
    decoded = verify_id_token(request.token)
    user_id = decoded["uid"]

    try:
        payload = build_feature_dict(request.data)
        result = predict_patient(payload)
    except ModelInputMismatchError as exc:
        raise HTTPException(status_code=400, detail="Model input mismatch — check feature list") from exc
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Prediction failed: {str(exc)}") from exc

    icu_risk = result["ICU_Risk"]
    if icu_risk < 0.3:
        risk_level = "Low"
    elif icu_risk <= 0.6:
        risk_level = "Moderate"
    else:
        risk_level = "High"

    try:
        db.collection("predictions").add(
            {
                "userId": user_id,
                "timestamp": firestore.SERVER_TIMESTAMP,
                "ICU_Risk": result["ICU_Risk"],
                "Readmission_Risk": result["Readmission_Risk"],
                "ICU_LOS_hours": result["ICU_LOS_hours"],
                "riskLevel": risk_level,
                "inputData": payload,
            }
        )
    except Exception as exc:
        print(f"Firestore save failed (non-blocking): {exc}")

    return {
        "ICU_Risk": result["ICU_Risk"],
        "Readmission_Risk": result["Readmission_Risk"],
        "ICU_LOS_hours": result["ICU_LOS_hours"],
        "riskLevel": risk_level,
        "firestore_saved": True,
        "inputData": payload,
    }


@app.get("/history/{user_id}")
def history(user_id: str, authorization: str = Header(default="")) -> List[Dict[str, Any]]:
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid Authorization header.")

    token = authorization.replace("Bearer ", "", 1).strip()
    decoded = verify_id_token(token)
    token_user_id = decoded.get("uid")

    if token_user_id != user_id:
        raise HTTPException(status_code=403, detail="You are not authorized to view this history.")

    items: List[Dict[str, Any]] = []
    try:
        query = (
            db.collection("predictions")
            .where("userId", "==", user_id)
            .order_by("timestamp", direction=firestore.Query.DESCENDING)
            .stream(retry=None, timeout=10)
        )
        for doc in query:
            data = doc.to_dict()
            data["id"] = doc.id
            items.append(data)
    except Exception as exc:
        print(f"History fetch failed (non-blocking): {exc}")

    return items


@app.post("/predict2")
async def predict2(data: dict) -> Dict[str, Any]:
    result = predict_model2(data)
    return result


if __name__ == "__main__":
    import uvicorn

    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port)
