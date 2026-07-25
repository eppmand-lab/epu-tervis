const Progress = {
  weightChart: null,
  workoutChart: null,

  weeklyWorkoutCounts(weeks = 8) {
    const today = DateUtils.todayISO();
    const current = DateUtils.weekBounds(today);
    const rows = [];
    for (let i = weeks - 1; i >= 0; i--) {
      const start = DateUtils.addDays(current.start, -7 * i);
      const end = DateUtils.addDays(start, 6);
      const count = Workouts.getAll().filter(w => w.date >= start && w.date <= end).length
        + GymPlans.getSessions().filter(s => s.date >= start && s.date <= end).length;
      rows.push({ start, end, count });
    }
    return rows;
  },

  renderSummary() {
    const el = document.getElementById('progress-summary');
    const measurements = Measurements.getAll().filter(m => m.weight !== null && m.weight !== undefined);
    const latest = measurements.slice(-1)[0] || null;
    const previous = measurements.slice(-2)[0] || null;
    const delta = latest && previous ? Fmt.round1(latest.weight - previous.weight) : null;
    const last28 = DateUtils.addDays(DateUtils.todayISO(), -27);
    const workoutCount = Workouts.getAll().filter(w => w.date >= last28).length
      + GymPlans.getSessions().filter(s => s.date >= last28).length;
    const sevenDays = DateUtils.lastNDays(7);
    const foodDays = sevenDays.filter(day => Nutrition.dayTotals(day).kcal > 0).length;
    const avgSteps = Math.round(sevenDays.reduce((sum, day) => sum + Steps.getAmount(day), 0) / 7);

    const cards = [
      { label: 'VIIMANE NÄDALA KAAL', value: latest ? `${latest.weight} KG` : '—', sub: delta === null ? 'Trend tekib kahe mõõtmise järel' : `${delta > 0 ? '+' : ''}${delta} kg eelmisest mõõtmisest` },
      { label: 'TREENINGUD · 28 PÄEVA', value: workoutCount, sub: 'Kõik logitud treeningud' },
      { label: 'TOITUMINE · 7 PÄEVA', value: `${foodDays}/7`, sub: 'Logitud päevad' },
      { label: 'SAMMUD · 7 PÄEVA', value: avgSteps ? Fmt.int(avgSteps) : '—', sub: 'Päevane keskmine' },
    ];
    el.innerHTML = cards.map(card => `
      <div class="progress-stat">
        <div class="tile-label">${card.label}</div>
        <div class="progress-stat-value">${card.value}</div>
        <div class="sec-tile-sub">${card.sub}</div>
      </div>
    `).join('');
  },

  renderWeightChart() {
    const points = Measurements.getAll()
      .filter(m => m.weight !== null && m.weight !== undefined)
      .slice(-16);
    const ctx = document.getElementById('chart-progress-weight');
    ChartTheme.destroy(this.weightChart);
    this.weightChart = new Chart(ctx, ChartTheme.base('line', {
      data: {
        labels: points.map(p => DateUtils.formatEt(p.date)),
        datasets: [{
          data: points.map(p => p.weight),
          borderColor: ChartTheme.colors.red,
          backgroundColor: ChartTheme.colors.red,
          pointRadius: 4,
          borderWidth: 2,
          tension: 0.25,
          fill: false,
        }],
      },
      options: { plugins: { legend: { display: false } } },
    }));
  },

  renderWorkoutChart() {
    const rows = this.weeklyWorkoutCounts();
    const ctx = document.getElementById('chart-progress-workouts');
    ChartTheme.destroy(this.workoutChart);
    this.workoutChart = new Chart(ctx, ChartTheme.base('bar', {
      data: {
        labels: rows.map(row => DateUtils.formatEt(row.start)),
        datasets: [{
          data: rows.map(row => row.count),
          backgroundColor: ChartTheme.colors.blue,
          borderColor: ChartTheme.colors.espresso,
          borderWidth: 1,
        }],
      },
      options: {
        plugins: { legend: { display: false } },
        scales: { y: { beginAtZero: true, ticks: { precision: 0 } } },
      },
    }));
  },

  renderConsistency() {
    const el = document.getElementById('progress-consistency');
    const profile = Storage.getProfile();
    const days = DateUtils.lastNDays(7);
    const rows = [
      {
        label: 'TOITUMINE LOGITUD',
        done: days.filter(day => Nutrition.dayTotals(day).kcal > 0).length,
        total: 7,
      },
      {
        label: 'VALGUEESMÄRK TÄIDETUD',
        done: days.filter(day => Nutrition.dayTotals(day).protein >= profile.macros.protein * 0.9).length,
        total: 7,
      },
      {
        label: 'VEE-EESMÄRK TÄIDETUD',
        done: days.filter(day => Water.getAmount(day) >= profile.waterTarget).length,
        total: 7,
      },
      {
        label: 'VÄHEMALT 8 000 SAMMU',
        done: days.filter(day => Steps.getAmount(day) >= 8000).length,
        total: 7,
      },
    ];
    el.innerHTML = rows.map(row => {
      const pct = (row.done / row.total) * 100;
      return `
        <div class="consistency-row">
          <div class="consistency-head">
            <span>${row.label}</span><strong>${row.done}/${row.total}</strong>
          </div>
          <div class="consistency-track"><div class="consistency-fill" style="width:${pct}%"></div></div>
        </div>
      `;
    }).join('');
  },

  renderAll() {
    this.renderSummary();
    this.renderWeightChart();
    this.renderWorkoutChart();
    this.renderConsistency();
  },

  init() {
    this.renderAll();
  },
};
