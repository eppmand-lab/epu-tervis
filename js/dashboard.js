const Dashboard = {
  sparkChart: null,

  safeRender(label, renderFn, fallbackId) {
    try {
      renderFn();
      return true;
    } catch (error) {
      console.error(`Dashboard ${label} render error`, error);
      const el = fallbackId ? document.getElementById(fallbackId) : null;
      if (el) {
        el.innerHTML = `<div class="card"><strong>${label} ei saanud kuvada.</strong><p class="hint">Ülejäänud pealeht töötab edasi. Ava Seaded → Sünkroniseeri ja proovi uuesti.</p></div>`;
      }
      return false;
    }
  },

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

  dailyGuidance() {
    const iso = DateUtils.todayISO();
    const profile = Storage.getProfile();
    const totals = Nutrition.dayTotals(iso);
    const water = Water.getAmount(iso);
    const steps = Steps.getAmount(iso);
    const todayWorkouts = Workouts.getAll().filter(w => w.date === iso).length
      + GymPlans.getSessions().filter(s => s.date === iso).length;
    const proteinLeft = Math.max(0, Math.round(profile.macros.protein - totals.protein));
    const kcalLeft = Math.max(0, Math.round(profile.macros.kcal - totals.kcal));

    let headline = 'PÄEV ON AVATUD.';
    let message = `Sul on tänaseks alles ${kcalLeft} kcal ja ${proteinLeft} g valku.`;
    if (totals.kcal === 0) {
      headline = 'ALUSTA ÜHEST LIHTSAST ASJAST.';
      message = 'Lisa esimene söögikord — ülejäänud päev muutub kohe selgemaks.';
    } else if (proteinLeft > 35) {
      headline = 'VALK VAJAB TÄHELEPANU.';
      message = `Valgueesmärgist on puudu ${proteinLeft} g. Planeeri järgmine toidukord selle ümber.`;
    } else if (water < profile.waterTarget * 0.6) {
      headline = 'VESI ON TÄNA MAHA JÄÄNUD.';
      message = `Eesmärgini on ${Math.max(0, profile.waterTarget - water)} ml. Lisa järgmine klaas kohe.`;
    } else if (!todayWorkouts && steps < 8000) {
      headline = 'LIIKUMISEKS ON VEEL RUUMI.';
      message = `Täna on kirjas ${Fmt.int(steps)} sammu. Rahulik jalutuskäik viib päeva kenasti edasi.`;
    } else {
      headline = 'PÕHIASJAD ON KONTROLLI ALL.';
      message = 'Jätka sama rütmiga — sul pole vaja tänast päeva keerulisemaks teha.';
    }
    return { headline, message, proteinLeft, kcalLeft };
  },

  renderDailyBrief() {
    const el = document.getElementById('daily-brief');
    const guidance = this.dailyGuidance();
    el.innerHTML = `
      <div class="daily-brief-card">
        <div class="tile-label">TÄNANE FOOKUS</div>
        <div class="daily-brief-title">${guidance.headline}</div>
        <div class="daily-brief-text">${guidance.message}</div>
      </div>
    `;
  },

  renderQuickActions() {
    const actions = [
      { tab: 'nutrition', label: '+ Lisa toit' },
      { tab: 'water', label: '+ Lisa vesi' },
      { tab: 'workouts', label: '+ Logi trenn' },
      { tab: 'measurements', label: 'Mõõtmised' },
    ];
    const el = document.getElementById('dashboard-actions');
    el.innerHTML = actions.map(action => `
      <button class="quick-action-btn" data-nav="${action.tab}">${action.label}</button>
    `).join('');
    el.querySelectorAll('[data-nav]').forEach(button => {
      button.addEventListener('click', () => App.showTab(button.dataset.nav));
    });
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
          borderColor: '#A91D3A',
          backgroundColor: '#A91D3A',
          borderWidth: 2,
          pointRadius: 3,
          pointBackgroundColor: '#A91D3A',
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

  async renderSecondaryGrid() {
    const iso = DateUtils.todayISO();
    const profile = Storage.getProfile();

    const waterAmount = Water.getAmount(iso);
    const waterTile = this.secTile('sec-blue', 'VESI', `${waterAmount}`, `/ ${profile.waterTarget} ML`, 'water');

    const health = await CloudSync.getHealthDaily(iso);
const steps = health?.steps ?? Steps.getAmount(iso);
const distanceKm = health?.distance_km ?? null;
    const stepsTile = `
      <div class="sec-tile sec-plain" id="dash-steps-tile">
        <div class="tile-label">SAMMUD</div>
        <input type="number" id="dash-steps-input" class="sec-tile-value dash-steps-input" value="${steps || ''}" placeholder="0000">
      </div>
    `;

    const latestM = Measurements.latestFor('weight');
    const weightDue = Measurements.isDue('weight', 7);
    const weightSub = latestM
      ? (weightDue
          ? 'KG · SELLE NÄDALA KAAL OOTAB'
          : `KG · JÄRGMINE ${DateUtils.formatEt(Measurements.nextDueDate('weight', 7)).toUpperCase()}`)
      : 'NÄDALA KAAL OOTAB';
    const weightTile = this.secTile(
      weightDue ? 'sec-butter' : 'sec-blue',
      'NÄDALA KAAL',
      latestM ? `${latestM.weight}` : '—',
      weightSub,
      'measurements'
    );

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
      <a href="#" class="cycle-strip-link" data-nav="finance">FINANTSID →</a>
    `;
    el.querySelector('[data-nav]').addEventListener('click', (e) => { e.preventDefault(); App.showTab('finance'); });
  },

  render() {
    this.renderDateRow();
    this.safeRender('Tänane fookus', () => this.renderDailyBrief(), 'daily-brief');
    this.safeRender('Kiirvalikud', () => this.renderQuickActions(), 'dashboard-actions');
    this.safeRender('Tänane kütus', () => this.renderHeroEnergy(), 'hero-kcal-target');
    this.safeRender('Nädalagraafik', () => this.renderHeroWeek(), null);
    this.safeRender('Päeva ülevaade', () => this.renderSecondaryGrid(), 'dashboard-secondary');
    this.safeRender('Tsükli ülevaade', () => this.renderCycleStrip(), 'cycle-strip');
    this.safeRender('Finantsülevaade', () => this.renderMoneyStrip(), 'money-strip');

    this.safeRender('Nädalaraport', () => WeeklyAnalysis.renderCard(), 'weekly-analysis-card');
    WeeklyAnalysis.maybeAutoGenerate()
      .then(() => this.safeRender('Nädalaraport', () => WeeklyAnalysis.renderCard(), 'weekly-analysis-card'))
      .catch(error => console.error('Weekly analysis error', error));
  },

  init() {
    this.initStepsBackfill();
    this.render();
  },
};
