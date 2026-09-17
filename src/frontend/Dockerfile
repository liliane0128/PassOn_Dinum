
# 1. Import the nodeJS base image
FROM node:22-alpine

# 2. Change the default working directory to /frontend
WORKDIR /frontend

# 3. Copy every frontend content to the working directory
COPY src/frontend .

# 4. Perform a dependency clean installation and compile NEXT.js content
RUN npm ci
RUN npm run build

# 6. Expose the port 3001
EXPOSE 3001

# 7. Running the next.js server on port 3001
CMD ["npm", "run", "dev", "--", "-p", "3001"]
