from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    supabase_url: str = ""
    supabase_key: str = ""

    # CORS origins
    cors_origins: list[str] = ["http://localhost:3000"]

    # Two-stage model weights
    full_model_path: str = "weights/best_full.pt"
    slice_model_path: str = "weights/best_slice.pt"

    # API limits
    max_upload_size_mb: int = 10

    # Window slicer parameters
    slice_height: int = 640
    slice_width: int = 640
    overlap_ratio: float = 0.2

    # DBSCAN clustering
    dbscan_eps: float = 30.0
    dbscan_min_samples: int = 1

    class Config:
        env_file = ".env"


@lru_cache()
def get_settings() -> Settings:
    return Settings()
