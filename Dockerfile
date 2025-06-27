FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package files first for better caching
COPY package*.json ./
COPY src/api/package*.json ./src/api/

# Install dependencies
RUN cd src/api && npm ci --only=production

# Copy all source code
COPY . .

# Expose port
EXPOSE 3000

# Force rebuild by adding a unique layer
RUN echo "Business Agent System - $(date)" > /app/build-info.txt

# Start the application directly from the API directory
CMD ["node", "/app/src/api/src/basic-api.js"] 