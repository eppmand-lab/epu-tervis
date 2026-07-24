const Workouts = {
  exerciseRowCount: 0,

  getAll() {
    return Storage.get(Storage.KEYS.WORKOUTS, []);
  },

  save(list) {
    Storage.set(Storage.KEYS.WORKOUTS, list);
  },

  add(workout) {
    const all = this.getAll();
    all.push(workout);
    this.save(all);
  },

  remove(id) {
    this.save(this.getAll().filter(w => w.id !== id));
  },

  addExerciseRow(prefill) {
    const container = document.getElementById('exercise-rows');
    const rowId = `ex-${this.exerciseRowCount++}`;
    const div = document.createElement('div');
    div.className = 'exercise-row';
    div.dataset.rowId = rowId;
    div.innerHTML = `
      <input class="ex-name" type="text" placeholder="Harjutus (nt. Kükk)" value="${prefill?.name || ''}">
      <input type="number" placeholder="Seeriad" value="${prefill?.sets ?? ''}">
      <input type="number" placeholder="Kordused" value="${prefill?.reps ?? ''}">
      <input type="number" step="0.5" placeholder="Kaal (kg)" value="${prefill?.weight ?? ''}">
      <button type="button" class="btn btn-ghost ex-remove">✕</button>
    `;
    div.querySelector('.ex-remove').addEventListener('click', () => div.remove());
    container.appendChild(div);
  },

  collectExercises() {
    const rows = document.querySelectorAll('#exercise-rows .exercise-row');
    const exercises = [];
    rows.forEach(row => {
      const inputs = row.querySelectorAll('input');
      const name = inputs[0].value.trim();
      if (!name) return;
      exercises.push({
        name,
        sets: parseFloat(inputs[1].value) || null,
        reps: parseFloat(inputs[2].value) || null,
        weight: parseFloat(inputs[3].value) || null,
      });
    });
    return exercises;
  },

  getSelectedType() {
    const select = document.getElementById('workout-type-select');
    if (select.value === 'muu') {
      return document.getElementById('workout-type-custom').value.trim();
    }
    return select.value;
  },

  handleTypeSelectChange() {
    const select = document.getElementById('workout-type-select');
    const wrap = document.getElementById('workout-type-custom-wrap');
    wrap.classList.toggle('hidden', select.value !== 'muu');
  },

  handleSubmit(e) {
    e.preventDefault();
    const date = document.getElementById('workout-date').value || DateUtils.todayISO();
    const type = this.getSelectedType();
    const duration = parseFloat(document.getElementById('workout-duration').value) || null;
    const notes = document.getElementById('workout-notes').value.trim();
    const exercises = this.collectExercises();
    if (!type) { UI.toast('Sisesta treeningu tüüp'); return; }
    this.add({ id: Fmt.uid(), date, type, duration, exercises, notes });
    document.getElementById('workout-form').reset();
    document.getElementById('exercise-rows').innerHTML = '';
    document.getElementById('workout-date').value = DateUtils.todayISO();
    document.getElementById('workout-type-custom-wrap').classList.add('hidden');
    this.renderHistory();
    UI.toast('Treening salvestatud');
  },

  renderHistory() {
    const all = this.getAll().slice().sort((a, b) => b.date.localeCompare(a.date) || 0);
    const el = document.getElementById('workout-history');
    if (!all.length) {
      el.innerHTML = '<p class="hint">NULL TRENNI. VEEL.</p>';
      return;
    }
    el.innerHTML = all.map(w => {
      const exLines = (w.exercises || []).map(ex => {
        const parts = [ex.name];
        const detail = [];
        if (ex.sets) detail.push(`${ex.sets} x ${ex.reps || '?'}`);
        if (ex.weight) detail.push(`${ex.weight}kg`);
        return `${ex.name}${detail.length ? ' — ' + detail.join(', ') : ''}`;
      }).join('<br>');
      return `
        <div class="history-entry">
          <div class="he-top">
            <span class="he-date">${DateUtils.formatEt(w.date)}</span>
            <button class="he-remove" data-id="${w.id}">Kustuta</button>
          </div>
          <div class="he-title">${this._esc(w.type)}${w.duration ? ` · ${w.duration} min` : ''}</div>
          ${exLines ? `<div class="he-sub">${exLines}</div>` : ''}
          ${w.notes ? `<div class="he-sub">${this._esc(w.notes)}</div>` : ''}
        </div>
      `;
    }).join('');
    el.querySelectorAll('.he-remove').forEach(btn => {
      btn.addEventListener('click', () => {
        this.remove(btn.dataset.id);
        this.renderHistory();
      });
    });
  },

  _esc(s) {
    const d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
  },

  isDuplicate(existing, entry) {
    return existing.some(w => w.date === entry.date && w.type === entry.type && (w.notes || '') === (entry.notes || ''));
  },

  async handleImport() {
    const input = document.getElementById('workout-import-input');
    const resultEl = document.getElementById('workout-import-result');
    const file = input.files[0];
    if (!file) { UI.toast('Vali kõigepealt fail'); return; }
    try {
      const text = await file.text();
      const items = JSON.parse(text);
      if (!Array.isArray(items)) throw new Error('Fail peab sisaldama massiivi treeningutest');
      const existing = this.getAll();
      let added = 0, skipped = 0;
      items.forEach(item => {
        if (!item.date || !item.type) { skipped++; return; }
        if (this.isDuplicate(existing, item)) { skipped++; return; }
        const entry = {
          id: Fmt.uid(),
          date: item.date,
          type: item.type,
          duration: item.duration ?? null,
          exercises: Array.isArray(item.exercises) ? item.exercises : [],
          notes: item.notes || '',
        };
        existing.push(entry);
        added++;
      });
      this.save(existing);
      resultEl.textContent = `Imporditud ${added} treeningut${skipped ? `, vahele jäetud ${skipped} (juba olemas või puudulik kirje)` : ''}.`;
      input.value = '';
      this.renderHistory();
      UI.toast('Import lõpetatud');
    } catch (e) {
      console.error(e);
      resultEl.textContent = 'Impordi viga: ' + e.message;
    }
  },

  init() {
    document.getElementById('workout-date').value = DateUtils.todayISO();
    document.getElementById('workout-form').addEventListener('submit', (e) => this.handleSubmit(e));
    document.getElementById('add-exercise-row').addEventListener('click', () => this.addExerciseRow());
    document.getElementById('workout-import-btn').addEventListener('click', () => this.handleImport());
    document.getElementById('workout-type-select').addEventListener('change', () => this.handleTypeSelectChange());
    this.addExerciseRow();
    this.renderHistory();
  },
};
