from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "postgresql+psycopg://wendu:wendu@localhost:5432/wendu"
    session_secret: str = "change-me-to-a-long-random-string"
    cookie_secure: bool = False

    admin_user: str = "admin"
    admin_password: str = "admin"

    text_embedding_local_path: str = ""
    vector_min_score: float = 0.28
    vector_strong_score: float = 0.38
    chunk_size: int = 500
    chunk_overlap: int = 80
    retrieve_k: int = 8

    files_dir: str = "data/files"


settings = Settings()
