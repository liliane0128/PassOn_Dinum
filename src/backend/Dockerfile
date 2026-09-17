
# 1. Import the python base image
FROM python:3.13-slim

# 2. Changing the current working directory to /app
WORKDIR /app

# 3. Configure environment variable
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# 4. Install every dependency using the requirement.txt file
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 5. Copy every backend files into the current working directory
COPY . .

# 6. Expose the port 8000
EXPOSE 8000

# 7. Launching using an entrypoint
COPY entrypoint.sh /tmp
ENTRYPOINT [ "bash", "/tmp/entrypoint.sh" ]
