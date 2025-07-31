# Console Input Helper

VSCode上でコンソールアプリケーション（Claude Code、Gemini CLI等）への日本語入力を支援する拡張機能です。

## 機能

- **日本語入力対応**: IMEによる日本語入力が可能な専用入力パネル
- **自動実行**: `Ctrl+Enter`でターミナルへの送信と実行を一括実行
- **入力履歴**: 最大20件の入力履歴を保存・再利用
- **複数の表示場所**: アクティビティバー、エクスプローラー、ボトムパネルから選択可能
- **自動フォーカス**: 実行後に入力パネルに自動でフォーカスが戻る

## 使い方

1. 拡張機能をインストール後、VSCodeを再起動
2. 左側のアクティビティバーまたは下部パネルに「Console Input Helper」が表示
3. テキストエリアに日本語で入力
4. `Ctrl+Enter`または「Send to Terminal」ボタンでターミナルに送信・実行
5. 履歴から過去の入力を再利用可能

## 設定

- `console-input-helper.showInExplorer`: エクスプローラーサイドバーに表示
- `console-input-helper.showInPanel`: ボトムパネルに表示

## キーボードショートカット

- `Ctrl+Enter`: ターミナルに送信・実行
- `Ctrl+K`: 入力内容をクリア

## 対応アプリケーション

- Claude Code
- Gemini CLI
- その他の対話型CLIツール

## 開発・ビルド方法

```bash
# 依存関係をインストール
npm install

# TypeScriptをコンパイル
npm run compile

# 監視モードでコンパイル
npm run watch
```

## インストール方法

1. F1キーを押してコマンドパレットを開く
2. "Extensions: Install from VSIX..." を選択
3. ビルドした.vsixファイルを選択

## 対応CLI

- Claude Code
- Gemini CLI
- その他のCLIツール

## トラブルシューティング

- ターミナルがアクティブでない場合はエラーメッセージが表示されます
- 空の入力は受け付けません