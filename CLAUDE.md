# VSCode Console Input Extension プロジェクト

## プロジェクト概要
VSCode上でコンソール入力機能を提供する拡張機能の開発

## 技術スタック
- TypeScript
- VSCode Extension API
- Node.js

## 開発方針
- VSCode Extension APIのベストプラクティスに従う
- TypeScriptでの型安全な実装
- ユーザビリティを重視したUI/UX設計

## プロジェクト構成
```
vscode-console-input-extension/
├── CLAUDE.md （このファイル）
├── package.json （拡張機能の設定）
├── src/ （ソースコード）
├── out/ （コンパイル済みファイル）
└── test/ （テストファイル）
```

## 開発ガイドライン
- コードスタイル: ESLintとPrettierを使用
- テスト: VSCode Extension Test Suiteを使用
- ビルド: TypeScriptコンパイラを使用