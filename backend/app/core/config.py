from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "HaushaltsRadar"
    api_v1_prefix: str = "/api/v1"
    debug: bool = False

    postgres_user: str = "haushaltsradar"
    postgres_password: str = "haushaltsradar"
    postgres_db: str = "haushaltsradar"
    postgres_host: str = "localhost"
    postgres_port: int = 5432

    secret_key: str = "change-me-to-a-long-random-string"
    access_token_expire_minutes: int = 30
    refresh_token_expire_days: int = 1
    # Longer lifetimes when "Angemeldet bleiben" is checked at login
    access_token_expire_minutes_remember: int = 60 * 12  # 12 hours
    refresh_token_expire_days_remember: int = 30
    password_reset_expire_minutes: int = 60
    algorithm: str = "HS256"

    bootstrap_admin_username: str = "admin"
    bootstrap_admin_password: str = "admin"
    seed_sample_data: bool = True

    cors_origins: str = "http://localhost:5173,http://localhost:3000,http://localhost:3080"
    # Public frontend URL for password-reset links (falls back to first CORS origin)
    frontend_public_url: str = ""

    @property
    def database_url(self) -> str:
        return (
            f"postgresql+psycopg2://{self.postgres_user}:{self.postgres_password}"
            f"@{self.postgres_host}:{self.postgres_port}/{self.postgres_db}"
        )

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    @property
    def resolved_frontend_url(self) -> str:
        explicit = (self.frontend_public_url or "").strip().rstrip("/")
        if explicit:
            return explicit
        origins = self.cors_origin_list
        return origins[0].rstrip("/") if origins else "http://localhost:3080"


@lru_cache
def get_settings() -> Settings:
    return Settings()
