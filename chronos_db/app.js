const ERAS = {
  today:    { name: 'Today',     icon: '⚡', color: '#667eea' },
  tomorrow: { name: 'Tomorrow',  icon: '🌅', color: '#ed8936' },
  week:     { name: 'This Week', icon: '📆', color: '#48bb78' },
  someday:  { name: 'Someday',   icon: '🌌', color: '#9f7aea' }
};

let tasks = [];
let streak = Number(localStorage.getItem('streak')) || 0;
let lastActive = localStorage.getItem('lastActive') || '';
let activeEra = null;
let searchQuery = '';
let soundEnabled = localStorage.getItem('soundEnabled') !== 'false';

const body = document.body;
const themeBtn = document.getElementById('themeBtn');
const soundBtn = document.getElementById('soundBtn');
const input = document.getElementById('taskInput');
const titleInput = document.getElementById('titleInput');
const timeInput = document.getElementById('timeInput');
const searchInput = document.getElementById('searchInput');
const eraSelect = document.getElementById('eraSelect');
const addBtn = document.getElementById('addBtn');
const timeline = document.getElementById('timeline');
const taskList = document.getElementById('taskList');
const modalBg = document.getElementById('modalBg');
const modal = document.getElementById('modal');
const modalTitle = document.getElementById('modalTitle');
const modalSub = document.getElementById('modalSub');
const modalList = document.getElementById('modalList');
const closeBtn = document.getElementById('closeBtn');
const toast = document.getElementById('toast');

let reminderInterval = null;
let alarmInterval = null;

// API calls
async function fetchTasks() {
  try {
    const res = await fetch('api.php');
    tasks = await res.json();
    render();
    runOpenReminder();
  } catch (err) {
    showToast('Failed to load tasks from server', 'warn');
  }
}

function applyTheme(theme) {
  body.setAttribute('data-theme', theme);
  themeBtn.textContent = theme === 'dark' ? '☀️' : '🌙';
  localStorage.setItem('theme', theme);
}

function applySound() {
  soundBtn.textContent = soundEnabled ? '🔔' : '🔕';
  soundBtn.classList.toggle('muted', !soundEnabled);
}

function updateStreak() {
  const today = new Date().toDateString();
  if (lastActive === today) return;

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);

  streak = lastActive === yesterday.toDateString() ? streak + 1 : 1;
  lastActive = today;
  localStorage.setItem('streak', streak);
  localStorage.setItem('lastActive', lastActive);
}

function playDing() {
  if (!soundEnabled) return;
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1320, ctx.currentTime + 0.1);
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.2);
  } catch (e) {}
}

function playTikTok() {
  if (!soundEnabled) return;
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const tick = (time, freq) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'square';
      osc.frequency.setValueAtTime(freq, time);
      gain.gain.setValueAtTime(0.08, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + 0.08);
      osc.start(time);
      osc.stop(time + 0.08);
    };
    const now = ctx.currentTime;
    tick(now, 1200);
    tick(now + 0.25, 900);
    tick(now + 0.5, 1200);
  } catch (e) {}
}

function playAlarm() {
  if (!soundEnabled) return;
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const now = ctx.currentTime;

    for (let i = 0; i < 4; i++) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.type = 'triangle';
      const t = now + i * 0.18;
      osc.frequency.setValueAtTime(880, t);
      osc.frequency.setValueAtTime(1100, t + 0.08);

      gain.gain.setValueAtTime(0.18, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);

      osc.start(t);
      osc.stop(t + 0.15);
    }
  } catch (e) {}
}

function celebrate() {
  if (typeof confetti === 'function') {
    confetti({
      particleCount: 140,
      spread: 80,
      origin: { y: 0.6 },
      colors: ['#8b5cf6', '#a78bfa', '#ec4899', '#f59e0b']
    });
  }
}

function showToast(message, type) {
  toast.textContent = message;
  toast.classList.remove('warn', 'info');
  if (type === 'warn') toast.classList.add('warn');
  if (type === 'info') toast.classList.add('info');
  toast.classList.add('show');
  clearTimeout(showToast._timer);
  showToast._timer = setTimeout(() => toast.classList.remove('show'), 2600);
}

function getCountdown(eraKey) {
  const now = new Date();
  const target = new Date();

  if (eraKey === 'today') target.setHours(23, 59, 59, 999);
  else if (eraKey === 'tomorrow') {
    target.setDate(target.getDate() + 1);
    target.setHours(23, 59, 59, 999);
  } else if (eraKey === 'week') {
    target.setDate(target.getDate() + (7 - target.getDay()));
    target.setHours(23, 59, 59, 999);
  } else return null;

  const diff = target - now;
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(hours / 24);

  if (days >= 1) return `${days}d left`;
  if (hours >= 1) return `${hours}h left`;
  return 'soon';
}

function getPendingCount() {
  return tasks.filter(t => !t.done).length;
}

function checkAlarms() {
  const now = new Date();
  const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  tasks.forEach(task => {
    if (
      !task.done &&
      task.time &&
      !task.alarmFired &&
      task.time === currentTime
    ) {
      task.alarmFired = true;
      playAlarm();
      showToast(`⏰ ${task.title || task.text}`, 'warn');
      render();
    }
  });
}

function startAlarmLoop() {
  if (alarmInterval) return;
  alarmInterval = setInterval(checkAlarms, 10000);
}

function startReminderLoop() {
  if (reminderInterval) clearInterval(reminderInterval);
  reminderInterval = setInterval(() => {
    const pending = getPendingCount();
    if (pending > 0) {
      playTikTok();
      showToast(`⏰ ${pending} task${pending !== 1 ? 's' : ''} still pending`, 'warn');
    } else {
      clearInterval(reminderInterval);
      reminderInterval = null;
    }
  }, 60000);
}

function runOpenReminder() {
  const pending = getPendingCount();
  if (pending > 0) {
    setTimeout(() => {
      playTikTok();
      showToast(`⏰ You have ${pending} pending task${pending !== 1 ? 's' : ''}`, 'warn');
    }, 800);
    startReminderLoop();
  }
}

async function addTask() {
  const text = input.value.trim();
  const title = titleInput.value.trim();
  const time = timeInput.value;
  if (!text) return alert('Please type a task!');

  const res = await fetch('api.php', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'add', text, title, time, era: eraSelect.value })
  });

  const data = await res.json();
  if (data.success) {
    input.value = '';
    titleInput.value = '';
    timeInput.value = '';
    updateStreak();
    await fetchTasks();
    showToast('✓ Task added', 'info');

    if (!reminderInterval && getPendingCount() > 0) startReminderLoop();
    startAlarmLoop();
  }
}

async function toggle(id) {
  const res = await fetch('api.php', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'toggle', id })
  });

  const data = await res.json();
  if (data.success) {
    const task = tasks.find(t => t.id === id);
    task.done = !task.done;
    render();
    if (activeEra) openModal(activeEra);

    if (task.done) {
      const totalDone = tasks.filter(t => t.done).length;
      const allDone = tasks.length > 0 && totalDone === tasks.length;

      playDing();

      if (allDone) {
        celebrate();
        showToast('🎉 All tasks complete. Legendary.');
        if (reminderInterval) {
          clearInterval(reminderInterval);
          reminderInterval = null;
        }
      } else {
        const eraTasks = tasks.filter(t => t.era === task.era);
        const eraDone = eraTasks.every(t => t.done);

        if (eraDone && eraTasks.length > 0) {
          celebrate();
          showToast(`🏆 ${ERAS[task.era].name} cleared`);
        } else {
          showToast(`✓ ${totalDone} of ${tasks.length} done`);
        }
      }
    }
  }
}

async function deleteTask(id) {
  const res = await fetch('api.php', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'delete', id })
  });

  const data = await res.json();
  if (data.success) {
    await fetchTasks();
    if (activeEra) openModal(activeEra);
  }
}

function getVisibleTasks() {
  if (!searchQuery) return tasks;
  const q = searchQuery.toLowerCase();
  return tasks.filter(t =>
    t.text.toLowerCase().includes(q) ||
    (t.title && t.title.toLowerCase().includes(q))
  );
}

function render() {
  timeline.innerHTML = Object.keys(ERAS).map(key => {
    const era = ERAS[key];
    const list = tasks.filter(t => t.era === key);
    const allDone = list.length > 0 && list.every(t => t.done);

    return `
      <div class="era-card ${allDone ? 'complete' : ''}" style="--color:${era.color}" data-era="${key}">
        <span class="era-icon">${era.icon}</span>
        <div class="era-name">${era.name.toUpperCase()}</div>
        <div class="era-count">${list.length} task${list.length !== 1 ? 's' : ''}</div>
      </div>
    `;
  }).join('');

  const visible = getVisibleTasks();

  taskList.innerHTML = visible.length
    ? visible.slice().map(t => {
        const era = ERAS[t.era];
        const countdown = getCountdown(t.era);

        return `
          <li class="task ${t.done ? 'done' : ''} ${t.alarmFired && !t.done ? 'ringing' : ''}">
            <input type="checkbox" class="check" ${t.done ? 'checked' : ''} data-toggle="${t.id}">
            <div class="task-body">
              ${t.title ? `<span class="task-title">${t.title}</span>` : ''}
              <span class="text">${t.text}</span>
            </div>
            ${t.time ? `<span class="task-time">🕐 ${t.time}</span>` : ''}
            ${countdown ? `<span class="countdown ${countdown.includes('d') ? '' : 'safe'}">⏱ ${countdown}</span>` : ''}
            <span class="era-tag" style="color:${era.color};background:${era.color}20">${era.icon} ${era.name}</span>
            <button class="del" data-delete="${t.id}">✕</button>
          </li>
        `;
      }).join('')
    : `<li class="empty">${searchQuery ? 'No tasks match your search.' : 'No tasks yet. Add one above!'}</li>`;

  const total = tasks.length;
  const done = tasks.filter(t => t.done).length;
  const pending = total - done;
  const pct = total ? Math.round((done / total) * 100) : 0;

  document.getElementById('statStreak').textContent = streak;
  document.getElementById('statTotal').textContent = total;
  document.getElementById('statDone').textContent = done;
  document.getElementById('statPending').textContent = pending;
  document.getElementById('statPct').textContent = pct + '%';
}

function openModal(eraKey) {
  activeEra = eraKey;
  const era = ERAS[eraKey];
  const list = tasks.filter(t => t.era === eraKey);

  modal.style.setProperty('--color', era.color);
  modalTitle.textContent = `${era.icon} ${era.name}`;
  modalSub.textContent = `${list.length} task${list.length !== 1 ? 's' : ''} in this timeline`;

  modalList.innerHTML = list.length
    ? list.slice().map(t => `
        <li class="task ${t.done ? 'done' : ''}">
          <input type="checkbox" class="check" ${t.done ? 'checked' : ''} data-toggle="${t.id}">
          <div class="task-body">
            ${t.title ? `<span class="task-title">${t.title}</span>` : ''}
            <span class="text">${t.text}</span>
          </div>
          ${t.time ? `<span class="task-time">🕐 ${t.time}</span>` : ''}
          <button class="del" data-delete="${t.id}">✕</button>
        </li>
      `).join('')
    : '<li class="empty">No tasks in this timeline.</li>';

  modalBg.classList.add('show');
}

function closeModal() {
  modalBg.classList.remove('show');
  activeEra = null;
}

themeBtn.addEventListener('click', () => {
  const current = body.getAttribute('data-theme');
  applyTheme(current === 'dark' ? 'light' : 'dark');
});

soundBtn.addEventListener('click', () => {
  soundEnabled = !soundEnabled;
  localStorage.setItem('soundEnabled', soundEnabled);
  applySound();
  showToast(soundEnabled ? '🔔 Sound on' : '🔕 Sound off', 'info');
});

timeline.addEventListener('click', e => {
  const card = e.target.closest('.era-card');
  if (card) openModal(card.dataset.era);
});

taskList.addEventListener('click', e => {
  const toggleId = e.target.dataset.toggle;
  const deleteId = e.target.dataset.delete;
  if (toggleId) toggle(Number(toggleId));
  if (deleteId) deleteTask(Number(deleteId));
});

modalList.addEventListener('click', e => {
  const toggleId = e.target.dataset.toggle;
  const deleteId = e.target.dataset.delete;
  if (toggleId) toggle(Number(toggleId));
  if (deleteId) deleteTask(Number(deleteId));
});

modalBg.addEventListener('click', e => {
  if (e.target === modalBg) closeModal();
});

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeModal();
});

searchInput.addEventListener('input', e => {
  searchQuery = e.target.value.trim();
  render();
});

addBtn.addEventListener('click', addTask);

input.addEventListener('keydown', e => {
  if (e.key === 'Enter') addTask();
});

titleInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') addTask();
});

closeBtn.addEventListener('click', closeModal);

const savedTheme = localStorage.getItem('theme') || 'light';
applyTheme(savedTheme);
applySound();

if (!lastActive) updateStreak();

fetchTasks();
startAlarmLoop();