# ShokuGenMAP

2026サポーターズハッカソンvol.1出場作品「食ジャンMAP」

## Dockerでの開発環境構築

前提:
- Docker Desktop がインストール済み
- `docker compose` が利用可能

起動:

```bash
docker compose up --build
```

アクセス先:
- Frontend: `http://localhost:5173`
- Backend: `http://localhost:8000`
- Backend Healthcheck: `http://localhost:8000/health`
- PostgreSQL: `localhost:5432`

停止:

```bash
docker compose down
```
