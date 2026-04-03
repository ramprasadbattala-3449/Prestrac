/* Leave Tracker — Frontend JS */

const COLORS = {
  office: '#639922', wfh: '#378ADD', shift: '#7F77DD',
  leave: '#BA7517', sick: '#E24B4A'
};
const LABELS = {
  office: 'Office', wfh: 'WFH', shift: 'Shift change',
  leave: 'Planned leave', sick: 'Sick leave'
};
const MODES = ['office', 'wfh', 'shift', 'leave', 'sick'];

let donutInst = null, barInst = null;
let selectedShift = '';

// ── Tab switching ──────────────────────────────────────────────────────────

document.querySelectorAll('.tab').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    const tab = btn.dataset.tab;
    document.getElementById('panel-' + tab).classList.add('active');
    if (tab === 'visual') renderVisual();
    if (tab === 'dashboard') renderDash();
    if (tab === 'history') renderHistory();
  });
});

// ── Date helpers ───────────────────────────────────────────────────────────

function countWD(from, to) {
  let count = 0, d = new Date(from + 'T00:00:00'), end = new Date(to + 'T00:00:00');
  while (d <= end) { if (d.getDay() > 0 && d.getDay() < 6) count++; d.setDate(d.getDate() + 1); }
  return count;
}

function updateHint() {
  const from = document.getElementById('f-from').value;
  const to = document.getElementById('f-to').value;
  const h = document.getElementById('date-hint');
  if (!from || !to) { h.innerHTML = ''; return; }
  if (to < from) { h.innerHTML = '<span class="er">To date must be on or after From date</span>'; return; }
  const wd = countWD(from, to);
  const cal = Math.round((new Date(to) - new Date(from)) / 86400000) + 1;
  h.innerHTML = `<span class="hl">${wd}</span> working day${wd !== 1 ? 's' : ''} (${cal} calendar day${cal !== 1 ? 's' : ''})`;
}

document.getElementById('f-from').addEventListener('input', updateHint);
document.getElementById('f-to').addEventListener('input', updateHint);
updateHint();

// ── Work mode / shift ──────────────────────────────────────────────────────

document.getElementById('f-mode').addEventListener('change', function () {
  const box = document.getElementById('shift-box');
  box.style.display = this.value === 'shift' ? 'block' : 'none';
  if (this.value !== 'shift') { selectedShift = ''; clearShiftTiles(); }
});

document.querySelectorAll('.shift-tile').forEach(tile => {
  tile.addEventListener('click', () => {
    selectedShift = tile.dataset.shift;
    clearShiftTiles();
    tile.classList.add('selected');
  });
});

function clearShiftTiles() {
  document.querySelectorAll('.shift-tile').forEach(t => t.classList.remove('selected'));
}

// ── Log entry submission ───────────────────────────────────────────────────

document.getElementById('submit-btn').addEventListener('click', async () => {
  const name = document.getElementById('f-name').value;
  const from = document.getElementById('f-from').value;
  const to = document.getElementById('f-to').value;
  const mode = document.getElementById('f-mode').value;
  const notes = document.getElementById('f-notes').value;
  const shiftReason = document.getElementById('f-shift-reason').value;
  const ok = document.getElementById('ok-msg');
  const er = document.getElementById('er-msg');
  ok.style.display = 'none'; er.style.display = 'none';

  if (!name || !from || !to || !mode) { showMsg(er, 'Please fill in all required fields.'); return; }
  if (to < from) { showMsg(er, 'To date must be on or after From date.'); return; }
  if (mode === 'shift' && !selectedShift) { showMsg(er, 'Please select a shift type.'); return; }

  const payload = { from, to, name, mode, notes, shift: selectedShift, shiftReason };

  try {
    const res = await fetch('/api/entries', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) { showMsg(er, data.error || 'Submission failed.'); return; }

    showMsg(ok, `Saved — ${name}, ${LABELS[mode]}, ${data.days} working day${data.days !== 1 ? 's' : ''}.`);
    document.getElementById('f-name').value = '';
    document.getElementById('f-mode').value = '';
    document.getElementById('f-notes').value = '';
    document.getElementById('f-shift-reason').value = '';
    document.getElementById('shift-box').style.display = 'none';
    selectedShift = ''; clearShiftTiles(); updateHint();
  } catch (e) {
    showMsg(er, 'Network error. Please try again.');
  }
});

function showMsg(el, text) {
  el.textContent = text;
  el.style.display = 'block';
  setTimeout(() => el.style.display = 'none', 5000);
}

// ── Visual reference ───────────────────────────────────────────────────────

document.getElementById('viz-month').addEventListener('change', renderVisual);
document.getElementById('viz-view').addEventListener('change', renderVisual);

async function renderVisual() {
  const month = document.getElementById('viz-month').value;
  const view = document.getElementById('viz-view').value;

  const res = await fetch(`/api/summary?month=${month}`);
  const data = await res.json();

  // Stats
  const t = data.totals;
  document.getElementById('viz-stats').innerHTML = `
    <div class="stat-card"><div class="stat-label">Total days</div><div class="stat-val">${data.grand_total}</div></div>
    <div class="stat-card"><div class="stat-label">Office</div><div class="stat-val green">${t.office}</div></div>
    <div class="stat-card"><div class="stat-label">WFH</div><div class="stat-val blue">${t.wfh}</div></div>
    <div class="stat-card"><div class="stat-label">Shift changes</div><div class="stat-val purple">${t.shift}</div></div>
    <div class="stat-card"><div class="stat-label">All leaves</div><div class="stat-val red">${t.leave + t.sick}</div></div>
  `;

  const grand = data.grand_total || 1;

  // Donut legend
  document.getElementById('donut-legend').innerHTML = MODES.map(m =>
    `<span><span class="legend-dot" style="background:${COLORS[m]}"></span>${LABELS[m]} ${Math.round((t[m] || 0) / grand * 100)}%</span>`
  ).join('');

  // Donut chart
  if (donutInst) donutInst.destroy();
  donutInst = new Chart(document.getElementById('donutChart'), {
    type: 'doughnut',
    data: {
      labels: MODES.map(m => LABELS[m]),
      datasets: [{ data: MODES.map(m => t[m] || 0), backgroundColor: MODES.map(m => COLORS[m]), borderWidth: 0, hoverOffset: 4 }]
    },
    options: {
      responsive: true, maintainAspectRatio: false, cutout: '62%',
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => ` ${ctx.label}: ${ctx.parsed} days` } } }
    }
  });

  // Bar chart
  const names = data.persons.map(p => p.name.split(' ')[0]);
  const barH = Math.max(220, data.persons.length * 46 + 60);
  document.getElementById('bar-wrap').style.height = barH + 'px';

  document.getElementById('bar-legend').innerHTML = MODES.map(m =>
    `<span><span class="legend-dot" style="background:${COLORS[m]}"></span>${LABELS[m]}</span>`
  ).join('');

  if (barInst) barInst.destroy();
  barInst = new Chart(document.getElementById('barChart'), {
    type: 'bar',
    data: {
      labels: names,
      datasets: MODES.map(m => ({
        label: LABELS[m],
        data: data.persons.map(p => p[m] || 0),
        backgroundColor: COLORS[m],
        borderWidth: 0,
        borderRadius: 3
      }))
    },
    options: {
      responsive: true, maintainAspectRatio: false, indexAxis: 'y',
      scales: {
        x: { stacked: true, grid: { color: 'rgba(128,128,128,.1)' }, ticks: { color: '#888780' } },
        y: { stacked: true, grid: { display: false }, ticks: { color: '#888780', autoSkip: false } }
      },
      plugins: { legend: { display: false }, tooltip: { mode: 'index', intersect: false } }
    }
  });

  // Per-person cards
  const pc = document.getElementById('person-cards');
  if (view === 'person') {
    pc.innerHTML = data.persons.map(p => {
      const total = p.total || 1;
      const segs = MODES.map(m => ({ m, v: p[m] || 0, pct: Math.round((p[m] || 0) / total * 100) })).filter(s => s.v > 0);
      return `<div class="person-row-card">
        <div class="person-header">
          <div class="avatar">${p.initials}</div>
          <div>
            <div class="person-name">${p.name}</div>
            <div class="person-total">${p.total} days logged this month</div>
          </div>
        </div>
        <div class="seg-bar">${segs.map(s => `<div class="seg-part" style="width:${s.pct}%;background:${COLORS[s.m]}" title="${LABELS[s.m]}: ${s.v}d"></div>`).join('')}</div>
        <div class="seg-labels">${segs.map(s => `<span class="seg-lbl"><span class="legend-dot" style="background:${COLORS[s.m]}"></span>${LABELS[s.m]}: <strong>${s.v}d</strong></span>`).join('')}</div>
      </div>`;
    }).join('');
  } else {
    pc.innerHTML = '';
  }
}

// ── Dashboard ──────────────────────────────────────────────────────────────

document.getElementById('dash-month').addEventListener('change', renderDash);
document.getElementById('export-btn').addEventListener('click', () => {
  const month = document.getElementById('dash-month').value;
  window.location.href = `/api/export/csv?month=${month}`;
});

async function renderDash() {
  const month = document.getElementById('dash-month').value;
  const res = await fetch(`/api/summary?month=${month}`);
  const data = await res.json();
  const t = data.totals;

  document.getElementById('dash-stats').innerHTML = `
    <div class="stat-card"><div class="stat-label">Total days</div><div class="stat-val">${data.grand_total}</div></div>
    <div class="stat-card"><div class="stat-label">Office</div><div class="stat-val green">${t.office}</div></div>
    <div class="stat-card"><div class="stat-label">WFH</div><div class="stat-val blue">${t.wfh}</div></div>
    <div class="stat-card"><div class="stat-label">Shifts</div><div class="stat-val purple">${t.shift}</div></div>
    <div class="stat-card"><div class="stat-label">All leaves</div><div class="stat-val red">${t.leave + t.sick}</div></div>
  `;

  document.getElementById('dash-tbody').innerHTML = data.persons.map(p => {
    const pct = p.wfh_pct;
    const barColor = pct > 60 ? '#378ADD' : pct > 30 ? '#639922' : '#888780';
    return `<tr>
      <td style="font-weight:500">${p.name}</td>
      <td>${p.office}</td><td>${p.wfh}</td><td>${p.shift}</td><td>${p.leave}</td><td>${p.sick}</td>
      <td>
        <div class="mini-bar-wrap">
          <div class="mini-bar"><div class="mini-bar-fill" style="width:${pct}%;background:${barColor}"></div></div>
          <span style="font-size:12px;color:#888780;min-width:32px">${pct}%</span>
        </div>
      </td>
    </tr>`;
  }).join('');
}

// ── History ────────────────────────────────────────────────────────────────

document.getElementById('hist-filter').addEventListener('change', renderHistory);

async function renderHistory() {
  const name = document.getElementById('hist-filter').value;
  const url = '/api/entries' + (name ? `?name=${encodeURIComponent(name)}` : '');
  const res = await fetch(url);
  const entries = await res.json();
  const tb = document.getElementById('hist-tbody');

  if (!entries.length) {
    tb.innerHTML = '<tr><td class="empty" colspan="7">No entries found.</td></tr>';
    return;
  }

  const shiftL = { morning: 'Morning (6–2)', general: 'General (9–6)', afternoon: 'Afternoon (2–10)', night: 'Night (10–6)' };
  tb.innerHTML = entries.map((e, idx) => {
    const detail = e.mode === 'shift'
      ? (shiftL[e.shift] || '') + (e.shiftReason ? ' · ' + e.shiftReason : '')
      : (e.notes || '—');
    return `<tr>
      <td>${e.from}</td><td>${e.to}</td>
      <td><span class="days-pill">${e.days}d</span></td>
      <td style="font-weight:500">${e.name}</td>
      <td><span class="badge ${e.mode}">${LABELS[e.mode]}</span></td>
      <td style="color:#888780;font-size:12px">${detail}</td>
      <td>
        <button class="action-btn" onclick="openEdit(${idx})">Edit</button>
        <button class="action-btn del" onclick="deleteEntry(${idx})" style="margin-left:4px">Delete</button>
      </td>
    </tr>`;
  }).join('');
}

// ── Manager overwrite (Edit modal) ────────────────────────────────────────

function openEdit(idx) {
  fetch('/api/entries')
    .then(r => r.json())
    .then(entries => {
      const e = entries[idx];
      document.getElementById('edit-idx').value = idx;
      document.getElementById('edit-from').value = e.from;
      document.getElementById('edit-to').value = e.to;
      document.getElementById('edit-mode').value = e.mode;
      document.getElementById('edit-notes').value = e.notes || '';
      document.getElementById('edit-overlay').style.display = 'flex';
    });
}

document.getElementById('edit-save-btn').addEventListener('click', async () => {
  const idx = document.getElementById('edit-idx').value;
  const payload = {
    from: document.getElementById('edit-from').value,
    to: document.getElementById('edit-to').value,
    mode: document.getElementById('edit-mode').value,
    notes: document.getElementById('edit-notes').value,
  };
  const er = document.getElementById('edit-er');
  er.style.display = 'none';

  const res = await fetch(`/api/entries/${idx}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const data = await res.json();
  if (!res.ok) { showMsg(er, data.error || 'Update failed.'); return; }

  closeEditModal();
  renderHistory();
});

document.getElementById('edit-cancel-btn').addEventListener('click', closeEditModal);
document.getElementById('edit-overlay').addEventListener('click', function (e) {
  if (e.target === this) closeEditModal();
});

function closeEditModal() {
  document.getElementById('edit-overlay').style.display = 'none';
}

async function deleteEntry(idx) {
  if (!confirm('Delete this entry? This cannot be undone.')) return;
  await fetch(`/api/entries/${idx}`, { method: 'DELETE' });
  renderHistory();
}

// ── Header clock ───────────────────────────────────────────────────────────

function updateClock() {
  const now = new Date();
  document.getElementById('current-month-label').textContent =
    now.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
}
updateClock();

// ── Init ───────────────────────────────────────────────────────────────────
// Pre-load dashboard data silently so it's ready when user switches tabs
renderDash();
