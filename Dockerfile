FROM node:22-bookworm-slim AS node-runtime
FROM python:3.12-slim-bookworm
COPY --from=node-runtime /usr/local/bin/node /usr/local/bin/node
COPY --from=node-runtime /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/npm
RUN ln -s /usr/local/lib/node_modules/npm/bin/npm-cli.js /usr/local/bin/npm && useradd --create-home --uid 1000 node
WORKDIR /app
COPY package.json package-lock.json ./
COPY backend/package.json backend/package.json
COPY frontend/package.json frontend/package.json
RUN npm ci --workspace backend --omit=dev --ignore-scripts
COPY pipeline/requirements.lock pipeline/requirements.lock
RUN python3 -m venv /opt/venv && /opt/venv/bin/pip install --no-cache-dir -r pipeline/requirements.lock
COPY backend backend
COPY pipeline pipeline
ENV NODE_ENV=production PYTHON_BIN=/opt/venv/bin/python PYTHONUNBUFFERED=1 PORT=4000
USER node
EXPOSE 4000
CMD ["node", "backend/src/server.js"]
