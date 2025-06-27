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

# Create a startup script
RUN echo '#!/bin/sh\ncd /app/src/api\nnpm start' > /app/start.sh && chmod +x /app/start.sh

# Start the application
CMD ["/app/start.sh"] 