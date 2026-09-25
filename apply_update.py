"""Run from the folder that contains index.html:  python apply_update.py
Makes index.backup.html first. Stops without changing anything if an anchor is missing."""
import re, sys, shutil, pathlib

p = pathlib.Path("index.html")
s = p.read_text(encoding="utf-8")
if 'src="./app.js"' in s:
    sys.exit("Already applied.")

def rep(old, new):
    global s
    if s.count(old) != 1:
        sys.exit(f"STOP: expected 1 match, found {s.count(old)} for: {old[:60]}\nindex.html was NOT changed.")
    s = s.replace(old, new)

def rx(pattern, new):
    global s
    found = re.findall(pattern, s, flags=re.S)
    if len(found) != 1:
        sys.exit(f"STOP: expected 1 match, found {len(found)} for: {pattern[:60]}\nindex.html was NOT changed.")
    s = re.sub(pattern, lambda m: new, s, flags=re.S)

CATEGORY = '''<label>Category / విభాగం</label>
    <div class="row3" id="pick-cat">
      <button class="chip" data-val="all">📖 All</button>
      <button class="chip" data-val="ot">📜 Old<br>Testament</button>
      <button class="chip" data-val="nt">✝️ New<br>Testament</button>
    </div>
    '''

SCREENS = '''<!-- SCREEN: DASHBOARD -->
<div class="screen" id="scr-dashboard">
  <div class="card sheet-card">
    <h1 id="dash-hello" style="font-size:1.35rem;">Hello!</h1>
    <p class="sub">Your progress and statistics</p>
    <div id="dash-stats" style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:6px;"></div>
    <div id="dash-more"></div>
    <div class="sheet-scroll" id="dash-history"></div>
    <button class="btn" id="btn-dash-back" style="margin-top:16px;">Back</button>
  </div>
</div>

<!-- SCREEN: TIMED QUIZ SETUP -->
<div class="screen" id="scr-timed">
  <div class="card">
    <h1 style="font-size:1.5rem;">⏱️ Timed Quiz</h1>
    <p class="sub" id="timed-summary"></p>
    <label>Number of questions / ప్రశ్నల సంఖ్య</label>
    <div class="row3" id="pick-tcount">
      <button class="chip" data-val="5">5<br>ప్రశ్నలు</button>
      <button class="chip" data-val="10">10<br>ప్రశ్నలు</button>
      <button class="chip" data-val="20">20<br>ప్రశ్నలు</button>
    </div>
    <p class="hint">30 seconds per question. The quiz submits automatically when the timer reaches zero.</p>
    <div class="err" id="timed-err"></div>
    <button class="btn" id="btn-timed-start">Start Timed Quiz</button>
    <button class="btn ghost" id="btn-timed-back" style="margin-top:10px;">Back to setup</button>
  </div>
</div>

'''

rep('<link rel="manifest" href="./manifest.webmanifest">',
    '<link rel="stylesheet" href="./app.css">\n<link rel="manifest" href="./manifest.webmanifest">')
rep('<div class="err" id="setup-err"></div>', CATEGORY + '<div class="err" id="setup-err"></div>')
rep('<button class="btn" id="btn-start-quiz">Start Quiz</button>',
    '<button class="btn" id="btn-start-quiz">Start Quiz</button>\n    <button class="btn ghost" id="btn-timed" style="margin-top:10px;">⏱️ Timed Quiz</button>')
rep('<span>Bible Quiz · Official</span>', '<span id="quiz-timer"></span><span>Bible Quiz · Official</span>')
rep('<script id="bank-data" type="application/json">',
    '<footer class="site-footer">© 2026 Torch Bearers. All Rights Reserved.</footer>\n<script id="bank-data" type="application/json">')
rx(r'<!-- SCREEN: DASHBOARD -->.*?(?=<!-- SCREEN 4: QUIZ)', SCREENS)
rx(r'<script>\s*\(function\(\)\{\s*"use strict";.*?\}\)\(\);\s*</script>', '<script src="./app.js"></script>')
rep('</body>', '<script type="module" src="./db.js"></script>\n</body>')

shutil.copy("index.html", "index.backup.html")
p.write_text(s, encoding="utf-8")
print("Done. Backup saved as index.backup.html")
