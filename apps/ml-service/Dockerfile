FROM python:3.11-slim

WORKDIR /app

COPY apps/ml-service/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY apps/ml-service/app ./app
COPY data/models ./data/models
COPY data/processed ./data/processed

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
