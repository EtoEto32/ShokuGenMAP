FROM node:20-alpine

WORKDIR /app

# 依存関係定義のみ先にコピーしてインストール
COPY package*.json ./

# pnpm を有効化して依存関係をインストール
RUN corepack enable && corepack prepare pnpm@latest --activate && pnpm install

# アプリ本体をコピー
COPY . .

# pnpm で開発サーバーを起動
CMD ["pnpm", "dev", "--", "--host", "0.0.0.0", "--port", "5173"]
