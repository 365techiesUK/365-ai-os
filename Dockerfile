# 365 Techies AI OS — production image
FROM node:20-slim
WORKDIR /app
ENV NODE_ENV=production

# Install only production deps using the lockfile (reproducible)
COPY package*.json ./
RUN npm ci --omit=dev

# App source
COPY . .

# The server reads PORT from the environment (defaults to 4000)
EXPOSE 4000
CMD ["node", "server.js"]
