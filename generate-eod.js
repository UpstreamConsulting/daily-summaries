/**
 * generate-eod.js — Auto-generates EOD summary HTML
 *
 * Reads from:
 *   - Core\System\bubble-tray.md (current tray state)
 *   - Core session memory files (today's changes)
 *   - BNM session memory files (today's changes)
 *   - Git logs from Core + BMN (today's file activity)
 *
 * Outputs:
 *   - EOD.html (pushed to GitHub Pages via GitDoc)
 *   - logs/YYYY-MM-DD.md (daily log archive)
 *
 * Usage: node generate-eod.js
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

// ── PATHS ─────────────────────────────────────────────────────────────
const CORE = 'C:/Users/levib/OneDrive - Upstream Consulting/Core';
const BMN = 'C:/Users/levib/OneDrive - Upstream Consulting/BrickNMortr - BMN_System';
const CORE_MEMORY = 'C:/Users/levib/.claude/projects/c--Users-levib-OneDrive---Upstream-Consulting-Core/memory';
const BMN_MEMORY = 'C:/Users/levib/.claude/projects/c--Users-levib-OneDrive---Upstream-Consulting-BrickNMortr---BMN-System/memory';
const OUTPUT_DIR = 'C:/Users/levib/daily-summaries';
const LOGS_DIR = path.join(OUTPUT_DIR, 'logs');

// ── DATE ──────────────────────────────────────────────────────────────
const now = new Date();
const dateStr = now.toISOString().split('T')[0]; // 2026-03-25
const dayNames = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const dayName = dayNames[now.getDay()];
const dateDisplay = `${monthNames[now.getMonth()]} ${now.getDate()}, ${now.getFullYear()}`;

// ── HELPERS ───────────────────────────────────────────────────────────
function readFile(filePath) {
  try { return fs.readFileSync(filePath, 'utf8'); } catch { return null; }
}

function getGitLog(repoPath, label) {
  try {
    const log = execSync(
      `git -C "${repoPath}" log --since="6am" --pretty=format:"%s" --no-merges 2>/dev/null`,
      { encoding: 'utf8', timeout: 5000 }
    ).trim();
    if (!log) return [];
    return log.split('\n').map(l => ({ label, message: l.trim() }));
  } catch { return []; }
}

function getTodayMemories(memoryDir) {
  try {
    const files = fs.readdirSync(memoryDir);
    const today = [];
    for (const f of files) {
      if (f === 'MEMORY.md') continue;
      const fp = path.join(memoryDir, f);
      const stat = fs.statSync(fp);
      const modified = stat.mtime.toISOString().split('T')[0];
      if (modified === dateStr) {
        const content = readFile(fp);
        const nameMatch = content?.match(/^name:\s*(.+)$/m);
        const descMatch = content?.match(/^description:\s*(.+)$/m);
        today.push({
          file: f,
          name: nameMatch?.[1] || f,
          desc: descMatch?.[1] || ''
        });
      }
    }
    return today;
  } catch { return []; }
}

function getChangedFiles(repoPath) {
  try {
    const log = execSync(
      `git -C "${repoPath}" log --since="6am" --pretty=format:"" --name-only --no-merges 2>/dev/null`,
      { encoding: 'utf8', timeout: 5000 }
    ).trim();
    if (!log) return [];
    return [...new Set(log.split('\n').filter(Boolean))];
  } catch { return []; }
}

// ── GATHER DATA ───────────────────────────────────────────────────────
const tray = readFile(path.join(CORE, 'System/bubble-tray.md')) || '';
const coreCommits = getGitLog(CORE, 'Core');
const bnmCommits = getGitLog(BMN, 'BMN');
const allCommits = [...coreCommits, ...bnmCommits];

const coreMemories = getTodayMemories(CORE_MEMORY);
const bnmMemories = getTodayMemories(BMN_MEMORY);
const allMemories = [...coreMemories, ...bnmMemories];

const coreFiles = getChangedFiles(CORE);
const bnmFiles = getChangedFiles(BMN);

// ── EXTRACT TRAY ITEMS ────────────────────────────────────────────────
function extractTrayItems(trayContent) {
  const items = [];
  const regex = /`(\d+)`\s+(.+?)\s+((?:[⬤◯])+)\s+(🟢|🟡|⚪|🔴)/g;
  let match;
  while ((match = regex.exec(trayContent)) !== null) {
    items.push({
      code: match[1],
      name: match[2].replace(/\s*—.*$/, '').trim(),
      dots: match[3],
      status: match[4]
    });
  }
  return items;
}

const trayItems = extractTrayItems(tray);
const priorityItems = trayItems.filter(i => parseInt(i.code) >= 10 && parseInt(i.code) <= 19);
const projectItems = trayItems.filter(i => parseInt(i.code) >= 20 && parseInt(i.code) <= 29);

// ── BUILD ACTIVITY LIST ───────────────────────────────────────────────
const activities = [];

// From commits
for (const c of allCommits) {
  activities.push(`[${c.label}] ${c.message}`);
}

// From memories created/updated today
for (const m of allMemories) {
  activities.push(`Memory: ${m.name}`);
}

// If no git activity, note file changes
if (allCommits.length === 0) {
  if (coreFiles.length > 0) activities.push(`${coreFiles.length} files changed in Core`);
  if (bnmFiles.length > 0) activities.push(`${bnmFiles.length} files changed in BMN`);
}

if (activities.length === 0) {
  activities.push('No tracked activity today');
}

// ── STATS ─────────────────────────────────────────────────────────────
const totalCommits = allCommits.length;
const totalFiles = new Set([...coreFiles, ...bnmFiles]).size;
const totalMemories = allMemories.length;

// ── BUILD HTML ────────────────────────────────────────────────────────
function activityRows() {
  return activities.slice(0, 15).map(a =>
    `      <div class="done-item"><span class="done-check">✓</span><span class="done-text">${escHtml(a)}</span></div>`
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

function escHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>End of Day — ${dateDisplay}</title>
<link rel="icon" href="EOD-icon.svg">
<link rel="apple-touch-icon" href="EOD-icon.svg">
<link rel="manifest" href="manifest.json">
<meta name="theme-color" content="#1a1a1a">
<style>
@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700&family=Bebas+Neue&display=swap');
*{box-sizing:border-box;margin:0;padding:0}
body{background:#1a1a1a;color:#e8e6e0;font-family:'Plus Jakarta Sans',sans-serif;min-height:100vh;padding:0}
.nav{background:#111;border-bottom:4px solid #2a2a2a;padding:14px 24px;display:flex;justify-content:space-between;align-items:center;position:sticky;top:0;z-index:10}
.nav-brand{font-size:12px;font-weight:600;letter-spacing:0.04em;color:#818cf8}
.nav-right{display:flex;align-items:center;gap:12px}
.nav-greeting{font-size:12px;color:#94a3b8}
.nav-date{font-size:11px;color:#94a3b8}
.page{padding:24px;max-width:960px;margin:0 auto}
.hero{margin-bottom:32px;padding-bottom:32px;border-bottom:1px solid rgba(255,255,255,0.06)}
.hero-kicker{font-size:10px;letter-spacing:0.2em;text-transform:uppercase;color:#888;margin-bottom:12px}
.hero h1{font-family:'Bebas Neue',sans-serif;font-size:clamp(36px,6vw,52px);line-height:1;letter-spacing:0.02em;color:#e8e6e0;margin-bottom:12px}
.hero h1 span{color:#e63312}
.hero-lede{font-size:15px;line-height:1.7;color:#94a3b8;max-width:560px;border-left:3px solid #e63312;padding-left:16px}
.stats-strip{display:grid;grid-template-columns:repeat(3,1fr);gap:0;margin-bottom:32px;border:4px solid #2a2a2a;border-radius:14px;overflow:hidden}
.stat-cell{padding:20px;text-align:center;border-right:4px solid #1a1a1a;background:#242424}
.stat-cell:last-child{border-right:none}
.stat-label{font-size:9px;text-transform:uppercase;letter-spacing:0.15em;color:#888;margin-bottom:8px}
.stat-val{font-family:'Bebas Neue',sans-serif;font-size:36px;color:#e63312;line-height:1}
.stat-sub{font-size:10px;color:#888;margin-top:4px}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px}
.card{background:#242424;border:1px solid #2e2e2e;border-radius:14px;padding:20px}
.card-head{font-size:11px;font-weight:600;color:#888;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:16px;display:flex;align-items:center;gap:8px}
.card-head-icon{font-size:16px}
.card-head-line{flex:1;height:1px;background:#2e2e2e}
.done-item{display:flex;align-items:center;gap:10px;padding:8px 12px;margin-bottom:6px;background:#2a2a2a;border:1px solid #333;border-radius:8px}
.done-check{color:#5DCAA5;font-size:14px;flex-shrink:0}
.done-text{font-size:12px;color:#c8c6c0}
.tray-item{display:flex;align-items:center;gap:12px;padding:8px 12px;margin-bottom:4px;background:#2a2a2a;border-radius:8px}
.tray-code{font-family:monospace;font-size:12px;font-weight:700;padding:3px 7px;border-radius:5px;min-width:28px;text-align:center}
.tray-code-p{background:rgba(230,51,18,0.15);color:#e63312}
.tray-code-j{background:rgba(129,140,248,0.1);color:#818cf8}
.tray-name{font-size:12px;color:#c8c6c0;flex:1}
.tray-dots{font-size:10px;color:#555;letter-spacing:1px}
.tray-status{font-size:12px}
.auto-tag{display:inline-block;margin-top:16px;font-size:10px;color:#555;font-family:monospace;letter-spacing:0.05em}
.footer{background:#111;border-top:4px solid #2a2a2a;padding:14px 24px;display:flex;justify-content:space-between;font-size:10px;color:#555;font-family:monospace;margin-top:32px}
@media(max-width:600px){.grid{grid-template-columns:1fr}.stats-strip{grid-template-columns:1fr}.page{padding:16px}.hero h1{font-size:36px}}
</style>
</head>
<body>

<div class="nav">
  <div class="nav-brand">Upstream Consulting</div>
  <div class="nav-right">
    <span class="nav-greeting">End of day, Levi</span>
    <span class="nav-date">${dateDisplay}</span>
  </div>
</div>

<div class="page">

  <div class="hero">
    <div class="hero-kicker">End of Day · ${dayName}</div>
    <h1>Today's <span>Output</span></h1>
    <div class="hero-lede">Auto-generated summary of today's activity across Core and BMN workspaces.</div>
  </div>

  <div class="stats-strip">
    <div class="stat-cell">
      <div class="stat-label">Commits</div>
      <div class="stat-val">${totalCommits}</div>
      <div class="stat-sub">across all repos</div>
    </div>
    <div class="stat-cell">
      <div class="stat-label">Files Changed</div>
      <div class="stat-val">${totalFiles}</div>
      <div class="stat-sub">today</div>
    </div>
    <div class="stat-cell">
      <div class="stat-label">Memories</div>
      <div class="stat-val">${totalMemories}</div>
      <div class="stat-sub">saved or updated</div>
    </div>
  </div>

  <div class="grid">

    <div class="card">
      <div class="card-head"><span class="card-head-icon">✅</span> Activity <div class="card-head-line"></div></div>
${activityRows()}
      <div class="auto-tag">Auto-captured from git + session memory</div>
    </div>

    <div class="card">
      <div class="card-head"><span class="card-head-icon">🎯</span> Tray Snapshot <div class="card-head-line"></div></div>
${trayRows()}
    </div>

  </div>

</div>

<div class="footer">
  <span>Upstream Consulting · upstreamconsulting.ca</span>
  <span>Auto-generated ${now.toISOString().replace('T', ' ').substring(0, 19)}</span>
</div>

</body>
</html>`;

// ── WRITE FILES ───────────────────────────────────────────────────────
fs.writeFileSync(path.join(OUTPUT_DIR, 'EOD.html'), html);
console.log(`✓ EOD.html updated for ${dateDisplay}`);

// Save daily log
const logContent = `# EOD — ${dateDisplay} (${dayName})

## Stats
- Commits: ${totalCommits}
- Files changed: ${totalFiles}
- Memories saved: ${totalMemories}

## Activity
${activities.map(a => `- ${a}`).join('\n')}

## Tray
${trayItems.map(i => `- \`${i.code}\` ${i.name} ${i.dots} ${i.status}`).join('\n')}

---
_Auto-generated ${now.toISOString()}_
`;

fs.mkdirSync(LOGS_DIR, { recursive: true });
fs.writeFileSync(path.join(LOGS_DIR, `${dateStr}.md`), logContent);
console.log(`✓ Log saved to logs/${dateStr}.md`);
