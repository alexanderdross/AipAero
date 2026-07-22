# Health-dashboard app - a tiny FastAPI service for the Coolify box.
# Bind to 127.0.0.1 in the compose/Coolify config; it is reached ONLY through the
# cloudflared tunnel + Cloudflare Access, never a published host port.
FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY app.py ./

ENV HEALTH_API_BASE=https://aip.aero
# HEALTH_API_KEY (= the website CRON_SECRET) is injected as a Coolify env secret.
EXPOSE 8055

CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8055"]
