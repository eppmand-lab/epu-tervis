const Measurements = {
  weightChart: null,
  metricChart: null,

  getAll() {
    return Storage.get(Storage.KEYS.MEASUREMENTS, []).filter(item => item && typeof item === 'object');
  },

  save(list) {
    Storage.set(Storage.KEYS.MEASUREMENTS, list);
  },

  add(entry) {
    const all = this.getAll();
    all.push(entry);
    all.sort((a, b) => a.date.localeCompare(b.date));
    this.save(all);
  },

  remove(id) {
    this.save(this.getAll().filter(m => m.id !== id));
  },

  latest() {
    const all = this.getAll();
    return all.length ? all[all.length - 1] : null;
  },

  latestFor(field) {
    const all = this.getAll().filter(m => m[field] !== null && m[field] !== undefined);
    return all.length ? all[all.length - 1] : null;
  },

  daysSince(date) {
    if (!date) return Infinity;
    const today = new Date(DateUtils.todayISO() + 'T12:00:00');
    const previous = new Date(date + 'T12:00:00');
    return Math.floor((today - previous) / 86400000);
  },

  isDue(field, intervalDays) {
    const latest = this.latestFor(field);
    return !latest || this.daysSince(latest.date) >= intervalDays;
  },

  nextDueDate(field, intervalDays) {
    const latest = this.latestFor(field);
    if (!latest) return DateUtils.todayISO();
    const date = new Date(latest.date + 'T12:00:00');
    date.setDate(date.getDate() + intervalDays);
    return date.toISOString().slice(0, 10);
  },

  renderCadence() {
    const el = document.getElementById('measurement-rhythm');
    if (!el) return;
    const items = [
      { field: 'weight', days: 7, label: 'KAAL', rhythm: 'Kord nädalas', input: 'm-weight' },
      { field: 'bodyFat', days: 90, label: 'RASVAPROTSENT', rhythm: 'Kord 3 kuu jooksul', input: 'm-bodyfat' },
    ];
    el.innerHTML = items.map(item => {
      const latest = this.latestFor(item.field);
      const due = this.isDue(item.field, item.days);
      const value = due
        ? 'MÕÕTMINE ON OODATUD'
        : `JÄRGMINE: ${DateUtils.formatEt(this.nextDueDate(item.field, item.days)).toUpperCase()}`;
      const note = latest ? `Viimati ${DateUtils.formatEt(latest.date)}` : 'Varasem mõõtmine puudub';
      return `
        <div class="rhythm-item ${due ? 'is-due' : ''}">
          <div class="tile-label">${item.label} · ${item.rhythm}</div>
          <div class="rhythm-value">${value}</div>
          <div class="rhythm-note">${note}</div>
        </div>
      `;
    }).join('');

    items.forEach(item => {
      const input = document.getElementById(item.input);
      const due = this.isDue(item.field, item.days);
      input.disabled = !due;
      input.classList.toggle('measurement-locked', !due);
      input.title = due
        ? ''
        : `Järgmine mõõtmine: ${DateUtils.formatEt(this.nextDueDate(item.field, item.days))}`;
    });
  },

  handleSubmit(e) {
    e.preventDefault();
    const date = document.getElementById('m-date').value || DateUtils.todayISO();
    const val = id => {
      const v = document.getElementById(id).value;
      return v === '' ? null : parseFloat(v);
    };
    const weight = val('m-weight');
    const bodyFat = val('m-bodyfat');
    if (weight !== null && !this.isDue('weight', 7)) {
      UI.toast('Kaal on sel nädalal juba mõõdetud');
      return;
    }
    if (bodyFat !== null && !this.isDue('bodyFat', 90)) {
      UI.toast('Rasvaprotsent on selleks kvartaliks juba mõõdetud');
      return;
    }
    const entry = {
      id: Fmt.uid(),
      date,
      weight,
      bodyFat,
      waist: val('m-waist'),
      hips: val('m-hips'),
      chest: val('m-chest'),
      thigh: val('m-thigh'),
      arm: val('m-arm'),
    };
    if (Object.values(entry).slice(2).every(v => v === null)) {
      UI.toast('Sisesta vähemalt üks mõõt');
      return;
    }
    this.add(entry);
    document.getElementById('measurement-form').reset();
    document.getElementById('m-date').value = DateUtils.todayISO();
    this.renderAll();
    UI.toast('Mõõtmine salvestatud');
  },

  renderHistory() {
    const all = this.getAll().slice().reverse();
    const el = document.getElementById('measurement-history');
    if (!all.length) {
      el.innerHTML = '<p class="hint">POLE VEEL MÕÕDETUD.</p>';
      return;
    }
    const fields = [
      ['weight', 'Kaal', 'kg'], ['bodyFat', 'Rasv%', '%'], ['waist', 'Vöö', 'cm'],
      ['hips', 'Puus', 'cm'], ['chest', 'Rind', 'cm'], ['thigh', 'Reis', 'cm'], ['arm', 'Käsivars', 'cm'],
    ];
    el.innerHTML = all.map(m => {
      const parts = fields.filter(([k]) => m[k] !== null && m[k] !== undefined)
        .map(([k, label, unit]) => `${label} ${m[k]}${unit}`).join(' · ');
      return `
        <div class="history-entry">
          <div class="he-top">
            <span class="he-date">${DateUtils.formatEt(m.date)}</span>
            <button class="he-remove" data-id="${m.id}">Kustuta</button>
          </div>
          <div class="he-sub">${parts || '—'}</div>
        </div>
      `;
    }).join('');
    el.querySelectorAll('.he-remove').forEach(btn => {
      btn.addEventListener('click', () => {
        this.remove(btn.dataset.id);
        this.renderAll();
      });
    });
  },

  renderWeightChart() {
    if (typeof Chart === 'undefined') return;
    const all = this.getAll().filter(m => m.weight !== null && m.weight !== undefined);
    const ctx = document.getElementById('chart-weight');
    ChartTheme.destroy(this.weightChart);
    this.weightChart = new Chart(ctx, ChartTheme.base('line', {
      data: {
        labels: all.map(m => DateUtils.formatEt(m.date)),
        datasets: [{
          label: 'Kaal (kg)',
          data: all.map(m => m.weight),
          borderColor: ChartTheme.colors.amber,
          backgroundColor: ChartTheme.colors.amber,
          pointRadius: 4,
          pointHoverRadius: 6,
          borderWidth: 2,
          tension: 0.25,
          fill: false,
        }],
      },
      options: {
        plugins: { legend: { display: false } },
      },
    }));
  },

  metricLabels: {
    bodyFat: 'Rasvaprotsent (%)', waist: 'Vöö (cm)', hips: 'Puus (cm)',
    chest: 'Rind (cm)', thigh: 'Reis (cm)', arm: 'Käsivars (cm)',
  },

  renderMetricChart() {
    if (typeof Chart === 'undefined') return;
    const metric = document.getElementById('measurement-metric-select').value;
    const all = this.getAll().filter(m => m[metric] !== null && m[metric] !== undefined);
    const ctx = document.getElementById('chart-measurements');
    ChartTheme.destroy(this.metricChart);
    this.metricChart = new Chart(ctx, ChartTheme.base('line', {
      data: {
        labels: all.map(m => DateUtils.formatEt(m.date)),
        datasets: [{
          label: this.metricLabels[metric],
          data: all.map(m => m[metric]),
          borderColor: ChartTheme.colors.amber,
          backgroundColor: ChartTheme.colors.amber,
          pointRadius: 4,
          pointHoverRadius: 6,
          borderWidth: 2,
          tension: 0.25,
          fill: false,
        }],
      },
      options: {
        plugins: { legend: { display: false } },
      },
    }));
  },

  renderAll() {
    this.renderCadence();
    this.renderHistory();
    this.renderWeightChart();
    this.renderMetricChart();
  },

  init() {
    document.getElementById('m-date').value = DateUtils.todayISO();
    document.getElementById('measurement-form').addEventListener('submit', (e) => this.handleSubmit(e));
    document.getElementById('measurement-metric-select').addEventListener('change', () => this.renderMetricChart());
    this.renderAll();
  },
};
