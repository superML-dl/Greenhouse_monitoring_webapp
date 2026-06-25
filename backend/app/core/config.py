from pydantic_settings import BaseSettings
from pydantic import field_validator
from functools import lru_cache
import json


class Settings(BaseSettings):
    supabase_url: str = ""
    supabase_key: str = ""

    # CORS origins — additional origins can be set via CORS_ORIGINS env var on Render
    # Vercel domains are handled via allow_origin_regex in main.py
    cors_origins: list[str] = [
        "http://localhost:3000",
    ]

    @field_validator("cors_origins", mode="before")
    @classmethod
    def assemble_cors_origins(cls, v: str | list[str]) -> list[str]:
        if isinstance(v, str):
            if v.strip().startswith("["):
                try:
                    return json.loads(v)
                except Exception:
                    pass
            return [i.strip() for i in v.split(",") if i.strip()]
        return v

    # Two-stage model weights
    full_model_path: str = "weights/best_full.pt"
    slice_model_path: str = "weights/best_slice.pt"

    # API limits
    max_upload_size_mb: int = 10

    # Window slicer parameters
    slice_height: int = 640
    slice_width: int = 640
    overlap_ratio: float = 0.2
    debug_slicing: bool = False

    # DBSCAN clustering
    dbscan_eps: float = 30.0
    dbscan_min_samples: int = 1

    class Config:
        env_file = ".env"


@lru_cache()
def get_settings() -> Settings:
    return Settings()
