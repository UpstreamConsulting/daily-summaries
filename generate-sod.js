/**
 * generate-sod.js — Auto-generates SOD (Start of Day) summary HTML
 *
 * Reads from:
 *   - Core\System\bubble-tray.md (current tray state)
 *   - Core\System\thoughts.md (pending thoughts from phone/other sessions)
 *   - Yesterday's EOD log (what got done)
 *
 * Outputs:
 *   - SOD.html (pushed to GitHub Pages via GitDoc)
 *
 * Usage: node generate-sod.js
 */

import fs from 'fs';
import path from 'path';

// ── PATHS ─────────────────────────────────────────────────────────────
const CORE = 'C:/Users/levib/OneDrive - Upstream Consulting/Core';
const OUTPUT_DIR = 'C:/Users/levib/daily-summaries';
const LOGS_DIR = path.join(OUTPUT_DIR, 'logs');

// ── DATE ──────────────────────────────────────────────────────────────
const now = new Date();
const dateStr = now.toISOString().split('T')[0];
const dayNames = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const dayName = dayNames[now.getDay()];
const dateDisplay = `${monthNames[now.getMonth()]} ${now.getDate()}, ${now.getFullYear()}`;

// Yesterday's date
const yesterday = new Date(now);
yesterday.setDate(yesterday.getDate() - 1);
const yesterdayStr = yesterday.toISOString().split('T')[0];

// ── HELPERS ───────────────────────────────────────────────────────────
function readFile(filePath) {
  try { return fs.readFileSync(filePath, 'utf8'); } catch { return null; }
}

function escHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// ── GATHER DATA ───────────────────────────────────────────────────────
const tray = readFile(path.join(CORE, 'System/bubble-tray.md')) || '';
const thoughts = readFile(path.join(CORE, 'System/thoughts.md')) || '';
const yesterdayLog = readFile(path.join(LOGS_DIR, `${yesterdayStr}.md`)) || '';

// ── EXTRACT TRAY ITEMS ────────────────────────────────────────────────
function extractTrayItems(trayContent) {
  const items = [];
  const regex = /`(\d+)`\s+(.+?)\s+((?:[⬤◯])+)\s+(🟢|🟡|⚪|🔴)/g;
  let match;
  while ((match = regex.exec(trayContent)) !== null) {
    items.push({
      code: match[1],
      name: match[2].replace(/\s*—.*$/, '').trim(),
      fullName: match[2].trim(),
      dots: match[3],
      status: match[4]
    });
  }
  return items;
}

const trayItems = extractTrayItems(tray);
const priorityItems = trayItems.filter(i => parseInt(i.code) >= 10 && parseInt(i.code) <= 19);
const projectItems = trayItems.filter(i => parseInt(i.code) >= 20 && parseInt(i.code) <= 29);
const buildingItems = trayItems.filter(i => i.status === '🟡');

// ── EXTRACT THOUGHTS ──────────────────────────────────────────────────
const thoughtLines = thoughts.split('---').slice(1).join('---').trim()
  .split('\n').filter(l => l.trim().startsWith('-')).map(l => l.replace(/^-\s*/, '').trim());

// ── EXTRACT YESTERDAY'S STATS ─────────────────────────────────────────
let yesterdayStats = { commits: '–', files: '–', memories: '–' };
const commitsMatch = yesterdayLog.match(/Commits:\s*(\d+)/);
const filesMatch = yesterdayLog.match(/Files changed:\s*(\d+)/);
const memoriesMatch = yesterdayLog.match(/Memories saved:\s*(\d+)/);
if (commitsMatch) yesterdayStats.commits = commitsMatch[1];
if (filesMatch) yesterdayStats.files = filesMatch[1];
if (memoriesMatch) yesterdayStats.memories = memoriesMatch[1];

// ── BUILD HTML ────────────────────────────────────────────────────────
function priorityRows() {
  const items = [...priorityItems, ...buildingItems.filter(i => parseInt(i.code) >= 20)];
  const unique = [...new Map(items.map(i => [i.code, i])).values()];
  return unique.slice(0, 6).map((i, idx) => {
    const topClass = idx === 0 ? ' top' : '';
    const codeClass = parseInt(i.code) < 20 ? 'p-code-p' : 'p-code-j';
    return `      <div class="priority-item${topClass}">
        <span class="p-code ${codeClass}">${i.code}</span>
        <span class="p-name">${escHtml(i.fullName)}</span>
        <span class="p-dots">${i.dots}</span>
        <span class="p-status">${i.status}</span>
      </div>`;
  }).join('\n');
}

function thoughtRows() {
  if (thoughtLines.length === 0) return '      <div class="thought-empty">No pending thoughts</div>';
  return thoughtLines.map(t =>
    `      <div class="thought-item"><span class="thought-icon">💭</span><span class="thought-text">${escHtml(t)}</span></div>`
  ).join('\n');
}

function trayRows() {
  return trayItems.slice(0, 8).map(i => {
    const codeClass = parseInt(i.code) < 20 ? 'tray-code-p' : 'tray-code-j';
    return `      <div class="tray-item">
        <span class="tray-code ${codeClass}">${i.code}</span>
        <span class="tray-name">${escHtml(i.name)}</span>
        <span class="tray-dots">${i.dots}</span>
        <span class="tray-status">${i.status}</span>
      </div>`;
  }).join('\n');
}

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Morning Brief — ${dateDisplay}</title>
<link rel="icon" href="SOD-icon-192.png">
<link rel="apple-touch-icon" href="SOD-icon-192.png">
<link rel="manifest" href="manifest.json">
<meta name="theme-color" content="#f0ede6">
<style>
@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700&family=Bebas+Neue&display=swap');
*{box-sizing:border-box;margin:0;padding:0}
body{background:#f0ede6;color:#1a1a1a;font-family:'Plus Jakarta Sans',sans-serif;min-height:100vh;padding:0}
.nav{background:#1a1a1a;border-bottom:4px solid #f0ede6;padding:14px 24px;display:flex;justify-content:space-between;align-items:center;position:sticky;top:0;z-index:10}
.nav-brand{font-size:12px;font-weight:600;letter-spacing:0.04em;color:#818cf8}
.nav-right{display:flex;align-items:center;gap:12px}
.nav-greeting{font-size:12px;color:#94a3b8}
.nav-date{font-size:11px;color:#94a3b8}
.page{padding:24px;max-width:960px;margin:0 auto}
.hero{margin-bottom:32px;padding-bottom:32px;border-bottom:1px solid rgba(0,0,0,0.06)}
.hero-kicker{font-size:10px;letter-spacing:0.2em;text-transform:uppercase;color:#888;margin-bottom:12px}
.hero h1{font-family:'Bebas Neue',sans-serif;font-size:clamp(36px,6vw,52px);line-height:1;letter-spacing:0.02em;color:#1a1a1a;margin-bottom:12px}
.hero h1 span{color:#e63312}
.hero-lede{font-size:15px;line-height:1.7;color:#555;max-width:560px;border-left:3px solid #e63312;padding-left:16px}
.stats-strip{display:grid;grid-template-columns:repeat(3,1fr);gap:0;margin-bottom:32px;border:4px solid #1a1a1a;border-radius:14px;overflow:hidden}
.stat-cell{padding:20px;text-align:center;border-right:4px solid #f0ede6;background:#fff}
.stat-cell:last-child{border-right:none}
.stat-cell.highlight{background:#1a1a1a}
.stat-cell.highlight .stat-val{color:#e63312}
.stat-cell.highlight .stat-label,.stat-cell.highlight .stat-sub{color:#94a3b8}
.stat-label{font-size:9px;text-transform:uppercase;letter-spacing:0.15em;color:#888;margin-bottom:8px}
.stat-val{font-family:'Bebas Neue',sans-serif;font-size:36px;color:#1a1a1a;line-height:1}
.stat-sub{font-size:10px;color:#888;margin-top:4px}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px}
.card{background:#fff;border:1px solid #e8e4dc;border-radius:14px;padding:20px}
.card-head{font-size:11px;font-weight:600;color:#888;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:16px;display:flex;align-items:center;gap:8px}
.card-head-icon{font-size:16px}
.card-head-line{flex:1;height:1px;background:#e8e4dc}
.priority-item{display:flex;align-items:center;gap:12px;padding:12px;margin-bottom:8px;background:#faf9f6;border:1px solid #e8e4dc;border-radius:10px}
.priority-item.top{border-left:3px solid #e63312}
.priority-item.top .p-code{background:rgba(230,51,18,0.15);color:#e63312}
.p-code{font-family:monospace;font-size:12px;font-weight:700;padding:4px 8px;border-radius:6px;min-width:32px;text-align:center}
.p-code-p{background:rgba(230,51,18,0.1);color:#e63312}
.p-code-j{background:rgba(129,140,248,0.1);color:#818cf8}
.p-name{font-size:13px;color:#1a1a1a;flex:1;font-weight:500}
.p-dots{font-size:11px;color:#aaa;letter-spacing:1px}
.p-status{font-size:14px}
.thought-item{display:flex;align-items:center;gap:10px;padding:10px 12px;margin-bottom:6px;background:#faf9f6;border:1px solid #e8e4dc;border-radius:8px}
.thought-icon{font-size:14px;flex-shrink:0}
.thought-text{font-size:12px;color:#555}
.thought-empty{font-size:12px;color:#aaa;padding:12px;text-align:center}
.tray-item{display:flex;align-items:center;gap:12px;padding:8px 12px;margin-bottom:4px;background:#faf9f6;border-radius:8px}
.tray-code{font-family:monospace;font-size:12px;font-weight:700;padding:3px 7px;border-radius:5px;min-width:28px;text-align:center}
.tray-code-p{background:rgba(230,51,18,0.15);color:#e63312}
.tray-code-j{background:rgba(129,140,248,0.1);color:#818cf8}
.tray-name{font-size:12px;color:#1a1a1a;flex:1}
.tray-dots{font-size:10px;color:#aaa;letter-spacing:1px}
.tray-status{font-size:12px}
.auto-tag{display:inline-block;margin-top:16px;font-size:10px;color:#aaa;font-family:monospace;letter-spacing:0.05em}
.footer{background:#1a1a1a;border-top:4px solid #f0ede6;padding:14px 24px;display:flex;justify-content:space-between;font-size:10px;color:#94a3b8;font-family:monospace;margin-top:32px}
@media(max-width:600px){.grid{grid-template-columns:1fr}.stats-strip{grid-template-columns:1fr}.page{padding:16px}.hero h1{font-size:36px}}
</style>
</head>
<body>

<div class="nav">
  <div class="nav-brand">Upstream Consulting</div>
  <div class="nav-right">
    <span class="nav-greeting">Good morning, Levi</span>
    <span class="nav-date">${dateDisplay}</span>
  </div>
</div>

<div class="page">

  <div class="hero">
    <div class="hero-kicker">Start of Day · ${dayName}</div>
    <h1>Today's <span>Focus</span></h1>
    <div class="hero-lede">Auto-generated morning brief. ${priorityItems.length} priorities, ${buildingItems.length} items building, ${thoughtLines.length} pending thoughts.</div>
  </div>

  <div class="stats-strip">
    <div class="stat-cell highlight">
      <div class="stat-label">Priorities</div>
      <div class="stat-val">${priorityItems.length}</div>
      <div class="stat-sub">active tasks</div>
    </div>
    <div class="stat-cell">
      <div class="stat-label">Projects</div>
      <div class="stat-val">${projectItems.length}</div>
      <div class="stat-sub">in progress</div>
    </div>
    <div class="stat-cell">
      <div class="stat-label">Yesterday</div>
      <div class="stat-val">${yesterdayStats.files}</div>
      <div class="stat-sub">files changed</div>
    </div>
  </div>

  <div class="grid">

    <div class="card">
      <div class="card-head"><span class="card-head-icon">🎯</span> Today's Priority <div class="card-head-line"></div></div>
${priorityRows()}
    </div>

    <div class="card">
      <div class="card-head"><span class="card-head-icon">💭</span> Pending Thoughts <div class="card-head-line"></div></div>
${thoughtRows()}
      <div class="auto-tag">From thoughts.md — drop ideas from any device</div>
    </div>

  </div>

  <div class="grid">

    <div class="card">
      <div class="card-head"><span class="card-head-icon">📊</span> Full Tray <div class="card-head-line"></div></div>
${trayRows()}
    </div>

    <div class="card">
      <div class="card-head"><span class="card-head-icon">🛠️</span> Tools for Today <div class="card-head-line"></div></div>
      <p style="font-size:12px;color:#888;line-height:1.6;margin-bottom:12px">Based on your priorities:</p>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <span style="font-size:11px;padding:6px 12px;border-radius:20px;font-weight:600;background:#1a1a1a;color:#818cf8;border:1px solid #1a1a1a">VCC ⟨VS Code + Claude⟩</span>
        <span style="font-size:11px;padding:6px 12px;border-radius:20px;font-weight:600;background:#faf9f6;color:#888;border:1px solid #e8e4dc">CB ⟨Claude Browser⟩</span>
      </div>
    </div>

  </div>

</div>

<div class="footer">
  <span>Upstream Consulting · upstreamconsulting.ca</span>
  <span>Auto-generated ${now.toISOString().replace('T', ' ').substring(0, 19)}</span>
</div>

</body>
</html>`;

// ── WRITE ─────────────────────────────────────────────────────────────
fs.writeFileSync(path.join(OUTPUT_DIR, 'SOD.html'), html);
console.log(`✓ SOD.html updated for ${dateDisplay}`);
