import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

export class CatPanel {
  public static currentPanel: CatPanel | undefined;
  private readonly _panel: vscode.WebviewPanel;
  private _disposables: vscode.Disposable[] = [];

  private constructor(panel: vscode.WebviewPanel, context: vscode.ExtensionContext) {
    this._panel = panel;

    // Load frames JSON
    const framesPath = path.join(context.extensionPath, 'media', 'frames.json');
    let framesJson = '[]';
    try {
      framesJson = fs.readFileSync(framesPath, 'utf8');
    } catch {
      console.error('Could not load frames.json');
    }

    this._panel.webview.html = this._getHtmlContent(framesJson);

    vscode.workspace.onDidChangeTextDocument(() => {
      this._panel.webview.postMessage({ type: 'typing' });
    }, null, this._disposables);

    vscode.workspace.onDidSaveTextDocument(() => {
      this._panel.webview.postMessage({ type: 'saved' });
    }, null, this._disposables);

    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
  }

  public static createOrShow(context: vscode.ExtensionContext) {
    const column = vscode.window.activeTextEditor
      ? vscode.ViewColumn.Beside
      : undefined;

    if (CatPanel.currentPanel) {
      CatPanel.currentPanel._panel.reveal(column);
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      'codingCat',
      '🐱 Coding Cat',
      column || vscode.ViewColumn.Two,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
      }
    );

    CatPanel.currentPanel = new CatPanel(panel, context);
  }

  public static kill() {
    CatPanel.currentPanel?.dispose();
  }

  public dispose() {
    CatPanel.currentPanel = undefined;
    this._panel.dispose();
    while (this._disposables.length) {
      const d = this._disposables.pop();
      if (d) { d.dispose(); }
    }
  }

  private _getHtmlContent(framesJson: string): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Coding Cat</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      background: #1e1e2e;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100vh;
      font-family: monospace;
      overflow: hidden;
      color: #cdd6f4;
      user-select: none;
    }
    #scene {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0;
    }
    #catCanvas {
      image-rendering: pixelated;
      border-radius: 8px;
      display: block;
    }
    #laptop-wrap {
      background: #2a2a3e;
      border-radius: 8px;
      padding: 10px 16px 8px;
      border: 2px solid #585b70;
      margin-top: -4px;
    }
    #status {
      margin-top: 16px;
      font-size: 13px;
      color: #a6adc8;
      letter-spacing: 0.03em;
    }
    #loading {
      color: #585b70;
      font-size: 12px;
      margin-top: 8px;
    }
  </style>
</head>
<body>
  <div id="scene">
    <canvas id="catCanvas" width="240" height="240"></canvas>
    <div id="laptop-wrap">
      <svg viewBox="0 0 160 60" width="160" height="60" xmlns="http://www.w3.org/2000/svg">
        <rect x="0" y="0" width="160" height="56" rx="4" fill="#1e1e2e" stroke="#45475a" stroke-width="1.5"/>
        <rect x="6" y="8"  width="55" height="3.5" rx="1.5" fill="#cba6f7" opacity="0.9"/>
        <rect x="6" y="15" width="90" height="3.5" rx="1.5" fill="#89b4fa" opacity="0.9"/>
        <rect x="6" y="22" width="48" height="3.5" rx="1.5" fill="#a6e3a1" opacity="0.9"/>
        <rect x="6" y="29" width="70" height="3.5" rx="1.5" fill="#89b4fa" opacity="0.9"/>
        <rect x="6" y="36" width="40" height="3.5" rx="1.5" fill="#f38ba8" opacity="0.9"/>
        <rect x="6" y="43" width="62" height="3.5" rx="1.5" fill="#cba6f7" opacity="0.9"/>
        <rect id="cur" x="72" y="43" width="2" height="7" fill="#cdd6f4"/>
      </svg>
    </div>
  </div>
  <div id="status">코드 작성 중... 🐾</div>
  <div id="loading">고양이 로딩 중...</div>

<script>
const FRAMES = ${framesJson};
const canvas  = document.getElementById('catCanvas');
const ctx     = canvas.getContext('2d');
const statusEl = document.getElementById('status');
const loadingEl = document.getElementById('loading');
const cur     = document.getElementById('cur');

// Preload all frame images
const imgs = [];
let loaded = 0;

function drawFrame(idx) {
  if (imgs[idx] && imgs[idx].complete) {
    ctx.clearRect(0, 0, 160, 160);
    ctx.drawImage(imgs[idx], 0, 0, 240, 240);
  }
}

FRAMES.forEach((src, i) => {
  const img = new Image();
  img.onload = () => {
    loaded++;
    if (loaded === FRAMES.length) {
      loadingEl.style.display = 'none';
      drawFrame(0); // show first frame
    }
  };
  img.src = src;
  imgs.push(img);
});

// Animation state
let isTyping    = false;
let frameIdx    = 0;
let animTimer   = null;
let idleTimer   = null;
let typingTimer = null;

// Idle: hold on frame 0
function showIdle() {
  clearInterval(animTimer);
  animTimer = null;
  frameIdx = 0;
  drawFrame(0);
}

// Play frames forward on each typing event — advances one frame per keystroke tick
function advanceFrame() {
  frameIdx = (frameIdx + 1) % FRAMES.length;
  drawFrame(frameIdx);
}

// Slow idle drift: every ~4s slightly animate (frames 0-2)
let idleDrift = 0;
setInterval(() => {
  if (!isTyping) {
    idleDrift = (idleDrift + 1) % 3;
    drawFrame(idleDrift);
  }
}, 900);

// Cursor blink
let curOn = true;
setInterval(() => { curOn=!curOn; cur.style.opacity=curOn?'1':'0'; }, 530);

// Message handler
window.addEventListener('message', ev => {
  const msg = ev.data;

  if (msg.type === 'typing') {
    isTyping = true;
    statusEl.textContent = '열심히 코딩 중... ⌨️';

    // Advance one frame per typing event
    advanceFrame();

    clearTimeout(typingTimer);
    typingTimer = setTimeout(() => {
      isTyping = false;
      showIdle();
      statusEl.textContent = '코드 작성 중... 🐾';
    }, 1500);
  }

  if (msg.type === 'saved') {
    isTyping = false;
    clearTimeout(typingTimer);
    // Play all frames quickly once on save
    let i = 0;
    clearInterval(animTimer);
    animTimer = setInterval(() => {
      drawFrame(i % FRAMES.length);
      i++;
      if (i >= FRAMES.length) {
        clearInterval(animTimer);
        showIdle();
      }
    }, 40);
    statusEl.textContent = '저장됨! 잘했어요 ✨';
    setTimeout(() => {
      statusEl.textContent = '코드 작성 중... 🐾';
    }, 2200);
  }
});
</script>
</body>
</html>`;
  }
}
