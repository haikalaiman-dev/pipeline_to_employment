# Backend image: FastAPI + bun (portal CLIs) + claude CLI (headless slash commands)
# + TeX Live (upstream CI's proven package list) + Playwright Chromium.
FROM python:3.13-slim-bookworm
ARG UID=1000

ENV DEBIAN_FRONTEND=noninteractive \
    PLAYWRIGHT_BROWSERS_PATH=/ms-playwright \
    BUN_INSTALL=/usr/local \
    PIP_NO_CACHE_DIR=1

RUN apt-get update && apt-get install -y --no-install-recommends \
      curl ca-certificates git unzip xvfb \
      texlive-luatex texlive-latex-extra texlive-xetex texlive-fonts-extra texlive-fonts-recommended \
      poppler-utils \
 && curl -fsSL https://deb.nodesource.com/setup_24.x | bash - \
 && apt-get install -y --no-install-recommends nodejs \
 && npm install -g @anthropic-ai/claude-code \
 && curl -fsSL https://bun.sh/install | bash \
 && rm -rf /var/lib/apt/lists/*

COPY dashboard/api/requirements.txt /tmp/requirements.txt
RUN pip install -r /tmp/requirements.txt \
 && playwright install --with-deps chromium \
 && rm -rf /var/lib/apt/lists/*

# non-root: bind-mounted files keep the host owner and `claude --permission-mode bypassPermissions` refuses root
RUN useradd -m -u ${UID} app && chmod -R a+rX /ms-playwright
USER app
WORKDIR /work
EXPOSE 8000
CMD ["uvicorn", "dashboard.api.main:app", "--host", "0.0.0.0", "--port", "8000"]
