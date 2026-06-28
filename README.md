# CreateXP - クリエイター作業量トラッキング＆ランキングシステム

本ファイルは、CreateXPプロジェクトの機能要件、システム構成、およびデータ構造をまとめた要件定義書（必読ファイル）です。

---

## 1. プロジェクト概要
CreateXPは、クリエイター（デザイナー、映像制作者など）の日常的な作業をゲーム化（ゲーミフィケーション）し、制作作業量に応じてXP（経験値）を付与し、クリエイター間でのランキング形式でモチベーションを高めるシステムです。
本システムは、ローカルフォルダ内の作業ファイルを監視するデスクトップクライアントと、ランキングやユーザー個人の実績・ログを表示するWebダッシュボードの2種類のアプリケーションで構成されます。

---

## 2. システム構成・アーキテクチャ
システムは、フロントエンド、デスクトップクライアント、バックエンドデータベースで構成されています。

* デスクトップアプリ (CreateXP Tracker): Electron
  * ローカルの作業ディレクトリを監視し、イベントを検知してFirebaseにデータを送信します。
* Webダッシュボード (CreateXP Dashboard): Next.js (TypeScript, Tailwind CSS, Framer Motion)
  * 全ユーザーのランキング表示、個人の詳細プロフィール（実績、活動ログ）および各種プロフィールの設定を行います。
* クラウドバックエンド: Firebase
  * Firebase Authentication: ユーザーの認証管理を行います。
  * Cloud Firestore: ユーザーのXP、レベル、プロフィール情報、アクティビティログをリアルタイムで保存・管理します。
  * Firebase Storage: ユーザーのアバター（プロフィール画像）の保存に使用します。

---

## 3. アプリケーション別要件

### 3.1 CreateXP Tracker（Electronクライアント）
クリエイターの作業PC上で常駐動作し、作業フォルダを自動で監視して活動を検知します。

#### 3.1.1 機能要件
* ユーザー認証
  * Firebase Authenticationを使用したメールアドレスおよびパスワードによるログイン。
  * ログイン成功時、ローカルの設定ファイル（userData配下の createxp_config.json）に暗号化されていない認証情報を保存し、次回起動時の自動ログインに対応。
  * ログアウト時にローカルの設定ファイルを破棄。
* 作業フォルダの監視（アクティビティトラッキング）
  * ../Work フォルダが存在しない場合は自動作成し、このフォルダ内の変更を chokidar ライブラリで監視。
  * ファイル保存イベント（Save）の検知:
    * 対象拡張子: .psd, .prproj, .aep
    * 検知方法: 監視フォルダ内のファイルの change イベントを検知。
    * チャタリング防止: 頻繁な保存によるXPの過剰付与を防ぐため、同一ファイルに対して3秒間のディレイ（デバウンス）を適用。
    * 獲得XP: 5 XP / 回。
  * ファイル新規追加・書き出しイベント（Export）の検知:
    * 対象拡張子: .mp4, .mov, .mxf, .avi
    * 検知方法: 監視フォルダ内のファイルの add イベントを検知。
    * 完了判定ロジック: 一時ファイルなどの書き出し途中の状態を除外するため、5秒間にわたりファイルサイズが継続して増加しているかをインターバルで監視。判定スコア（ファイルサイズ増加、増加回数、ファイル容量）が基準値（5以上）を満たした場合に書き出し完了とみなす。
    * 獲得XP: 50 XP / 回。
* ユーザーインターフェース (UI)
  * ステータスバッジ: 監視中の状態（● Monitoring）と停止状態（○ Stopped）を視覚的に表示。
  * レベル・XP表示: 現在のレベル（LV.x）、累積XP、進行状況を示すプログレスバーを表示。
  * デイリークエスト進捗:
    * 💾 Save 5 files (保存5回)
    * 🎬 Export a video (書き出し1回)
  * 簡易ログコンソール: 最新10件までの獲得XPログ（イベントタイプ、対象ファイル名、獲得XP）を表示。
* システム連携とトレイ常駐
  * ウィンドウ of クローズ（Xボタン）時はアプリケーションを終了せず、ウィンドウを非表示（タスクトレイに格納）にする。
  * タスクトレイ（システムトレイ）アイコンを表示し、右クリックメニューから「Dashboardの表示」および「アプリ終了（Quit）」を操作可能にする。
  * XP獲得時にOSのネイティブシステム通知（Notification）を表示。

#### 3.1.2 非機能要件
* リアルタイム連携: Firestoreのドキュメントをリアルタイムリスナー（onSnapshot）で監視し、ダッシュボード等でXPが変動した際も即座にTrackerのUIに反映させる。

---

### 3.2 CreateXP Dashboard（Next.js Webアプリ）
ユーザー同士の競争を促進し、自己プロフィールや実績を確認するためのWebインターフェースです。

#### 3.2.1 機能要件
* グローバルランキング表示 (RankingPage)
  * ユーザーの総獲得XPに基づいて、最大上位50名のランキングをソートして表示。
  * 期間別フィルター機能:
    * Total（総合）
    * Monthly（月間）
    * Weekly（週間）
    * Daily（日間）
  * 期間集計のロジック: activities サブコレクションから各ユーザーの該当期間内のアクティビティドキュメントを取得し、そのXPを合計してランキングを再ソートする。
  * UIデザイン: 上位3名は特別な王冠やメダル、大きめのカードで強調表示し、4位以降はテーブル形式で表示。
  * クリエイター詳細モーダル: ランキング行をクリックした際、対象クリエイターの実績、SNSリンク、アクティビティ履歴を閲覧可能にする。
* マイページ機能 (MyPage)
  * 現在のレベル（100 XPごとに1レベル上昇）、プログレスバー、次のレベルまでの必要XPを表示。
  * 開発用アクティビティシミュレータ: テスト用にSaveおよびExportを仮想実行し、FirestoreへログとXPを直接書き込めるデバッグ用ボタン。
  * 最近のアクティビティ履歴: 自身の直近5件のアクティビティをカード形式で一覧表示。
  * 実績システム: ロック解除条件を持つドット絵風バッジを表示。過去のデータに基づいて、ロード時に自動で未解除の実績を判定し解除するロジックを実装。
* アカウント・プロフィール設定 (Settings)
  * クリエイター名の変更: 「表示名#4桁タグ」の形式を採用。タグは自動付与され変更不可。
  * アバター画像の変更: ファイル選択からFirebase Storageへ直接アップロード（最大3MB制限）。
  * SNSリンクの登録: InstagramおよびX（旧Twitter）のURLを設定可能。
  * プライバシー設定:
    * アクティビティの非公開設定（他ユーザーへのログ非公開）。
    * ランキング非表示設定（グローバルランキングから自身の情報を完全に隠す）。

---

## 4. データベース設計（Cloud Firestore）

### 4.1 users コレクション
各クリエイターの基本情報およびステータスを管理します。

* パス: users/{uid}
* フィールド定義:
  * displayName (string): クリエイター表示名（例: CreatorName#5678）
  * photoURL (string): プロフィール画像のFirebase Storageリンク
  * totalXP (number): 累積獲得XP
  * level (number): レベル（totalXP / 100）
  * activityCount (number): 総アクティビティ回数
  * achievements (array of string): 解除済み実績IDの配列
  * socialInstagram (string): InstagramのプロフィールURL
  * socialX (string): XのプロフィールURL
  * hideActivity (boolean): アクティビティ履歴の非公開設定（trueで非公開）
  * hideFromRanking (boolean): ランキングへの非表示設定（trueで非表示）
  * lastActivity (timestamp): 最終的な活動検知日時

### 4.2 activities サブコレクション
各ユーザーの活動ごとのログを保持します。

* パス: users/{uid}/activities/{activityId}
* フィールド定義:
  * type (string): アクションタイプ（"Save" または "Export"）
  * file (string): 対象となったファイル名（拡張子含む）
  * xp (number): そのアクションで付与されたXP（5 または 50）
  * timestamp (timestamp): イベント発生日時

---

## 5. タスクチェックリスト（優先度順）

優先度の基準: **P1** = コア機能・なければ動かない / **P2** = 重要だが代替あり / **P3** = UX改善・拡張機能

### P1 インフラ・認証基盤

- [x] 1. Firebase プロジェクトのセットアップ（Auth / Firestore / Storage）
- [x] 2. `.env.local` による環境変数管理（Tracker・Dashboard 双方）
- [x] 3. Dashboard: Firebase 初期化モジュール（`lib/firebase.ts`）
- [x] 4. Tracker: Firebase 初期化（`main.js` 内 initializeApp）
- [x] 5. Dashboard: メール・パスワードによるサインアップ機能（`LoginModal.tsx`）
- [x] 6. Dashboard: ログイン機能（`LoginModal.tsx`）
- [x] 7. Dashboard: ログアウト機能（`Header.tsx`）
- [x] 8. Tracker: メール・パスワードによるログイン機能
- [x] 9. Tracker: ローカル設定ファイルによる自動ログイン
- [x] 10. Tracker: ログアウト時のローカル設定ファイル削除

### P1 トラッカーコア機能

- [x] 11. Tracker: `../Work` フォルダの自動作成と chokidar による監視開始
- [x] 12. Tracker: ファイル保存イベント（.psd / .prproj / .aep）の検知
- [x] 13. Tracker: 保存イベントの 3 秒デバウンス処理（チャタリング防止）
- [x] 14. Tracker: ファイル書き出しイベント（.mp4 / .mov / .mxf / .avi）の検知
- [x] 15. Tracker: 書き出し完了判定アルゴリズム（5 秒間サイズ変動スコアリング）
- [x] 16. Tracker: XP イベント発生時に Firestore `activities` サブコレクションへログ書き込み
- [x] 17. Tracker: Firestore `users` ドキュメントの `totalXP` を increment で更新
- [x] 18. Tracker: Firestore リアルタイムリスナー（onSnapshot）による XP 同期
- [x] 19. Tracker: ログイン状態変化に応じた監視開始・停止制御

### P1 ダッシュボード コア機能

- [x] 20. Dashboard: グローバルランキングページ（`page.tsx` / RankingPage）
- [x] 21. Dashboard: ランキングのリアルタイム取得（onSnapshot、上位 100 名）
- [x] 22. Dashboard: 総合 XP によるランキングソートと上位 50 名表示
- [x] 23. Dashboard: マイページ（`mypage/page.tsx` / MyPage）
- [x] 24. Dashboard: マイページの認証ガード（未ログイン時にトップへリダイレクト）
- [x] 25. Dashboard: マイページでのレベル・XP・プログレスバー表示
- [x] 26. Dashboard: マイページでの直近 5 件アクティビティログ表示
- [x] 27. Dashboard: Firestore ユーザーデータのリアルタイム同期（onSnapshot）
- [x] 28. Dashboard: 新規登録時の Firestore ユーザードキュメント初期化

### P1 UI コア

- [x] 29. Dashboard: 共通ヘッダー（ナビゲーション・ログイン状態表示）
- [x] 30. Tracker: ステータスバッジ（Monitoring / Stopped）の表示
- [x] 31. Tracker: レベル・XP・プログレスバーの UI 表示
- [x] 32. Tracker: デイリークエスト進捗表示（保存 0/5・書き出し 0/1）
- [x] 33. Tracker: アクティビティログコンソール（最新 10 件）
- [x] 34. Tracker: システムトレイ常駐・Xボタンで最小化
- [x] 35. Tracker: トレイアイコンの右クリックメニュー（表示 / 終了）
- [x] 36. Tracker: XP 獲得時の OS ネイティブ通知

### P2 ユーザープロフィール機能

- [x] 37. Dashboard: プロフィール設定画面（Settings タブ）
- [x] 38. Dashboard: 表示名の変更（名前#タグ形式を保持して更新）
- [x] 39. Dashboard: アバター画像のアップロード（Firebase Storage、3MB 制限）
- [x] 40. Dashboard: SNS リンク登録（Instagram / X）
- [x] 41. Dashboard: プライバシー設定（アクティビティ非公開 / ランキング非表示）
- [x] 42. Dashboard: ヘッダーでのアバター・表示名のリアルタイム反映
- [x] 43. Dashboard: ランキングでの `hideFromRanking` フィルタリング

### P2 ランキング拡張

- [x] 44. Dashboard: 期間別ランキング切り替え（Total / Monthly / Weekly / Daily）
- [x] 45. Dashboard: 期間別 XP 集計ロジック（activities サブコレクションの timestamp フィルタ）
- [x] 46. Dashboard: 上位 3 名の強調表示（王冠・メダルアイコン）
- [x] 47. Dashboard: クリエイター詳細モーダル（UserProfileModal.tsx）
- [x] 48. Dashboard: モーダルでの実績・SNS リンク・直近アクティビティ表示
- [x] 49. Dashboard: モーダルでの `hideActivity` による非公開制御

### P2 実績システム

- [x] 50. Dashboard: 実績定義（achievements.ts / 11 種類）
- [x] 51. Dashboard: マイページでのドット絵風実績バッジ表示
- [x] 52. Dashboard: XP 獲得・アクティビティ記録時のリアルタイム実績解除判定
- [x] 53. Dashboard: 初回ロード時の遡及自動実績解除チェック（2 秒遅延）
- [x] 54. Dashboard: 開発用アクティビティシミュレータ（Save / Export ボタン）

### P3 品質・運用

- [x] 55. Dashboard: Next.js プロジェクトとしての基本セットアップ（Outfit フォント・グローバル CSS）
- [x] 56. Dashboard: SEO メタデータ設定（`layout.tsx` / title・description）
- [x] 57. Tracker: Electron のプリロードスクリプト（contextIsolation / contextBridge）
- [x] 58. セキュリティ改善: Tracker のローカル設定ファイルに保存するパスワードの暗号化
- [x] 59. Tracker: デイリークエスト進捗のFirestore連携（現状はセッションローカル管理）
- [x] 60. Tracker: ログイン後のユーザー displayName を UI 上に表示
- [x] 61. Dashboard: 期間別ランキングのデータ取得最適化（collectionGroup クエリへの移行）
- [x] 62. Dashboard: ランキングページへのリアルタイム更新対応（現状は期間別が手動取得のみ）
- [ ] 63. Dashboard: 実績アイコンのローカルアセット統一（一部が外部 CDN 参照）
- [x] 64. Tracker: アプリのパッケージング・インストーラー化（electron-builder 等）
- [x] 65. 全体: Firebase Security Rules の設定（Firestore / Storage の書き込み制限）

### P4 デプロイ・リリース準備

> リリース前に P3 の未完了タスク（特に #58, #65）を完了させること

#### Firebase 本番設定
- [x] 66. Firestore Security Rules の本番向け設定（認証済みユーザーのみ自分のデータを書き込み可）
- [x] 67. Firebase Storage Security Rules の設定（アバター画像の認証済みアップロード制限）
- [ ] 68. Firestore インデックスの設定（期間別ランキング等の複合クエリに必要なインデックス作成）
- [ ] 69. Firebase プロジェクトの本番/開発環境分離（Firebaseプロジェクトを dev / prod で分ける）

#### Dashboard（Next.js）のデプロイ
- [x] 70. `@cloudflare/next-on-pages` アダプターの導入
- [x] 71. `next.config.ts` に Edge Runtime 設定を追加
- [x] 72. `wrangler.toml` の初期設定
- [ ] 73. Cloudflare Pages への環境変数（`NEXT_PUBLIC_FIREBASE_*`）の登録
- [ ] 74. GitHub リポジトリと Cloudflare Pages の連携設定
- [ ] 75. 本番デプロイ・動作確認（全ページ・リアルタイム機能・ログイン・ランキング）
- [ ] 76. カスタムドメインの設定（任意）
- [ ] 77. OGP メタタグ・ソーシャルシェア画像の設定

#### Tracker（Electron）のパッケージング・配布
- [ ] 78. electron-builder の設定（`package.json` の `build` セクション追加）
- [ ] 79. アプリアイコンの正式デザイン作成（256x256px 以上の PNG）
- [ ] 80. Windows 用インストーラー（NSIS 形式 `.exe`）のビルド確認
- [ ] 81. 自動アップデート機能の検討（electron-updater 等）
- [ ] 82. コード署名の設定（Windows SmartScreen 警告を回避するために推奨）
- [ ] 83. GitHub Releases へのインストーラー配布

#### リリース作業
- [ ] 84. ユーザー向けインストール手順ドキュメントの作成
- [ ] 85. ベータテストユーザーへの配布・フィードバック収集
- [ ] 86. 不具合修正・調整の反映
- [ ] 87. 正式リリース（Dashboard 公開 URL の案内 + Tracker インストーラーの配布）
