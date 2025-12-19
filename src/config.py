from pydantic_settings import BaseSettings
from pydantic import field_validator
from typing import Set, List

class Settings(BaseSettings):
    INPUT_DIR: str = "/data/input"
    OUTPUT_DIR: str = "/data/output"
    ABS_URL: str = "http://localhost:8080"
    ABS_API_KEY: str = ""
    STABILITY_CHECK_DURATION: int = 60
    ALLOWED_EXTENSIONS: Set[str] = {'.m4b', '.mp3', '.m4a', '.flac', '.opus', '.wma', '.epub', '.pdf', '.jpg', '.png'}
    
    # Thresholds
    MATCH_THRESHOLD_AUTOMATIC: int = 90
    MATCH_THRESHOLD_PROBABLE: int = 70
    
    # Permissions
    PUID: int = 1000
    PGID: int = 1000
    
    # Operations
    DRY_RUN: bool = False
    
    METADATA_PROVIDERS: List[str] = ["openlibrary", "googlebooks", "audible"]
    
    # Web UI
    WEB_UI_ENABLED: bool = True
    WEB_PORT: int = 3000
    API_PORT: int = 8000
    
    # Conversion
    CONVERT_TO_M4B: bool = True
    FFMPEG_PATH: str = "ffmpeg"
    FFMPEG_HW_ACCEL: str = "auto"
    AUDNEXUS_URL: str = "https://api.audnexus.com"

    @field_validator("METADATA_PROVIDERS", mode="before")
    @classmethod
    def parse_providers(cls, v):
        if isinstance(v, str):
            return [p.strip() for p in v.split(",") if p.strip()]
        return v

    class Config:
        env_file = ".env"
        extra = "ignore"

config = Settings()
