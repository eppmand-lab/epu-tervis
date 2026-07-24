const Dashboard = {
  sparkChart: null,

  renderDateRow() {
    const iso = DateUtils.todayISO();
    const now = new Date();
    const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    document.getElementById('dashboard-date').textContent =
      `${DateUtils.formatEt(iso).toUpperCase()} / ${DateUtils.weekdayFullEt(iso)} · ${time}`;
  },

  renderHeroEnergy() {
    const iso = DateUtils.todayISO();
    const profile = Storage.getProfile();
    const totals = Nutrition.dayTotals(iso);
    const pct = profile.macros.kcal ? Math.min(100, (totals.kcal / profile.macros.kcal) * 100) : 0;
    document.getElementById('hero-kcal-value').textContent = Fmt.int(totals.kcal);
    document.getElementById('hero-kcal-target').textContent = `/ ${Fmt.int(profile.macros.kcal)} KCAL`;
    document.getElementById('hero-kcal-fill').style.width = `${pct}%`;
  },

  renderHeroWeek() {
    const iso = DateUtils.todayISO();
    document.getElementById('hero-week-num').textContent = DateUtils.weekNumber(iso);
    const { start } = DateUtils.weekBounds(iso);
    const days = DateUtils.rangeDays(start, iso);
    const values = days.map(d => Nutrition.dayTotals(d).kcal);

    const ctx = document.getElementById('chart-week-spark');
    ChartTheme.destroy(this.sparkChart);
    this.sparkChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: days.map(d => DateUtils.weekdayShortEt(d)),
        datasets: [{
          data: values,
          borderColor: '#F5F0E5',
          backgroundColor: '#F5F0E5',
          borderWidth: 2,
          pointRadius: 3,
          pointBackgroundColor: '#F5F0E5',
          tension: 0.3,
          fill: false,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: { enabled: false } },
        scales: {
          x: { display: false },
          y: { display: false, beginAtZero: true },
        },
      },
    });
  },

  secTile(cls, label, value, sub, nav) {
    return `
      <div class="sec-tile ${cls}" ${nav ? `data-nav="${nav}"` : ''}>
        <div class="tile-label">${label}</div>
        <div class="sec-tile-value">${value}</div>
        ${sub ? `<div class="sec-tile-sub">${sub}</div>` : ''}
      </div>
    `;
  },

  renderSecondaryGrid() {
    const iso = DateUtils.todayISO();
    const profile = Storage.getProfile();

    const waterAmount = Water.getAmount(iso);
    const waterTile = this.secTile('sec-blue', 'VESI', `${waterAmount}`, `/ ${profile.waterTarget} ML`, 'water');

    const steps = Steps.getAmount(iso);
    const stepsTile = `
      <div class="sec-tile sec-plain" id="dash-steps-tile">
        <div class="tile-label">SAMMUD</div>
        <input type="number" id="dash-steps-input" class="sec-tile-value dash-steps-input" value="${steps || ''}" placeholder="0000">
      </div>
    `;

    const latestM = Measurements.latest();
    const weightTile = this.secTile('sec-butter', 'KAAL', latestM && latestM.weight ? `${latestM.weight}` : '—', latestM && latestM.weight ? 'KG' : 'POLE MÕÕDETUD', 'measurements');

    const workouts = Workouts.getAll();
    const lastWorkout = workouts.slice().sort((a, b) => b.date.localeCompare(a.date))[0];
    const lastWorkoutTile = this.secTile('sec-oxblood', 'VIIMANE TRENN', lastWorkout ? lastWorkout.type.toUpperCase() : 'POLE LOGITUD', lastWorkout ? DateUtils.formatEt(lastWorkout.date).toUpperCase() : '', 'workouts');

    const el = document.getElementById('dashboard-secondary');
    el.innerHTML = waterTile + stepsTile + weightTile + lastWorkoutTile;

    el.querySelectorAll('[data-nav]').forEach(tile => {
      tile.addEventListener('click', () => App.showTab(tile.dataset.nav));
    });

    const stepsInput = document.getElementById('dash-steps-input');
    document.getElementById('dash-steps-tile').addEventListener('click', (e) => {
      if (e.target !== stepsInput) stepsInput.focus();
    });
    stepsInput.addEventListener('click', (e) => e.stopPropagation());
    stepsInput.addEventListener('change', () => {
      const val = parseInt(stepsInput.value, 10) || 0;
      Steps.save(iso, val);
      UI.toast('Sammud salvestatud');
    });
  },

  initStepsBackfill() {
    const toggle = document.getElementById('steps-backfill-toggle');
    const form = document.getElementById('steps-backfill-form');
    const dateInput = document.getElementById('steps-backfill-date');
    dateInput.value = DateUtils.todayISO();
    toggle.addEventListener('click', (e) => {
      e.preventDefault();
      form.classList.toggle('hidden');
    });
    document.getElementById('steps-backfill-save').addEventListener('click', () => {
      const date = dateInput.value;
      const val = parseInt(document.getElementById('steps-backfill-value').value, 10) || 0;
      if (!date) { UI.toast('Vali kuupäev'); return; }
      Steps.save(date, val);
      form.classList.add('hidden');
      document.getElementById('steps-backfill-value').value = '';
      if (date === DateUtils.todayISO()) this.renderSecondaryGrid();
      UI.toast(`Sammud lisatud (${DateUtils.formatEt(date)})`);
    });
  },

  renderCycleStrip() {
    const el = document.getElementById('cycle-strip');
    const status = Cycle.computeStatus(DateUtils.todayISO());
    if (!status) {
      el.innerHTML = `<span>TSÜKKEL — POLE ANDMEID</span><a href="#" class="cycle-strip-link" data-nav="cycle">LISA ALGUS →</a>`;
    } else {
      const phaseInfo = Cycle.PHASES[status.phase];
      el.innerHTML = `
        <span><span class="cycle-strip-dot" style="background:${phaseInfo.color}"></span>${phaseInfo.label.toUpperCase()} · PÄEV ${status.currentDay}/${status.cycleLength}</span>
        <a href="#" class="cycle-strip-link" data-nav="cycle">VAATA →</a>
      `;
    }
    const link = el.querySelector('[data-nav]');
    if (link) link.addEventListener('click', (e) => { e.preventDefault(); App.showTab('cycle'); });
  },

  renderMoneyStrip() {
    const el = document.getElementById('money-strip');
    const sts = Finance.computeSafeToSpend();
    el.innerHTML = `
      <span>TÄNANE KULUTUSEELARVE — ${Finance.fmt(sts.today)} €</span>
      <a href="#" class="cycle-strip-link" data-nav="finance">RAHA →</a>
    `;
    el.querySelector('[data-nav]').addEventListener('click', (e) => { e.preventDefault(); App.showTab('finance'); });
  },

  render() {
    this.renderDateRow();
    this.renderHeroEnergy();
    this.renderHeroWeek();
    this.renderSecondaryGrid();
    this.renderCycleStrip();
    this.renderMoneyStrip();

    WeeklyAnalysis.renderCard();
    WeeklyAnalysis.maybeAutoGenerate().then(() => WeeklyAnalysis.renderCard());
  },

  init() {
    this.initStepsBackfill();
    this.render();
  },
};
