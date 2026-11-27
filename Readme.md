portal-app/
├── index.html                  # エントリーポイント (ファビコン・メタタグ含む)
├── package.json                # 依存パッケージ定義
├── tsconfig.json               # TypeScript設定
├── vite.config.ts              # Vite設定 (GitHub Pagesのbaseパス等に注意)
├── tailwind.config.js          # Tailwind CSS設定
├── postcss.config.js           # PostCSS設定
├── firestore.rules             # 2名(+管理者)限定のセキュリティルール
└── src/
    ├── main.tsx                # React エントリーポイント
    ├── index.css               # Tailwind CSS 読み込み
    ├── firebase.ts             # Firebase 初期化・認証設定
    ├── types.ts                # タスク・ユーザー等のTypeScript型定義
    └── App.tsx                 # 7タブ・プロフィール・カレンダー・モーダル等の全機能統合