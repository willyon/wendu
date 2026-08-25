from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "postgresql+psycopg://wendu:wendu@localhost:5432/wendu"
    session_secret: str = "change-me-to-a-long-random-string"
    cookie_secure: bool = False

    admin_user: str = "admin"
    admin_password: str = "admin"

    # 内置本地 Embedding 维度（multilingual-e5-small）
    default_embed_dim: int = 384
    text_embedding_local_path: str = ""
    vector_min_score: float = 0.28
    vector_strong_score: float = 0.38
    chunk_size: int = 500
    chunk_overlap: int = 80
    retrieve_k: int = 8

    files_dir: str = "data/files"

    public_web_url: str = "http://localhost:5173"


settings = Settings()
