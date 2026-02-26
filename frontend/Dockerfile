FROM node:22-alpine

WORKDIR /app

# Install dependencies first (better caching)
COPY package.json package-lock.json ./
# Clean up cache to reduce layer size
RUN npm install && npm cache clean --force

# Copy source code
COPY . .

# Expose Vite dev server port
EXPOSE 5173

# Start dev server with --host to allow external access
CMD ["npm", "run", "dev", "--", "--host"]
