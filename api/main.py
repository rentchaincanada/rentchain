from fastapi import FastAPI

app = FastAPI(
    title="Rentchain Landlord API",
    version="0.1.0",
    description="Backend for landlord dashboard, tenant data, and credit reporting."
)

@app.get("/health")
def health_check():
    return {"status": "ok", "service": "rentchain-api"}
@app.get("/health/db")
def health_db():
    # Placeholder for now – later we’ll actually ping Firestore here.
    return {
        "status": "ok",
        "service": "rentchain-api",
        "database": "firestore-configured"
    }
