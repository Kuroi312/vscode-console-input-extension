import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {
    console.log('Console Input Helper extension is now active!');

    // WebviewViewProviderの登録（メインのアクティビティバー用）
    const provider = new ConsoleInputViewProvider(context.extensionUri, context);
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider('consoleInputView', provider)
    );

    // エクスプローラー用のWebviewViewProvider
    const explorerProvider = new ConsoleInputViewProvider(context.extensionUri, context);
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider('consoleInputViewExplorer', explorerProvider)
    );

    // パネル用のWebviewViewProvider
    const panelProvider = new ConsoleInputViewProvider(context.extensionUri, context);
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider('consoleInputViewPanel', panelProvider)
    );
}

class ConsoleInputViewProvider implements vscode.WebviewViewProvider {
    private _view?: vscode.WebviewView;
    private _context: vscode.ExtensionContext;
    private _persistentData: {
        inputText: string;
        history: Array<{text: string, timestamp: string}>;
    } = {
        inputText: '',
        history: []
    };

    constructor(private readonly _extensionUri: vscode.Uri, context: vscode.ExtensionContext) {
        this._context = context;
        // 永続化データを読み込み
        this._loadPersistentData();
    }

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
                case 'sendEnterOnly':
                    await this._sendEnterOnly();
                    break;
                case 'saveInputText':
                    this._persistentData.inputText = data.text;
                    this._savePersistentData();
                    break;
                case 'saveHistory':
                    this._persistentData.history = data.history;
                    this._savePersistentData();
                    break;
                case 'loadData':
                    // Webviewに永続化データを送信
                    await webviewView.webview.postMessage({
                        type: 'restoreData',
                        data: this._persistentData
                    });
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

    private async _sendEnterOnly() {
        const activeTerminal = vscode.window.activeTerminal;
        
        if (!activeTerminal) {
            vscode.window.showErrorMessage('No active terminal found. Please open a terminal first.');
            return;
        }

        try {
            // ターミナルをフォーカス
            activeTerminal.show();
            
            // 少し待機
            await new Promise(resolve => setTimeout(resolve, 100));
            
            // Enterキーのみを送信
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
            }, 300);
            
            // 成功メッセージ
            vscode.window.setStatusBarMessage('Sent Enter key to terminal', 2000);
            
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to send Enter key: ${error}`);
        }
    }

    private _loadPersistentData() {
        try {
            type PersistentDataType = {
                inputText: string;
                history: Array<{text: string, timestamp: string}>;
            };
            const savedData = this._context.workspaceState.get<PersistentDataType>('consoleInputHelper.data');
            if (savedData) {
                this._persistentData = savedData;
            }
        } catch (error) {
            console.error('Failed to load persistent data:', error);
        }
    }

    private _savePersistentData() {
        try {
            this._context.workspaceState.update('consoleInputHelper.data', this._persistentData);
        } catch (error) {
            console.error('Failed to save persistent data:', error);
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
                    position: relative;
                    height: 100%;
                    display: flex;
                    flex-direction: column;
                }
                
                .top-section {
                    position: absolute;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 200px; /* 下部エリアの高さ分を確保 */
                    display: flex;
                    flex-direction: column;
                    gap: 15px;
                    padding: 15px;
                    padding-bottom: 0;
                    overflow: hidden;
                }
                
                .resize-bar {
                    position: absolute;
                    left: 0;
                    right: 0;
                    bottom: 200px; /* 下部エリアの高さに合わせる */
                    height: 6px;
                    background: var(--vscode-panel-border);
                    cursor: row-resize;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    user-select: none;
                    z-index: 10;
                }
                
                .resize-bar:hover {
                    background: var(--vscode-focusBorder);
                }
                
                .resize-handle {
                    width: 40px;
                    height: 2px;
                    background: var(--vscode-foreground);
                    border-radius: 1px;
                    opacity: 0.6;
                }
                
                .resize-bar:hover .resize-handle {
                    opacity: 1;
                }
                
                .bottom-section {
                    position: absolute;
                    bottom: 0;
                    left: 0;
                    right: 0;
                    height: 200px;
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                    padding: 15px;
                    background: var(--vscode-editor-background);
                    border-top: 1px solid var(--vscode-panel-border);
                    box-sizing: border-box;
                }
                
                .button-group {
                    flex-shrink: 0; /* ボタンエリアは縮小しない */
                    display: flex;
                    gap: 8px;
                    align-items: center;
                }
                
                .shortcut {
                    flex-shrink: 0; /* ショートカット表示も縮小しない */
                    font-size: 11px;
                    color: var(--vscode-descriptionForeground);
                }
                
                .char-count {
                    flex-shrink: 0; /* 文字数カウントも縮小しない */
                    font-size: 11px;
                    color: var(--vscode-descriptionForeground);
                    text-align: right;
                }
                
                .input-area {
                    flex: 1;
                    display: flex;
                    flex-direction: column;
                    gap: 5px;
                    min-height: 0; /* flexの子要素がオーバーフローを許可 */
                }
                
                textarea {
                    width: 100%;
                    flex: 1; /* 利用可能なスペースを全て使用 */
                    min-height: 60px; /* 最小高さを小さく設定 */
                    padding: 12px;
                    border: 1px solid var(--vscode-input-border);
                    background-color: var(--vscode-input-background);
                    color: var(--vscode-input-foreground);
                    font-family: var(--vscode-editor-font-family);
                    font-size: var(--vscode-editor-font-size);
                    border-radius: 4px;
                    resize: none; /* 手動リサイズを無効化 */
                    box-sizing: border-box;
                }
                textarea:focus {
                    outline: 1px solid var(--vscode-focusBorder);
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
                <div class="top-section" id="topSection">
                    <div class="label">Japanese Input Support</div>
                    
                    <div class="history" id="history">
                        <div class="history-header">Input History (最大20件)</div>
                        <div class="history-empty">履歴はまだありません</div>
                    </div>
                </div>
                
                <div class="resize-bar" id="resizeBar">
                    <div class="resize-handle"></div>
                </div>
                
                <div class="bottom-section" id="bottomSection">
                    <div class="input-area">
                        <textarea id="inputText" placeholder="日本語でコマンドや質問を入力してください..."></textarea>
                        <div class="char-count" id="charCount">0 characters</div>
                    </div>
                    
                    <div class="button-group">
                        <button onclick="sendToTerminal()">Send to Terminal</button>
                        <button class="secondary" onclick="clearInput()">Clear</button>
                        <button class="secondary" onclick="copyToClipboard()">Copy</button>
                    </div>
                    
                    <div class="shortcut">
                        <strong>Shortcuts:</strong> Ctrl+Enter (send) | Alt+Enter (enter key only) | Ctrl+K (clear)
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
                        case 'restoreData':
                            // 永続化データを復元
                            const data = message.data;
                            if (data.inputText) {
                                document.getElementById('inputText').value = data.inputText;
                                updateCharCount();
                            }
                            if (data.history) {
                                history = data.history;
                                updateHistoryDisplay();
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
                    saveInputText();
                }

                function copyToClipboard() {
                    const text = document.getElementById('inputText').value;
                    navigator.clipboard.writeText(text);
                }

                function sendEnterOnly() {
                    vscode.postMessage({
                        type: 'sendEnterOnly'
                    });
                }

                function addToHistory(text) {
                    const timestamp = new Date().toLocaleTimeString('ja-JP', {
                        hour: '2-digit',
                        minute: '2-digit'
                    });
                    
                    history.unshift({ text, timestamp });
                    if (history.length > 20) history.pop(); // 最大20件に拡張
                    
                    updateHistoryDisplay();
                    saveHistory();
                }

                function saveInputText() {
                    const text = document.getElementById('inputText').value;
                    vscode.postMessage({
                        type: 'saveInputText',
                        text: text
                    });
                }

                function saveHistory() {
                    vscode.postMessage({
                        type: 'saveHistory',
                        history: history
                    });
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
                    const inputText = document.getElementById('inputText').value;
                    
                    if (e.ctrlKey && e.key === 'Enter') {
                        // Ctrl+Enter: 通常の送信
                        sendToTerminal();
                    } else if (e.altKey && e.key === 'Enter') {
                        // Alt+Enter: 空の場合はEnterキーのみ送信、内容がある場合は通常送信
                        e.preventDefault();
                        if (inputText.trim() === '') {
                            sendEnterOnly();
                        } else {
                            sendToTerminal();
                        }
                    } else if (e.ctrlKey && e.key === 'k') {
                        e.preventDefault();
                        clearInput();
                    }
                });

                // 文字数カウントと入力内容保存
                document.getElementById('inputText').addEventListener('input', function() {
                    updateCharCount();
                    saveInputText();
                });
                
                // リサイズ機能の実装
                let isResizing = false;
                let startY = 0;
                let startBottomHeight = 200; // デフォルトの下部セクション高さ
                
                const resizeBar = document.getElementById('resizeBar');
                const topSection = document.getElementById('topSection');
                const bottomSection = document.getElementById('bottomSection');
                const container = document.querySelector('.container');
                
                function startResize(e) {
                    isResizing = true;
                    startY = e.clientY;
                    startBottomHeight = bottomSection.offsetHeight;
                    
                    // ドラッグ中のカーソルを設定
                    document.body.style.cursor = 'row-resize';
                    document.body.style.userSelect = 'none';
                    
                    // イベントリスナーを追加
                    document.addEventListener('mousemove', doResize);
                    document.addEventListener('mouseup', stopResize);
                    
                    e.preventDefault();
                }
                
                function doResize(e) {
                    if (!isResizing) return;
                    
                    const deltaY = startY - e.clientY; // 逆方向（上に動かすと下部が大きくなる）
                    const containerHeight = container.offsetHeight;
                    
                    let newBottomHeight = startBottomHeight + deltaY;
                    
                    // 最小・最大サイズの制限
                    const minBottomHeight = 150; // 下部の最小サイズ
                    const maxBottomHeight = containerHeight - 100; // 上部の最小100px確保
                    
                    newBottomHeight = Math.max(minBottomHeight, Math.min(newBottomHeight, maxBottomHeight));
                    
                    // 下部セクションの高さを変更（flexで入力ボックスが自動調整される）
                    bottomSection.style.height = newBottomHeight + 'px';
                    
                    // リサイズバーと上部セクションの位置を調整
                    resizeBar.style.bottom = newBottomHeight + 'px';
                    topSection.style.bottom = newBottomHeight + 'px';
                    
                    e.preventDefault();
                }
                
                function stopResize(e) {
                    if (!isResizing) return;
                    
                    isResizing = false;
                    
                    // カーソルとスタイルをリセット
                    document.body.style.cursor = '';
                    document.body.style.userSelect = '';
                    
                    // イベントリスナーを削除
                    document.removeEventListener('mousemove', doResize);
                    document.removeEventListener('mouseup', stopResize);
                    
                    e.preventDefault();
                }
                
                // リサイズバーにイベントリスナーを追加
                if (resizeBar) {
                    resizeBar.addEventListener('mousedown', startResize);
                }
                
                // 初期化
                updateCharCount();
                updateHistoryDisplay();
                
                // 永続化データの読み込みを要求
                vscode.postMessage({
                    type: 'loadData'
                });
            </script>
        </body>
        </html>`;
    }
}

export function deactivate() {
    console.log('Console Input Helper extension is now deactivated!');
}