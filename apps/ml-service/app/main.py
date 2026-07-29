from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.routes import health, predictions, anomalies, nlp

app = FastAPI(
    title="CommerceOps AI - ML Service",
    description="Microservicio de Machine Learning, NLP y detección de anomalías para CommerceOps AI",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router, tags=["Health"])
app.include_router(predictions.router)
app.include_router(anomalies.router)
app.include_router(nlp.router)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
