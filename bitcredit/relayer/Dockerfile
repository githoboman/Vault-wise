# Use Node.js LTS (Long Term Support) image
FROM node:18-slim

# Create and set the working directory
WORKDIR /app

# Copy package files first for better caching
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the application code
COPY . .

# Build the TypeScript code (if needed)
# Since the package.json has a start command using ts-node, we can also compile to JS for better production performance
RUN npm run build

# Expose the API port (from relayer/src/config.ts - 3001)
EXPOSE 3001

# Start the application using the compiled javascript
CMD ["node", "dist/index.js"]
