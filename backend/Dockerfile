FROM python:3.11-slim

WORKDIR /app

# Install uv
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

# Copy dependency files
COPY pyproject.toml uv.lock* ./

# Install dependencies
RUN uv sync --frozen --no-dev

# Copy application code
COPY app ./app
COPY data ./data

# Create data directory for SQLite
RUN mkdir -p /app/data

# Expose port
EXPOSE 9000

# Run the application
CMD ["uv", "run", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "9000"]
