from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "KostenPilot"
    api_v1_prefix: str = "/api/v1"
    debug: bool = False

    postgres_user: str = "kostenpilot"
    postgres_password: str = "kostenpilot"
    postgres_db: str = "kostenpilot"
    postgres_host: str = "localhost"
    postgres_port: int = 5432

    secret_key: str = "change-me-to-a-long-random-string"
    access_token_expire_minutes: int = 30
    refresh_token_expire_days: int = 7
    algorithm: str = "HS256"

    bootstrap_admin_username: str = "admin"
    bootstrap_admin_password: str = "admin"
    seed_sample_data: bool = True

    cors_origins: str = "http://localhost:5173,http://localhost:3000"

    @property
    def database_url(self) -> str:
        return (
            f"postgresql+psycopg2://{self.postgres_user}:{self.postgres_password}"
            f"@{self.postgres_host}:{self.postgres_port}/{self.postgres_db}"
        )

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
