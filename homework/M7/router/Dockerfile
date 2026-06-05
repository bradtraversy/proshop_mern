FROM ghcr.io/berriai/litellm:main-stable

WORKDIR /app

COPY pii_router.py /app/pii_router.py
COPY config.yaml /app/config.yaml

ENV PYTHONPATH=/app

EXPOSE 4000

CMD ["--config", "/app/config.yaml", "--port", "4000"]
