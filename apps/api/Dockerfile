FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY scripts/fetch-embedding-model.py ./scripts/fetch-embedding-model.py
RUN python scripts/fetch-embedding-model.py
COPY app ./app
ENV FILES_DIR=/data/files
RUN mkdir -p /data/files
EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
