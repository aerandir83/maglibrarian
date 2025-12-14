# Deployment

AutoLibrarian is designed to run in a Docker container.

## Docker Compose

The easiest way to run AutoLibrarian is using Docker Compose.

```yaml
version: "3.8"
services:
  autolibrarian:
    build: .
    image: autolibrarian:latest
    container_name: autolibrarian
    environment:
      - INPUT_DIR=/input
      - OUTPUT_DIR=/output
      - ABS_URL=http://audiobookshelf:80
      - ABS_API_KEY=your_api_key_here
      - PUID=1000
      - PGID=1000
    volumes:
      - /path/to/your/input:/input
      - /path/to/your/audiobooks:/output
    restart: unless-stopped
```

## Volumes

- `/input`: Map this to the folder where you will drop new audiobooks.
- `/output`: Map this to your organized audiobook library (the same one Audiobookshelf watches).

## Permissions

Ensure the `PUID` and `PGID` environment variables match the user that owns the `/output` directory on your host machine. This ensures that AutoLibrarian can write to the directory and that Audiobookshelf can read the files.

## Running

1. Create `docker-compose.yml`.
2. Run `docker-compose up -d`.
3. Check logs with `docker-compose logs -f`.
