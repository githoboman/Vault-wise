FROM node:18-slim

WORKDIR /app

# Copy package files from the sub-directory
COPY bitcredit/relayer/package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the relayer code from the sub-directory
COPY bitcredit/relayer/ .

# Build the project
RUN npm run build

# Expose the API port
EXPOSE 3001

# Start the relayer
CMD ["npm", "run", "start"]
