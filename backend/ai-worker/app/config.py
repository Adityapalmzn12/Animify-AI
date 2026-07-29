from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    redis_url: str = "redis://localhost:6379/0"
    celery_queue: str = "animify.video.process"

    work_dir: str = "/tmp/animify-worker"
    comfyui_url: str = "http://comfyui:8188"
    prefer_gpu: bool = True

    supabase_url: str = ""
    supabase_secret_key: str = ""
    supabase_storage_bucket: str = "animify-videos"

    # NestJS callback (optional)
    api_callback_url: str = ""
    api_internal_token: str = ""


@lru_cache
def get_settings() -> Settings:
    return Settings()
