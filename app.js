(function(){
"use strict";
let BANK = JSON.parse(document.getElementById('bank-data').textContent);

/* --- data cleanup: fixes stray Telugu words in English options, and
   removes exact duplicate questions (same language+text+difficulty)
   that exist in the original question bank. Safe no-op if already clean. --- */
function fixStrayTelugu(bank){
  const swap = { 'లామెకు':'Lamech', 'నూహు':'Noah', 'లేయా':'Leah', 'రెహబాము':'Rehoboam' };
  bank.forEach(q => {
    if (q.lang !== 'en') return;
    q.opts = q.opts.map(o => swap[o] || o);
  });
}
function dedupeBank(bank){
  const seen = new Set(), out = [];
  bank.forEach(q => {
    const key = q.lang + '|' + q.diff + '|' + q.q;
    if (seen.has(key)) return;
    seen.add(key); out.push(q);
  });
  return out;
}
fixStrayTelugu(BANK);
BANK = dedupeBank(BANK);

/* Tag every question Old (ot) or New (nt) Testament from its id */
BANK.forEach(q => {
  let m, nt = false;
  if ((m = q.id.match(/^(?:en|te1)-(\d+)$/))) nt = ((+m[1] - 1) % 50) + 1 >= 39;   // Jesus' birth onward
  else if ((m = q.id.match(/^te2-BIB-(\d+)/))) nt = +m[1] >= 40;                    // books 40-66
  q.t = nt ? 'nt' : 'ot';
});

const state = { user:null, lang:'en', age:'kids', level:1, count:10, cat:'all', tcount:10,
                mode:'practice', quiz:[], idx:0, answers:[] };
let tick = null, timeLeft = 0, startedAt = 0;
const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const CATN = { all:'All Bible', ot:'Old Testament', nt:'New Testament' };
const TL = { ot:'📜 Old Testament', nt:'✝️ New Testament' };
const fmt = s => Math.floor(s/60) + ':' + String(s%60).padStart(2,'0');
const track = (n,p) => { if (window.bqDB) window.bqDB.track(n,p); };

function show(id){
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  $(id).classList.add('active');
}
function setTheme(age){ document.body.setAttribute('data-theme', age === 'kids' ? 'kids' : 'adults'); }

/* AUTH */
window.addEventListener('firebase-auth-state', ({ detail: user }) => {
  state.user = user;
  localStorage.setItem('bq_user', JSON.stringify(user));
  $('welcome-name').textContent = 'Welcome, ' + user.name + '!';
  show('scr-welcome');
});
$('btn-logout').addEventListener('click', async () => {
  try { await window.firebaseLogout(); } catch (e) { console.error('Logout error:', e); }
});
$('btn-to-setup').addEventListener('click', () => show('scr-setup'));
$('btn-to-dashboard').addEventListener('click', () => { renderDashboard(); show('scr-dashboard'); });
$('btn-dash-back').addEventListener('click', () => show('scr-welcome'));

/* SETUP */
function wirePicker(groupId, key, onPick){
  const group = $(groupId);
  group.querySelectorAll('.chip').forEach(btn => btn.addEventListener('click', () => {
    group.querySelectorAll('.chip').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
    state[key] = isNaN(btn.dataset.val) ? btn.dataset.val : Number(btn.dataset.val);
    if (onPick) onPick(btn.dataset.val);
  }));
}
wirePicker('pick-lang','lang'); wirePicker('pick-age','age', setTheme);
wirePicker('pick-count','count'); wirePicker('pick-cat','cat'); wirePicker('pick-tcount','tcount');
[['pick-lang','en'],['pick-age','kids'],['pick-count','10'],['pick-cat','all'],['pick-tcount','10']]
  .forEach(([g,v]) => document.querySelector('#'+g+' [data-val="'+v+'"]').click());

function ageMatches(qAge, pick){
  if (qAge === 'both') return true;
  if (pick === 'kids') return qAge === 'children' || qAge === 'youth';
  return qAge === 'adults';
}
function shuffle(arr){
  const a = arr.slice();
  for (let i = a.length-1; i > 0; i--){ const j = Math.floor(Math.random()*(i+1)); [a[i],a[j]] = [a[j],a[i]]; }
  return a;
}
const DIFF_ORDER = { basic:0, medium:1, advanced:2 };
function levelPool(lang, level){
  const list = BANK.filter(q => q.lang === lang).sort((a,b) => DIFF_ORDER[a.diff]-DIFF_ORDER[b.diff]);
  const per = Math.ceil(list.length / 30);
  return list.slice((level-1)*per, level*per);
}
function levelBand(level){ return level <= 10 ? 'Basic' : level <= 20 ? 'Medium' : 'Advanced'; }

/* Question pool for the current level + category. If a level has too few
   questions in one Testament, fall back to that difficulty band. */
function buildPool(){
  const okC = q => state.cat === 'all' || q.t === state.cat;
  const uniq = a => { const s = new Set(); return a.filter(q => !s.has(q.q) && s.add(q.q)); };
  const lv = levelPool(state.lang, state.level).filter(okC);
  let p = lv.filter(q => ageMatches(q.age, state.age));
  if (p.length < 4) p = lv;
  if (p.length < 5){
    const band = levelBand(state.level).toLowerCase();
    const b = BANK.filter(q => q.lang === state.lang && q.diff === band && okC(q));
    p = b.filter(q => ageMatches(q.age, state.age));
    if (p.length < 4) p = b;
  }
  return uniq(p);
}

function buildLevelGrid(){
  const grid = $('level-grid'); grid.innerHTML = '';
  for (let lvl = 1; lvl <= 30; lvl++){
    const b = document.createElement('button');
    b.className = 'chip' + (lvl === state.level ? ' selected' : '');
    b.textContent = lvl; b.title = levelBand(lvl);
    b.addEventListener('click', () => {
      state.level = lvl;
      $('chosen-level-label').textContent = 'Level ' + lvl + ' · ' + levelBand(lvl);
      show('scr-setup');
    });
    grid.appendChild(b);
  }
}
$('btn-open-levels').addEventListener('click', () => { buildLevelGrid(); show('scr-levels'); });
$('btn-levels-back').addEventListener('click', () => show('scr-setup'));

/* START (practice or timed) */
function begin(mode, count){
  const p = buildPool();
  const errBox = $(mode === 'timed' ? 'timed-err' : 'setup-err');
  if (!p.length){ errBox.textContent = 'No questions available for this selection yet.'; return; }
  errBox.textContent = '';
  state.mode = mode;
  state.quiz = shuffle(p).slice(0, Math.min(count, p.length));
  state.idx = 0; state.answers = [];
  track('quiz_start', { mode, category: state.cat, lang: state.lang, level: state.level });
  show('scr-quiz'); renderQuestion(); startTimer();
}
$('btn-start-quiz').addEventListener('click', () => begin('practice', state.count));
$('btn-timed').addEventListener('click', () => {
  $('timed-summary').textContent = [state.lang === 'en' ? 'English' : 'తెలుగు',
    state.age === 'kids' ? 'Kids' : 'Adults', 'Level ' + state.level + ' · ' + levelBand(state.level), CATN[state.cat]].join(' · ');
  $('timed-err').textContent = '';
  show('scr-timed');
});
$('btn-timed-start').addEventListener('click', () => begin('timed', state.tcount));
$('btn-timed-back').addEventListener('click', () => show('scr-setup'));

/* TIMER — 30 seconds per question, auto-submits at zero */
function stopTimer(){ clearInterval(tick); tick = null; }
function startTimer(){
  stopTimer();
  const el = $('quiz-timer');
  startedAt = Date.now();
  if (state.mode !== 'timed'){ el.textContent = ''; el.className = ''; return; }
  timeLeft = state.quiz.length * 30;
  const paint = () => { el.textContent = '⏱️ ' + fmt(Math.max(0, timeLeft)); el.className = 'timer' + (timeLeft <= 10 ? ' low' : ''); };
  paint();
  tick = setInterval(() => { timeLeft--; paint(); if (timeLeft <= 0) finishQuiz(true); }, 1000);
}

/* QUIZ */
function renderQuestion(){
  const q = state.quiz[state.idx];
  $('quiz-progress-label').textContent = `Question ${state.idx+1}/${state.quiz.length}`;
  $('progress-fill').style.width = (state.idx / state.quiz.length * 100) + '%';
  $('q-cat').textContent = TL[q.t];
  $('q-text').textContent = q.q;
  const box = $('q-opts'); box.innerHTML = '';
  const prev = state.answers[state.idx];
  q.opts.forEach((opt, i) => {
    const b = document.createElement('button');
    b.className = 'opt-pill' + (prev === i ? ' selected' : '');
    b.innerHTML = `<span>${esc(opt)}</span><span class="tick">✓</span>`;
    b.addEventListener('click', () => {
      document.querySelectorAll('#q-opts .opt-pill').forEach(el => el.classList.remove('selected'));
      b.classList.add('selected'); state.answers[state.idx] = i; $('btn-next').disabled = false;
    });
    box.appendChild(b);
  });
  $('btn-next').disabled = prev === undefined;
  $('btn-back').disabled = state.idx === 0;
}
$('btn-next').addEventListener('click', () => {
  state.idx++;
  if (state.idx >= state.quiz.length) finishQuiz(false); else renderQuestion();
});
$('btn-back').addEventListener('click', () => { if (state.idx > 0){ state.idx--; renderQuestion(); } });
$('btn-exit').addEventListener('click', () => {
  stopTimer(); state.quiz = []; state.idx = 0; state.answers = []; show('scr-setup');
});

/* RESULT */
function launchConfetti(host, n){
  const colors = ['#CE4D1C','#E8794A','#DECAB4','#a9865f'];
  for (let i = 0; i < n; i++){
    const c = document.createElement('div');
    c.className = 'confetti';
    c.style.left = Math.random()*100 + '%';
    c.style.background = colors[i % colors.length];
    c.style.animationDelay = (Math.random()*0.5) + 's';
    host.appendChild(c); setTimeout(() => c.remove(), 2500);
  }
}
function finishQuiz(auto){
  stopTimer();
  if (!state.quiz.length) return;
  const total = state.quiz.length;
  const tally = { ot:{c:0,t:0}, nt:{c:0,t:0} };
  let score = 0;
  state.quiz.forEach((q, i) => {
    const ok = state.answers[i] === q.ai;
    tally[q.t].t++; if (ok){ score++; tally[q.t].c++; }
  });
  const pct = Math.round(score/total*100);
  const secs = Math.round((Date.now() - startedAt) / 1000);

  const C = 502, ring = $('ring-fg');
  ring.style.setProperty('--ring-len', C);
  ring.style.setProperty('--ring-off', C - (pct/100)*C);
  ring.style.animation = 'none'; void ring.offsetWidth; ring.style.animation = null;
  $('ring-frac').textContent = `${score}/${total}`;
  let shown = 0; const step = Math.max(1, Math.round(score/25));
  const t = setInterval(() => { shown = Math.min(score, shown + step); $('ring-pct').textContent = shown; if (shown >= score) clearInterval(t); }, 40);

  $('dear-line').innerHTML = 'Dear <b>' + esc((state.user && state.user.name) || 'Guest') + '</b>,';
  let medal, title, msg;
  if (pct === 100){ medal='🏆'; title='Perfect Score — Certified Scholar'; msg='Flawless! Every answer correct.'; }
  else if (pct >= 70){ medal='🌟'; title='Certificate of Excellence'; msg='Great job! You know your Bible well.'; }
  else if (pct >= 40){ medal='📖'; title='Certificate of Participation'; msg='Good effort — keep studying and try again.'; }
  else { medal=''; title='Keep Growing'; msg='Every attempt helps you learn more.'; }
  if (state.mode === 'timed') msg = (auto ? "Time's up! " : '') + 'Time taken: ' + fmt(secs) + '. ' + msg;
  $('result-medal').textContent = medal; $('result-title').textContent = title; $('result-msg').textContent = msg;
  show('scr-result');
  if (pct >= 70) launchConfetti($('score-confetti-host'), pct === 100 ? 40 : 24);

  saveAttempt({ ts:Date.now(), lang:state.lang, age:state.age, level:state.level, band:levelBand(state.level),
                cat:state.cat, mode:state.mode, score, total, pct, secs, ot:tally.ot, nt:tally.nt });
}

/* SAVE + DASHBOARD */
const lkey = () => 'bq_attempts_' + (state.user ? state.user.uid : 'guest');
function localLoad(){ try { return JSON.parse(localStorage.getItem(lkey()) || '[]'); } catch (e) { return []; } }
function saveAttempt(a){
  const h = localLoad(); h.unshift(a);
  localStorage.setItem(lkey(), JSON.stringify(h.slice(0, 100)));   // offline backup
  if (window.bqDB){
    window.bqDB.saveAttempt(a).catch(e => console.warn('Firestore save failed:', e));
    track('quiz_complete', { mode:a.mode, category:a.cat, lang:a.lang, level:a.level, score:a.score });
  }
}
function streak(h){
  const days = new Set(h.map(a => new Date(a.ts).toDateString()));
  const d = new Date(); let n = 0;
  if (!days.has(d.toDateString())) d.setDate(d.getDate() - 1);
  while (days.has(d.toDateString())){ n++; d.setDate(d.getDate() - 1); }
  return n;
}
async function renderDashboard(){
  $('dash-hello').textContent = 'Hello, ' + ((state.user && state.user.name) || 'Guest') + '!';
  const box = $('dash-stats'), more = $('dash-more'), list = $('dash-history');
  box.innerHTML = '<div class="sheet-line" style="grid-column:1/-1;">Loading…</div>'; more.innerHTML = ''; list.innerHTML = '';
  let h = [];
  try { if (window.bqDB) h = await window.bqDB.loadAttempts(); } catch (e) { console.warn('Firestore load failed:', e); }
  if (!h.length) h = localLoad();
  if (!h.length){ box.innerHTML = '<div class="sheet-line" style="grid-column:1/-1;">No attempts yet — take a quiz to see your stats here.</div>'; return; }

  const sum = k => h.reduce((s,a) => s + (a[k] || 0), 0);
  const n = h.length, cor = sum('score'), tot = sum('total');
  const acc = tot ? Math.round(cor/tot*100) : 0;
  const best = Math.max(...h.map(a => a.pct));
  const avg = Math.round(h.reduce((s,a) => s + a.pct, 0) / n);
  const timed = h.filter(a => a.mode === 'timed').length;
  const st = streak(h);
  const S = (l,v) => `<div class="stat"><b>${v}</b><span>${l}</span></div>`;
  box.innerHTML = S('Quizzes',n) + S('Accuracy',acc+'%') + S('Correct',cor) + S('Wrong',tot-cor)
                + S('Best score',best+'%') + S('Average',avg+'%') + S('Timed quizzes',timed) + S('Day streak 🔥',st);

  const tp = k => { let c=0, t=0; h.forEach(a => { if (a[k]){ c += a[k].c; t += a[k].t; } }); return t ? Math.round(c/t*100) : null; };
  const bar = (l,p) => `<div class="bar-row"><span>${l}</span><div class="bar"><i style="width:${p||0}%"></i></div><b>${p === null ? '–' : p+'%'}</b></div>`;
  const last = h.slice(0, 8).reverse();
  const spark = last.map(a => `<div class="spark-col" title="${a.pct}%"><i style="height:${Math.max(4,a.pct)}%"></i></div>`).join('');
  const badges = [[n>=1,'🥇','First quiz'],[best===100,'🎯','Perfect score'],[timed>=1,'⏱️','Beat the clock'],
                  [st>=3,'🔥','3-day streak'],[n>=10,'📚','10 quizzes']]
    .map(([ok,i,l]) => `<span class="badge${ok?' on':''}">${i} ${l}</span>`).join('');
  more.innerHTML = '<label>Old vs New Testament</label>' + bar('📜 Old', tp('ot')) + bar('✝️ New', tp('nt'))
    + '<label>Last scores</label><div class="spark">' + spark + '</div>'
    + '<label>Achievements</label><div class="badges">' + badges + '</div><label>Recent attempts</label>';

  h.slice(0, 15).forEach(a => {
    const row = document.createElement('div'); row.className = 'sheet-row';
    row.innerHTML = `<div class="sheet-q">${new Date(a.ts).toLocaleString()} — ${a.mode === 'timed' ? '⏱️ ' : ''}${a.lang === 'en' ? 'English' : 'తెలుగు'}, Level ${a.level} · ${CATN[a.cat] || 'All Bible'}</div>
      <div class="sheet-line"><span class="sheet-tag">Score</span><span>${a.score}/${a.total} (${a.pct}%)${a.secs && a.mode === 'timed' ? ' · ' + fmt(a.secs) : ''}</span></div>`;
    list.appendChild(row);
  });
}

/* ANSWER SHEET */
function buildSheet(){
  const list = $('sheet-list'); list.innerHTML = '';
  let ok = 0;
  state.quiz.forEach((q, i) => {
    const chosen = state.answers[i], right = chosen === q.ai;
    if (right) ok++;
    const row = document.createElement('div'); row.className = 'sheet-row';
    row.style.animationDelay = (i*0.03) + 's';
    row.innerHTML = `
      <div class="sheet-q">${esc(q.q)} <span class="${right?'icon-ok':'icon-no'}">${right?'✔':'✘'}</span></div>
      <div class="sheet-line"><span class="sheet-tag">Your answer</span><span class="sheet-your ${right?'correct':''}">${chosen === undefined ? '(skipped)' : esc(q.opts[chosen])}</span></div>
      <div class="sheet-line"><span class="sheet-tag">Correct answer</span><span class="sheet-correct">${esc(q.opts[q.ai])}</span></div>`;
    list.appendChild(row);
  });
  $('sheet-summary').textContent = `You got ${ok} of ${state.quiz.length} correct.`;
}
$('btn-view-sheet').addEventListener('click', () => { buildSheet(); show('scr-sheet'); });
$('btn-sheet-back').addEventListener('click', () => show('scr-result'));
$('btn-retry').addEventListener('click', () => {
  state.quiz = shuffle(state.quiz); state.idx = 0; state.answers = [];
  show('scr-quiz'); renderQuestion(); startTimer();
});
$('btn-change-setup').addEventListener('click', () => show('scr-setup'));
$('chosen-level-label').textContent = 'Level 1 · Basic';
})();
