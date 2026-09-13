# Frontend dev image. Source is bind-mounted at /app; node_modules lives in a named volume.
FROM node:24-alpine
WORKDIR /app
COPY dashboard/web/package*.json ./
RUN npm ci
EXPOSE 3000
CMD ["npm", "run", "dev", "--", "-H", "0.0.0.0"]
