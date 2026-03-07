# ShokuGenMAP

2026サポーターズハッカソンvol.1出場作品「食ジャンMAP」

## Dockerでの開発環境構築

前提:
- Docker Desktop がインストール済み
- `docker compose` が利用可能

## Firebase Auth（バックエンド検証）の準備

バックエンドで Firebase ID Token を検証するために、Firebase Admin SDK の**サービスアカウントJSON**が必要です。

手順（概要）:
- Firebase コンソール → プロジェクト設定 → サービスアカウント → **新しい秘密鍵を生成**
- 生成された JSON をローカルに保存（例: `./secrets/firebase-service-account.json`）
- Git には入れない（`secrets/` は作るなら `.gitignore` 推奨）

Docker で渡す例（`docker-compose.yml` の backend に追記する想定）:
- `GOOGLE_APPLICATION_CREDENTIALS=/secrets/firebase-service-account.json`
- `volumes` に `./secrets:/secrets:ro` を追加

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
