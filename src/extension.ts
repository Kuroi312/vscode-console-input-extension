import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {
    console.log('Console Input Helper extension is now active!');

    // WebviewViewProviderの登録（メインのアクティビティバー用）
    const provider = new ConsoleInputViewProvider(context.extensionUri);
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider('consoleInputView', provider)
    );

    // エクスプローラー用のWebviewViewProvider
    const explorerProvider = new ConsoleInputViewProvider(context.extensionUri);
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider('consoleInputViewExplorer', explorerProvider)
    );

    // パネル用のWebviewViewProvider
    const panelProvider = new ConsoleInputViewProvider(context.extensionUri);
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider('consoleInputViewPanel', panelProvider)
    );
}

class ConsoleInputViewProvider implements vscode.WebviewViewProvider {
    private _view?: vscode.WebviewView;

    constructor(private readonly _extensionUri: vscode.Uri) {}

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken
    ) {
        this._view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this._extensionUri]
        };

        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

        // メッセージハンドリング
        webviewView.webview.onDidReceiveMessage(async (data) => {
            switch (data.type) {
                case 'sendToTerminal':
                    await this._sendToTerminal(data.text);
                    break;
            }
        });
    }

    private async _sendToTerminal(text: string) {
        const activeTerminal = vscode.window.activeTerminal;
        
        if (!activeTerminal) {
            vscode.window.showErrorMessage('No active terminal found. Please open a terminal first.');
            return;
        }

        try {
            // クリップボードにコピー
            await vscode.env.clipboard.writeText(text);
            
            // ターミナルをフォーカス
            activeTerminal.show();
            
            // 少し待機してからペースト
            await new Promise(resolve => setTimeout(resolve, 100));
            
            // Ctrl+Vで貼り付けを実行
            await vscode.commands.executeCommand('workbench.action.terminal.paste');
            
            // さらに少し待機してからEnterキーを送信
            await new Promise(resolve => setTimeout(resolve, 150));
            
            // Enterキーで実行
            activeTerminal.sendText('', true);
            
            // 実行後にWebviewにフォーカスを戻すための遅延
            setTimeout(async () => {
                if (this._view) {
                    // Webviewを表示してフォーカスを戻す
                    this._view.show(true);
                    
                    // Webviewのテキストエリアにフォーカスするメッセージを送信
                    await this._view.webview.postMessage({
                        type: 'focusInput'
                    });
                }
            }, 500);
            
            // 成功メッセージ
            vscode.window.setStatusBarMessage(`Executed: ${text.substring(0, 50)}${text.length > 50 ? '...' : ''}`, 3000);
            
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to send command: ${error}`);
        }
    }

    private _getHtmlForWebview(webview: vscode.Webview) {
        return `<!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Console Input Helper</title>
            <style>
                * {
                    box-sizing: border-box;
                }
                body {
                    margin: 0;
                    padding: 15px;
                    font-family: var(--vscode-font-family);
                    color: var(--vscode-foreground);
                    background-color: var(--vscode-editor-background);
                    height: 100vh;
                    overflow: hidden;
                }
                
                .container {
                    display: flex;
                    flex-direction: column;
                    height: 100%;
                    gap: 15px;
                }
                
                .top-section {
                    flex: 1;
                    display: flex;
                    flex-direction: column;
                    gap: 15px;
                    overflow: hidden;
                }
                
                .bottom-section {
                    flex-shrink: 0;
                    display: flex;
                    flex-direction: column;
                    gap: 10px;
                    padding-top: 10px;
                    border-top: 1px solid var(--vscode-panel-border);
                }
                
                textarea {
                    width: 100%;
                    min-height: 120px;
                    padding: 12px;
                    border: 1px solid var(--vscode-input-border);
                    background-color: var(--vscode-input-background);
                    color: var(--vscode-input-foreground);
                    font-family: var(--vscode-editor-font-family);
                    font-size: var(--vscode-editor-font-size);
                    border-radius: 4px;
                    resize: vertical;
                }
                textarea:focus {
                    outline: 1px solid var(--vscode-focusBorder);
                }
                
                .button-group {
                    display: flex;
                    gap: 8px;
                    align-items: center;
                }
                button {
                    background-color: var(--vscode-button-background);
                    color: var(--vscode-button-foreground);
                    border: none;
                    padding: 8px 16px;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 13px;
                    white-space: nowrap;
                }
                button:hover {
                    background-color: var(--vscode-button-hoverBackground);
                }
                button.secondary {
                    background-color: var(--vscode-button-secondaryBackground);
                    color: var(--vscode-button-secondaryForeground);
                }
                button.secondary:hover {
                    background-color: var(--vscode-button-secondaryHoverBackground);
                }
                
                .label {
                    font-size: 13px;
                    font-weight: 500;
                    margin-bottom: 8px;
                    color: var(--vscode-foreground);
                }
                .shortcut {
                    font-size: 11px;
                    color: var(--vscode-descriptionForeground);
                    margin-top: 8px;
                }
                .char-count {
                    font-size: 11px;
                    color: var(--vscode-descriptionForeground);
                    text-align: right;
                    margin-top: 4px;
                }
                
                .history {
                    flex: 1;
                    min-height: 100px;
                    overflow-y: auto;
                    border: 1px solid var(--vscode-input-border);
                    border-radius: 4px;
                    background: var(--vscode-input-background);
                }
                .history-header {
                    padding: 8px 12px;
                    background: var(--vscode-sideBar-background);
                    border-bottom: 1px solid var(--vscode-panel-border);
                    font-size: 12px;
                    font-weight: 500;
                    position: sticky;
                    top: 0;
                }
                .history-item {
                    padding: 8px 12px;
                    cursor: pointer;
                    border-bottom: 1px solid var(--vscode-panel-border);
                    font-size: 12px;
                    word-wrap: break-word;
                    line-height: 1.4;
                }
                .history-item:hover {
                    background: var(--vscode-list-hoverBackground);
                }
                .history-item:last-child {
                    border-bottom: none;
                }
                .history-item .timestamp {
                    font-size: 10px;
                    color: var(--vscode-descriptionForeground);
                    float: right;
                }
                .history-empty {
                    padding: 20px;
                    text-align: center;
                    color: var(--vscode-descriptionForeground);
                    font-size: 12px;
                }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="top-section">
                    <div class="label">Japanese Input Support</div>
                    
                    <div class="history" id="history">
                        <div class="history-header">Input History (最大20件)</div>
                        <div class="history-empty">履歴はまだありません</div>
                    </div>
                </div>
                
                <div class="bottom-section">
                    <div>
                        <textarea id="inputText" placeholder="日本語でコマンドや質問を入力してください..."></textarea>
                        <div class="char-count" id="charCount">0 characters</div>
                    </div>
                    
                    <div class="button-group">
                        <button onclick="sendToTerminal()">Send to Terminal</button>
                        <button class="secondary" onclick="clearInput()">Clear</button>
                        <button class="secondary" onclick="copyToClipboard()">Copy</button>
                    </div>
                    
                    <div class="shortcut">
                        <strong>Shortcuts:</strong> Ctrl+Enter (send) | Ctrl+K (clear)
                    </div>
                </div>
            </div>

            <script>
                const vscode = acquireVsCodeApi();
                let history = [];

                // VSCode拡張からのメッセージを受信
                window.addEventListener('message', event => {
                    const message = event.data;
                    switch (message.type) {
                        case 'focusInput':
                            // テキストエリアにフォーカスを戻す
                            const inputElement = document.getElementById('inputText');
                            if (inputElement) {
                                inputElement.focus();
                            }
                            break;
                    }
                });

                function sendToTerminal() {
                    const text = document.getElementById('inputText').value;
                    if (text.trim()) {
                        // 送信ボタンを一時的に無効化
                        const sendButton = document.querySelector('button');
                        const originalText = sendButton.textContent;
                        sendButton.textContent = 'Sending...';
                        sendButton.disabled = true;
                        
                        // 履歴に追加
                        addToHistory(text);
                        
                        vscode.postMessage({
                            type: 'sendToTerminal',
                            text: text
                        });
                        
                        // 送信後にテキストエリアをクリア
                        document.getElementById('inputText').value = '';
                        updateCharCount();
                        
                        // 1秒後にボタンを復元
                        setTimeout(() => {
                            sendButton.textContent = originalText;
                            sendButton.disabled = false;
                        }, 1000);
                    }
                }

                function clearInput() {
                    document.getElementById('inputText').value = '';
                    updateCharCount();
                }

                function copyToClipboard() {
                    const text = document.getElementById('inputText').value;
                    navigator.clipboard.writeText(text);
                }

                function addToHistory(text) {
                    const timestamp = new Date().toLocaleTimeString('ja-JP', {
                        hour: '2-digit',
                        minute: '2-digit'
                    });
                    
                    history.unshift({ text, timestamp });
                    if (history.length > 20) history.pop(); // 最大20件に拡張
                    
                    updateHistoryDisplay();
                }

                function updateHistoryDisplay() {
                    const historyEl = document.getElementById('history');
                    const existingItems = historyEl.querySelectorAll('.history-item, .history-empty');
                    existingItems.forEach(item => item.remove());
                    
                    if (history.length === 0) {
                        const emptyDiv = document.createElement('div');
                        emptyDiv.className = 'history-empty';
                        emptyDiv.textContent = '履歴はまだありません';
                        historyEl.appendChild(emptyDiv);
                    } else {
                        history.forEach(item => {
                            const div = document.createElement('div');
                            div.className = 'history-item';
                            div.innerHTML = \`
                                <span class="timestamp">\${item.timestamp}</span>
                                <div>\${item.text}</div>
                            \`;
                            div.onclick = () => {
                                document.getElementById('inputText').value = item.text;
                                updateCharCount();
                            };
                            historyEl.appendChild(div);
                        });
                    }
                }

                function updateCharCount() {
                    const text = document.getElementById('inputText').value;
                    document.getElementById('charCount').textContent = text.length + ' characters';
                }

                // キーボードショートカット
                document.addEventListener('keydown', function(e) {
                    if (e.ctrlKey && e.key === 'Enter') {
                        sendToTerminal();
                    } else if (e.ctrlKey && e.key === 'k') {
                        e.preventDefault();
                        clearInput();
                    }
                });

                // 文字数カウント
                document.getElementById('inputText').addEventListener('input', updateCharCount);
                
                // 初期化
                updateCharCount();
                updateHistoryDisplay();
            </script>
        </body>
        </html>`;
    }
}

export function deactivate() {
    console.log('Console Input Helper extension is now deactivated!');
}