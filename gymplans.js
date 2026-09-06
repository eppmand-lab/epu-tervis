const GymPlans = {
  PROGRAMS: [
    {
      id: 'day1', label: 'Kava 1 — Jalad',
      exercises: [
        { name: 'Hip thrust', ref: '3 x 16/14/12' },
        { name: 'Smith squat', ref: '3 x 16/14/12' },
        { name: 'Romanian deadlift', ref: '3 x 16/14/12' },
        { name: 'Step-ups (L+R)', ref: '3 x 16/14/12' },
        { name: 'Hamstring curl', ref: '3 x 16/14/12' },
        { name: 'Kõhulihased', ref: '3 seeriat' },
      ],
    },
    {
      id: 'day2', label: 'Kava 2 — Ülakeha/käed',
      exercises: [
        { name: 'Chest press', ref: '3 x 16/14/12' },
        { name: 'Lat pulldown masinal', ref: '3 x 16/14/12' },
        { name: 'Seated cable row', ref: '3 x 16/14/12' },
        { name: 'Lateral raise', ref: '3 x 16/14/12' },
        { name: 'Face pull', ref: '3 x 16/14/12' },
        { name: 'Cable biceps curl', ref: '3 x 16/14/12' },
        { name: 'Triceps pushdown', ref: '3 x 16/14/12' },
        { name: 'Kõhulihased', ref: '3 seeriat' },
      ],
    },
    {
      id: 'day3', label: 'Kava 3 — Segu',
      exercises: [
        { name: 'Deficit sumo squat', ref: '3 x 16/14/12' },
        { name: 'Bulgarian split squat (L+R)', ref: '3 x 16/14/12' },
        { name: 'Leg extension', ref: '3 x 16/14/12' },
        { name: 'Hip abduction', ref: '3 x 16/14/12' },
        { name: 'Seated push press', ref: '4 x 16/14/12' },
        { name: 'Lat pushdown', ref: '3 x 16/14/12' },
        { name: 'Calf raise', ref: '3 x 20/15/15' },
      ],
    },
    {
      id: 'day4', label: 'Kava 4 — Segu',
      exercises: [
        { name: 'Romanian deadlift', ref: '3 x 16/14/12' },
        { name: 'Reverse deficit lunge (L+R)', ref: '3 x 16/14/12' },
        { name: 'Hamstring curl', ref: '3 x 16/14/12' },
        { name: 'Glute bridge', ref: '3 x 16/14/12' },
        { name: 'Bent-over row', ref: '3 x 16/14/12' },
        { name: 'DB Y raise', ref: '3 x 12/12/10' },
        { name: 'Push-ups', ref: '3 x maksimum' },
      ],
    },
  ],

  activeProgramId: 'day1',
  progressChart: null,

  getSessions() {
    return Storage.get(Storage.KEYS.GYM_SESSIONS, []).filter(item => item && typeof item === 'object');
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

  lastEntryFor(exerciseName) {
    const sessions = this.getSessions().slice().sort((a, b) => b.date.localeCompare(a.date));
    for (const session of sessions) {
      const entry = session.entries.find(e => e.exerciseName === exerciseName);
      if (entry) return entry;
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
      const last = this.lastEntryFor(ex.name);
      return `
        <div class="gym-ex-row">
          <div class="gym-ex-name">${this._esc(ex.name)}</div>
          <div class="gym-ex-ref">${this._esc(ex.ref)}</div>
          <input class="gym-ex-weight" type="number" step="0.5" placeholder="kg" data-idx="${i}" value="${last?.weight ?? ''}">
          <input class="gym-ex-reps" type="text" inputmode="numeric" placeholder="nt 16/14/12" data-idx="${i}" value="${this._esc(last?.reps || '')}">
        </div>
      `;
    }).join('');
  },

  handleSave() {
    const date = document.getElementById('gym-date').value || DateUtils.todayISO();
    const program = this.getProgram(this.activeProgramId);
    const notes = document.getElementById('gym-notes').value.trim();
    const weightInputs = document.querySelectorAll('#gym-exercise-rows .gym-ex-weight');
    const repsInputs = document.querySelectorAll('#gym-exercise-rows .gym-ex-reps');
    const entries = [];
    weightInputs.forEach(input => {
      const idx = parseInt(input.dataset.idx, 10);
      const weight = input.value === '' ? null : parseFloat(input.value);
      const reps = repsInputs[idx].value.trim();
      if (weight !== null || reps) {
        entries.push({ exerciseName: program.exercises[idx].name, weight, reps });
      }
    });
    if (!entries.length) { UI.toast('Sisesta vähemalt ühe harjutuse raskus või kordused'); return; }
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
    })).filter(p => p.weight !== null && p.weight !== undefined);
    const ctx = document.getElementById('chart-gym-progress');
    ChartTheme.destroy(this.progressChart);
    this.progressChart = new Chart(ctx, ChartTheme.base('line', {
      data: {
        labels: points.map(p => DateUtils.formatEt(p.date)),
        datasets: [{
          label: exerciseName,
          data: points.map(p => p.weight),
          borderColor: ChartTheme.colors.amber,
          backgroundColor: ChartTheme.colors.amber,
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
        <div class="he-sub">${s.entries.map(e => {
          const detail = [
            e.weight !== null && e.weight !== undefined ? `${e.weight}kg` : '',
            e.reps ? `${this._esc(e.reps)} kordust` : '',
          ].filter(Boolean).join(' · ');
          return `${this._esc(e.exerciseName)}: ${detail}`;
        }).join('<br>')}</div>
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
