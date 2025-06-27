FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY src/api/package*.json ./src/api/

# Install dependencies
RUN cd src/api && npm ci --only=production

# Copy source code
COPY . .

# Expose port
EXPOSE 3000

# Set working directory to API
WORKDIR /app/src/api

# Start the application
CMD ["npm", "start"] 