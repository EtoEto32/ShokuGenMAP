```
 ハッカソン期間中はP1実装まで目標、一区切り
```
# **ドキュメントのバージョン**

| バージョン     | 追加内容        | 記述日        |
| --------- | ----------- | ---------- |
| Ver.1.0.0 | 基本的な必要事項の追加 | 2026/02/26 |

# **テーマ**


## **誰のどんな課題を解決するのか？**

**既存の地図アプリにおける「情報のノイズ」と「検索・選択のストレス」を解消する。**

- **キーワード検索の限界: 「ラーメン」で検索しても、ラーメンを提供しているだけの居酒屋やファミレスが混ざり、純粋な専門店を見つけるのが面倒。**
- **検索プロセスの煩わしさ: 毎回「アプリの起動＞検索窓をタップ ＞ 文字入力 ＞ フィルタ設定」という工程を繰り返すのが、移動中や空腹時には大きな負担。**
- **選択肢過多（決定回避）: 候補が多すぎると、結局どこが良いか選べない。特に不慣れな土地や旅行先では、信頼できる「絞り込まれた情報」が求められている。**

## **ターゲット定義**

### **メインターゲット**

- **平日ランチの若手会社員（ペルソナ：[[新庄敦]]）**
- **学生（ペルソナ：[[篠山大輝]])**
- **観光客（ペルソナ：[[三木谷三四郎]]）**
- **効率主義な人、毎日が忙しい人（ペルソナ：[[宮田聡子]]）**
**→総じて優柔不断気味な人**
## **解決策**

**ユーザーが選択した「今食べたいジャンル」のみを地図上にアイコン表示し、現在地から半径3km以内に存在する該当飲食店のうち、（冒険度スライダー ）と 5秒飯診断 によってユーザーの意思決定方針（王道/発見）と状況（時間・気分・量）を反映した独自スコアで上位店舗を提示する、意思決定支援型地図Webアプリを開発する。**



# **機能要件**

- **P0：必須**
- **P1：ここまで実装することを想定**
- **P2：可能であれば実装したい**

## **ログイン機能**

- **会員登録ができる(P0)**
- **ユーザー名、パスワード登録する(P0)**

**ログイン状態でのみ、以下の機能が利用できる。**

- **好きなご飯ジャンルをプロフィールに登録（P0）**
- **レポート機能（P2）**


## **ユーザーフロー（DX）**

- **何かしらボタンを押すたびにアニメーションを入れたい。(P1)**
- **5秒飯診断の質問遷移（3問）に軽量アニメーションを入れる（P1）**
- **冒険度スライダー操作時に地図上候補（TOP3）が即時更新されるようにする（P1）**


## **デフォルト表示機能**
- **食事ジャンルごとにフィルターを設けて表示可能（P0）**
- **全国チェーン店を抜きにする機能（P0）**
- **現在地の3km以内のジャンルをデフォルト表示（P0）**

## **レコメンド機能**

- **冒険度スライダー（保守〜冒険）に応じてランキング結果が変化する（P2）**
- **5秒飯診断の回答結果に応じて「即1店舗」提示（TOP1固定提示）を行う（P1）**

## **5秒飯診断（P1：追加）**

### **概要**

**3問の質問に答えるだけで、ユーザー状況に合う店舗を「即1店舗」提示する導線を提供する。**

**（診断＝即決のため、複数提示はしない）**

### **質問（3問）**

- **Q1：今の気分？（例：ラーメン /うどん / そば/ご飯もの）**
- **Q2：時間ある？（例：すぐ / 少し / 余裕）**
- **Q3：量は？（例：少なめ / 普通 / 多め）**

### **推薦ロジック**

- **Q2で最大距離（徒歩圏）を制限**
- **Q1でカテゴリ重み付け**
- **Q3で価格帯 or 店タイプを補正**
- **最終的に score最大の1件 を返す**

### **UX仕様**

- **診断開始ボタンをホームに配置**
- **質問は1画面1問でテンポ良く**
- **結果画面：**
    - **店名、距離、評価、価格帯**
    - **「地図で見る」「ルート」「もう一回」**



## **レポート機能（いずれもP2）（更新なし）**

- **お気に入りのお店機能**
- **自分だけのメモ機能**
- **友達に共有機能**
- **OGP対応**
- **下書き機能**
- **プロフィールアイコン設定機能**


## **冒険度スライダー（P2：追加）**

### **概要**

**ユーザーが「確実に外したくない（保守）」〜「新規開拓したい（冒険）」をスライダーで指定し、ランキングのスコアリングに反映する。**

### **仕様**

- **UI：`保守 ◀────▶ 冒険` のスライダー（0〜1）**
- **デフォルト：0.3（やや保守）**
- **反映範囲：ランキング計算（TOP3 / TOP1）**
- **永続化：**
    - **P1ではフロントのstate保持でも可**
    - **余力あればユーザープロフィールに保存（P2扱いでもOK）**
# **画面遷移図（最低限の追加案）**

**P1まで想定の最小構成：**
- **ログイン**
- **ホーム（地図＋5秒診断＋ルーティング機能）**
- **5秒診断（Q1→Q2→Q3→結果TOP1）**
- **レポート機能**
**[https://miro.com/welcomeonboard/SmNYRVdlZ3lIRWthR3pNRFc1elBLSmVWZStnVzd2N3c1RGhBSWpzazJpaEtWemgwWkJpSndpRzliYUFtRmRreW41c0hwdXcxQlozYjREZEx6T1N6VjlmRGd0SkJDRHlzVnZ6MU95YnE3aTZBMzQzODF1ZUxVSlRrSExZQXhCVnZBS2NFMDFkcUNFSnM0d3FEN050ekl3PT0hdjE=?share_link_id=476971813021](https://miro.com/welcomeonboard/SmNYRVdlZ3lIRWthR3pNRFc1elBLSmVWZStnVzd2N3c1RGhBSWpzazJpaEtWemgwWkJpSndpRzliYUFtRmRreW41c0hwdXcxQlozYjREZEx6T1N6VjlmRGd0SkJDRHlzVnZ6MU95YnE3aTZBMzQzODF1ZUxVSlRrSExZQXhCVnZBS2NFMDFkcUNFSnM0d3FEN050ekl3PT0hdjE=?share_link_id=476971813021)**

## **リリース**

- **ローカル内で何とか頑張る（P0）**
- **フロントエンド（vercel）,バックエンド（vercel）,認証（firebaseで頑張る）（P1)**
- **余力あったらawsにデプロイでもいい（P2）**

**→正味クラウドに詳しくなりたいのが本音なので、最初はマネジメントコンソールで雰囲気を掴む。**


# **ユースケース図**




# **ワイヤーフレーム（プロトタイプ）**

**https://stitch.withgoogle.com/projects/6791140056059987641**



# **テーブル定義**（P1まで実装する例）

## **users**
| カラム名            | 型            | 制約               | 説明           |
| --------------- | ------------ | ---------------- | ------------ |
| id              | BIGSERIAL    | PK               | 内部ユーザーID     |
| firebase_uid    | VARCHAR(128) | NOT NULL, UNIQUE | Firebase UID |
| name            | VARCHAR(50)  | NOT NULL         | 表示名          |
| like_categories | TEXT[]       | NOT NULL         | 好きジャンル配列     |
| created_at      | TIMESTAMPTZ  | NOT NULL         | 作成日時         |
| updated_at      | TIMESTAMPTZ  | NOT NULL         | 更新日時         |
### **shops(飲食店)**
| カラム名            | 型                | 制約               | 説明              |
| --------------- | ---------------- | ---------------- | --------------- |
| id              | BIGSERIAL        | PK               | 内部ID            |
| place_id        | VARCHAR(255)     | NOT NULL, UNIQUE | Google place_id |
| name            | VARCHAR(200)     | NOT NULL         | 店舗名             |
| address         | VARCHAR(500)     |                  | 住所              |
| lat             | DOUBLE PRECISION | NOT NULL         | 緯度              |
| lng             | DOUBLE PRECISION | NOT NULL         | 経度              |
| primary_genre   | VARCHAR(50)      |                  | アプリ内ジャンル        |
| google_types    | TEXT[]           | NOT NULL         | Google types    |
| rating          | REAL             | 0〜5              | 評価              |
| review_count    | INTEGER          | >=0              | 口コミ数            |
| price_level     | SMALLINT         | 0〜4              | 価格帯             |
| is_chain        | BOOLEAN          | NOT NULL         | 全国チェーン判定        |
| last_fetched_at | TIMESTAMPTZ      | NOT NULL         | API取得日時         |
| created_at      | TIMESTAMPTZ      | NOT NULL         | 作成日時            |
| updated_at      | TIMESTAMPTZ      | NOT NULL         | 更新日時            |
### diagnosis_logs
| カラム名                | 型           | 制約           | 説明     |
| ------------------- | ----------- | ------------ | ------ |
| id                  | BIGSERIAL   | PK           | ID     |
| user_id             | BIGINT      | FK(users.id) | ユーザー   |
| mood_genre          | VARCHAR(50) | NOT NULL     | Q1     |
| time_level          | VARCHAR(20) | NOT NULL     | Q2     |
| volume_level        | VARCHAR(20) | NOT NULL     | Q3     |
| recommended_shop_id | BIGINT      | FK(shops.id) | 推薦結果   |
| created_at          | TIMESTAMPTZ | NOT NULL     | 作成日時   |

# **ER図**



# **使用技術**

## **プログラミング言語**

- **Typescript**
- **Python**
- **PostgreSQL**

## **フレームワーク**

- **React**
- **FastAPI**

## **ライブラリ**

### **データフェッチ関連**

### **UI 全般**

- **Tailwind CSS**
- **CSS Modules**

### **フォーム関連**

- **React Hook From**
- **Zod**

### **認証関連**

- **Firebase Auth**

### **Google Map**

- **Google Map**

## **データベース**

- **Postgre SQL**

## **インフラ**

- **Docker**
- **Docker-compose**
- **Vercel (フロントエンド)**
- **Vercel(バックエンド)**

## **バージョン管理**

- **Git/GitHub**

## **CI/CD**

- **GitHub Actions**

## **エラー監視**

- **Sentry**

# **非機能要件**

- **スマホに対応(P0)**
- **個人情報はなるべく収集しない(P0)**
- **PC に対応(P1)**
- **タブレットに対応(P2)**
- **バックエンドのサーバーとデータベースを冗長化し、アクセスの集中時や災害時のリスクを軽減する(P2)**
- **エラーを監視し、早期に対応できるようにする(P2)**
- **React NativeやExpoで最終的にスマホアプリに移行（P2）**

# 技術調査

## GoogleMapAPI料金体系
[[GoogleMapAPI料金体系]]
