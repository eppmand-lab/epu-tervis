const GymPlans = {
  PROGRAMS: [
    {
      id: 'day1', label: 'Päev 1 — Alakeha',
      exercises: [
        { name: 'Smith machine squats', ref: '3 x 16/14/12' },
        { name: 'Step ups (L+R)', ref: '3 x 16/14/12' },
        { name: 'Romanian deadlift', ref: '3 x 16/14/12' },
        { name: 'Calf raises', ref: '3 x 20/15/15' },
        { name: 'Hamstring curl', ref: '3 x 16/14/12' },
        { name: 'Abs', ref: '' },
      ],
    },
    {
      id: 'day2', label: 'Päev 2 — Terve keha',
      exercises: [
        { name: 'Deficit sumo squat', ref: '3 x 16/14/12' },
        { name: 'Seated push press', ref: '4 x 16/14/12' },
        { name: 'Bulgarian split squat (L+R)', ref: '3 x 16/14/12' },
        { name: 'Leg extensions', ref: '3 x 16/14/12' },
        { name: 'Lat push down', ref: '3 x 16/14/12' },
        { name: 'Abs', ref: '' },
      ],
    },
    {
      id: 'day3', label: 'Päev 3 — Terve keha',
      exercises: [
        { name: 'Romanian deadlift', ref: '3 x 16/14/12' },
        { name: 'Reverse deficit lunges (L+R)', ref: '3 x 16/14/12' },
        { name: 'DB Y raise', ref: '3 x 12/12/10' },
        { name: 'Hamstring curls', ref: '3 x 16/14/12' },
        { name: 'Bent over back row', ref: '3 x 16/14/12' },
        { name: 'Push up burnout', ref: '3 x maksimum' },
        { name: 'Reverse crunches', ref: '4 x 20' },
      ],
    },
    {
      id: 'day4', label: 'Päev 4 — Ülakeha',
      exercises: [
        { name: 'Chest press', ref: '3 x 16/14/12' },
        { name: 'Bicep curls on cable', ref: '3 x 16/14/12' },
        { name: 'Triceps pull down', ref: '3 x 16/14/12' },
        { name: 'Face pulls', ref: '3 x 16/14/12' },
        { name: 'Lat raise', ref: '3 x 16/14/12' },
        { name: 'Abs', ref: '' },
      ],
    },
  ],

  activeProgramId: 'day1',
  progressChart: null,

  getSessions() {
    return Storage.get(Storage.KEYS.GYM_SESSIONS, []);
  },

  save(list) {
    Storage.set(Storage.KEYS.GYM_SESSIONS, list);
  },

  addSession(session) {
    const all = this.getSessions();
    all.push(session);
    all.sort((a, b) => a.date.localeCompare(b.date));
    this.save(all);
  },

  removeSession(id) {
    this.save(this.getSessions().filter(s => s.id !== id));
  },

  getProgram(id) {
    return this.PROGRAMS.find(p => p.id === id);
  },

  lastWeightFor(exerciseName) {
    const sessions = this.getSessions().slice().sort((a, b) => b.date.localeCompare(a.date));
    for (const s of sessions) {
      const entry = s.entries.find(e => e.exerciseName === exerciseName && e.weight !== null && e.weight !== undefined);
      if (entry) return entry.weight;
    }
    return null;
  },

  renderProgramTabs() {
    const el = document.getElementById('gym-program-tabs');
    el.innerHTML = this.PROGRAMS.map(p => `
      <button type="button" class="btn btn-ghost gym-program-btn ${p.id === this.activeProgramId ? 'active' : ''}" data-program="${p.id}">${p.label}</button>
    `).join('');
    el.querySelectorAll('.gym-program-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.activeProgramId = btn.dataset.program;
        this.renderProgramTabs();
        this.renderExerciseRows();
      });
    });
  },

  renderExerciseRows() {
    const program = this.getProgram(this.activeProgramId);
    document.getElementById('gym-program-title').textContent = program.label;
    const el = document.getElementById('gym-exercise-rows');
    el.innerHTML = program.exercises.map((ex, i) => {
      const last = this.lastWeightFor(ex.name);
      return `
        <div class="gym-ex-row">
          <div class="gym-ex-name">${this._esc(ex.name)}</div>
          <div class="gym-ex-ref">${this._esc(ex.ref)}</div>
          <input class="gym-ex-weight" type="number" step="0.5" placeholder="kg" data-idx="${i}" value="${last !== null ? last : ''}">
        </div>
      `;
    }).join('');
  },

  handleSave() {
    const date = document.getElementById('gym-date').value || DateUtils.todayISO();
    const program = this.getProgram(this.activeProgramId);
    const notes = document.getElementById('gym-notes').value.trim();
    const weightInputs = document.querySelectorAll('#gym-exercise-rows .gym-ex-weight');
    const entries = [];
    weightInputs.forEach(input => {
      const idx = parseInt(input.dataset.idx, 10);
      const weight = input.value === '' ? null : parseFloat(input.value);
      if (weight !== null) {
        entries.push({ exerciseName: program.exercises[idx].name, weight });
      }
    });
    if (!entries.length) { UI.toast('Sisesta vähemalt ühe harjutuse raskus'); return; }
    this.addSession({ id: Fmt.uid(), date, programId: program.id, programLabel: program.label, entries, notes });
    document.getElementById('gym-notes').value = '';
    this.renderAll();
    UI.toast('Trenn salvestatud');
  },

  allExerciseNames() {
    const seen = new Set();
    const names = [];
    this.PROGRAMS.forEach(p => p.exercises.forEach(ex => {
      if (ex.ref && !seen.has(ex.name)) { seen.add(ex.name); names.push(ex.name); }
    }));
    return names;
  },

  renderProgressSelect() {
    const select = document.getElementById('gym-progress-select');
    const prevValue = select.value;
    select.innerHTML = this.allExerciseNames().map(n => `<option value="${this._esc(n)}">${this._esc(n)}</option>`).join('');
    if (prevValue && this.allExerciseNames().includes(prevValue)) select.value = prevValue;
  },

  renderProgressChart() {
    const exerciseName = document.getElementById('gym-progress-select').value;
    const sessions = this.getSessions().filter(s => s.entries.some(e => e.exerciseName === exerciseName));
    const points = sessions.map(s => ({
      date: s.date,
      weight: s.entries.find(e => e.exerciseName === exerciseName).weight,
    }));
    const ctx = document.getElementById('chart-gym-progress');
    ChartTheme.destroy(this.progressChart);
    this.progressChart = new Chart(ctx, ChartTheme.base('line', {
      data: {
        labels: points.map(p => DateUtils.formatEt(p.date)),
        datasets: [{
          label: exerciseName,
          data: points.map(p => p.weight),
          borderColor: ChartTheme.colors.blue,
          backgroundColor: ChartTheme.colors.blue,
          pointRadius: 4,
          pointHoverRadius: 6,
          borderWidth: 2,
          tension: 0.2,
          fill: false,
        }],
      },
      options: { plugins: { legend: { display: false } } },
    }));
  },

  renderHistory() {
    const sessions = this.getSessions().slice().sort((a, b) => b.date.localeCompare(a.date));
    const el = document.getElementById('gym-history');
    if (!sessions.length) {
      el.innerHTML = '<p class="hint">NULL LOGI. AEG MUUTA SEDA.</p>';
      return;
    }
    el.innerHTML = sessions.map(s => `
      <div class="history-entry">
        <div class="he-top">
          <span class="he-date">${DateUtils.formatEt(s.date)}</span>
          <button class="he-remove" data-id="${s.id}">Kustuta</button>
        </div>
        <div class="he-title">${this._esc(s.programLabel)}</div>
        <div class="he-sub">${s.entries.map(e => `${this._esc(e.exerciseName)}: ${e.weight}kg`).join(' · ')}</div>
        ${s.notes ? `<div class="he-sub">${this._esc(s.notes)}</div>` : ''}
      </div>
    `).join('');
    el.querySelectorAll('.he-remove').forEach(btn => {
      btn.addEventListener('click', () => {
        this.removeSession(btn.dataset.id);
        this.renderAll();
      });
    });
  },

  _esc(s) {
    const d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
  },

  renderAll() {
    this.renderExerciseRows();
    this.renderProgressSelect();
    this.renderProgressChart();
    this.renderHistory();
  },

  init() {
    document.getElementById('gym-date').value = DateUtils.todayISO();
    this.renderProgramTabs();
    document.getElementById('gym-save-btn').addEventListener('click', () => this.handleSave());
    document.getElementById('gym-progress-select').addEventListener('change', () => this.renderProgressChart());
    this.renderAll();
  },
};
