CREATE TABLE IF NOT EXISTS users (
    id              BIGSERIAL      PRIMARY KEY,
    firebase_uid    VARCHAR(128)   NOT NULL UNIQUE,
    name            VARCHAR(50)    NOT NULL,
    like_categories TEXT[]         NOT NULL,
    created_at      TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS shops (
    id              BIGSERIAL        PRIMARY KEY,
    place_id        VARCHAR(255)     NOT NULL UNIQUE,
    name            VARCHAR(200)     NOT NULL,
    address         VARCHAR(500),
    lat             DOUBLE PRECISION NOT NULL,
    lng             DOUBLE PRECISION NOT NULL,
    primary_genre   VARCHAR(50),
    google_types    TEXT[]           NOT NULL,
    rating          REAL,
    review_count    INTEGER,
    price_level     SMALLINT,
    is_chain        BOOLEAN          NOT NULL,
    last_fetched_at TIMESTAMPTZ      NOT NULL DEFAULT NOW(),
    created_at      TIMESTAMPTZ      NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ      NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS diagnosis_logs (
    id                  BIGSERIAL   PRIMARY KEY,
    user_id             BIGINT      NOT NULL REFERENCES users(id),
    mood_genre          VARCHAR(50) NOT NULL,
    time_level          VARCHAR(20) NOT NULL,
    volume_level        VARCHAR(20) NOT NULL,
    recommended_shop_id BIGINT      REFERENCES shops(id),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- shops キャッシュ参照を高速化するためのインデックス
CREATE INDEX IF NOT EXISTS idx_shops_last_fetched_at
    ON shops (last_fetched_at DESC);

CREATE INDEX IF NOT EXISTS idx_shops_lat_lng
    ON shops (lat, lng);

CREATE INDEX IF NOT EXISTS idx_shops_genre_chain_last_fetched
    ON shops (primary_genre, is_chain, last_fetched_at DESC);
