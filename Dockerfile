FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    curl \
    net-tools \
    nodejs \
    npm \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY src/ src/

ENV PYTHONPATH=/app
ENV INPUT_DIR=/data/input
ENV OUTPUT_DIR=/data/output
ENV ABS_URL=http://audiobookshelf:80
ENV UNBUFFERED=1

CMD ["python", "src/main.py"]
