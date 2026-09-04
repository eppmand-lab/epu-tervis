const Dashboard = {
  sparkChart: null,

  greeting() {
    const h = new Date().getHours();
    if (h < 11) return 'Tere hommikust, Epp';
    if (h < 17) return 'Tere päevast, Epp';
    return 'Tere õhtust, Epp';
  },

  renderDateRow() {
    const iso = DateUtils.todayISO();
    const el = document.getElementById('dashboard-date');
    if (el) el.textContent = `${DateUtils.weekdayFullEt(iso)} · ${DateUtils.formatEt(iso)}`;
    const greeting = document.getElementById('dashboard-greeting');
    if (greeting) greeting.textContent = this.greeting();
  },

  renderHeroEnergy() {
    const iso = DateUtils.todayISO();
    const profile = Storage.getProfile();
    const totals = Nutrition.dayTotals(iso);
    const pct = profile.macros.kcal ? Math.min(100, (totals.kcal / profile.macros.kcal) * 100) : 0;
    document.getElementById('hero-kcal-value').textContent = Fmt.int(totals.kcal);
    document.getElementById('hero-kcal-target').textContent = `/ ${Fmt.int(profile.macros.kcal)} kcal`;
    document.getElementById('hero-kcal-fill').style.width = `${pct}%`;
    const ring = document.getElementById('hero-kcal-ring');
    if (ring) ring.style.setProperty('--p', `${pct * 3.6}deg`);
    const percent = document.getElementById('hero-kcal-percent');
    if (percent) percent.textContent = `${Math.round(pct)}%`;
    const macros = document.getElementById('dashboard-macros');
    if (macros) {
      macros.innerHTML = `
        <span><b>${Fmt.int(totals.protein)}</b> / ${Fmt.int(profile.macros.protein)}g protein</span>
        <span><b>${Fmt.int(totals.carbs)}</b>g carbs</span>
      `;
    }
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

    let headline = 'Põhiasjad on kontrolli all.';
    let message = 'Jätka sama rütmiga — sul pole vaja tänast päeva keerulisemaks teha.';
    let onTrack = true;

    if (totals.kcal === 0) {
      headline = 'Alusta ühest lihtsast asjast.';
      message = 'Lisa esimene söögikord — ülejäänud päev muutub kohe selgemaks.';
      onTrack = false;
    } else if (proteinLeft > 35) {
      headline = 'Valk vajab veel tähelepanu.';
      message = `Valgueesmärgist on puudu ${proteinLeft} g. Planeeri järgmine toidukord selle ümber.`;
      onTrack = false;
    } else if (water < profile.waterTarget * 0.6) {
      headline = 'Vesi on täna veidi maha jäänud.';
      message = `Eesmärgini on ${Math.max(0, profile.waterTarget - water)} ml. Lisa järgmine klaas kohe.`;
      onTrack = false;
    } else if (!todayWorkouts && steps < 8000) {
      headline = 'Liikumiseks on veel ruumi.';
      message = `Täna on kirjas ${Fmt.int(steps)} sammu. Rahulik jalutuskäik viib päeva kenasti edasi.`;
      onTrack = false;
    } else if (kcalLeft > 0 || proteinLeft > 0) {
      headline = 'Päev liigub õiges suunas.';
      message = `Sul on tänaseks alles ${kcalLeft} kcal ja ${proteinLeft} g valku.`;
    }
    return { headline, message, onTrack };
  },

  renderDailyBrief() {
    const el = document.getElementById('daily-brief');
    const guidance = this.dailyGuidance();
    el.innerHTML = `
      <div class="daily-brief-card">
        <div class="tile-label">EPP INSIGHT</div>
        <div class="daily-brief-title">${guidance.headline}</div>
        <div class="daily-brief-text">${guidance.message}</div>
      </div>
    `;
    const status = document.getElementById('dashboard-status');
    if (status) status.textContent = guidance.onTrack ? 'ON TRACK' : 'CHECK IN';
  },

  renderQuickActions() {
    const actions = [
      { tab: 'nutrition', label: '+ Lisa toit' },
      { tab: 'water', label: '+ Lisa vesi' },
      { tab: 'workouts', label: '+ Logi trenn' },
      { tab: 'measurements', label: '+ Mõõtmine' },
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
    const weekNum = document.getElementById('hero-week-num');
    if (weekNum) weekNum.textContent = DateUtils.weekNumber(iso);
    const { start } = DateUtils.weekBounds(iso);
    const days = DateUtils.rangeDays(start, iso);
    const values = days.map(d => Nutrition.dayTotals(d).kcal);
    const ctx = document.getElementById('chart-week-spark');
    if (!ctx) return;
    ChartTheme.destroy(this.sparkChart);
    this.sparkChart = new Chart(ctx, {
      type: 'line',
      data: { labels: days.map(d => DateUtils.weekdayShortEt(d)), datasets: [{ data: values, borderColor: '#6f4cff', borderWidth: 2, pointRadius: 0, tension: .35, fill: false }] },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { enabled: false } }, scales: { x: { display: false }, y: { display: false, beginAtZero: true } } },
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
    const latestM = Measurements.latestFor('weight');
    const weightDue = Measurements.isDue('weight', 7);
    const waterAmount = Water.getAmount(iso);
    const steps = Steps.getAmount(iso);

    const weightTile = this.secTile(
      weightDue ? 'sec-butter' : 'sec-blue',
      'BODY',
      latestM ? `${latestM.weight} kg` : '—',
      weightDue ? 'Nädala kaal ootab' : 'Viimane kaal',
      'measurements'
    );
    const waterTile = this.secTile('sec-blue', 'HYDRATION', `${waterAmount} ml`, `/ ${profile.waterTarget} ml`, 'water');
    const stepsTile = `
      <div class="sec-tile sec-plain" id="dash-steps-tile">
        <div class="tile-label">ACTIVITY</div>
        <input type="number" id="dash-steps-input" class="sec-tile-value dash-steps-input" value="${steps || ''}" placeholder="0">
        <div class="sec-tile-sub">sammu täna</div>
      </div>`;

    const workouts = Workouts.getAll();
    const gymSessions = GymPlans.getSessions();
    const last = [...workouts.map(w => ({...w, _label:w.type})), ...gymSessions.map(s => ({...s, _label:'Jõusaal'}))]
      .sort((a,b) => (b.date || '').localeCompare(a.date || ''))[0];
    const workoutTile = this.secTile('sec-oxblood', 'LAST SESSION', last ? last._label : 'Pole logitud', last?.date ? DateUtils.formatEt(last.date) : '', 'workouts');

    const el = document.getElementById('dashboard-secondary');
    el.innerHTML = weightTile + stepsTile + waterTile + workoutTile;
    el.querySelectorAll('[data-nav]').forEach(tile => tile.addEventListener('click', () => App.showTab(tile.dataset.nav)));

    const stepsInput = document.getElementById('dash-steps-input');
    document.getElementById('dash-steps-tile').addEventListener('click', (e) => { if (e.target !== stepsInput) stepsInput.focus(); });
    stepsInput.addEventListener('click', (e) => e.stopPropagation());
    stepsInput.addEventListener('change', () => {
      Steps.save(iso, parseInt(stepsInput.value, 10) || 0);
      UI.toast('Sammud salvestatud');
    });
  },

  renderTrainingCard() {
    const iso = DateUtils.todayISO();
    const { start, end } = DateUtils.weekBounds(iso);
    const workouts = Workouts.getAll().filter(w => w.date >= start && w.date <= end);
    const gym = GymPlans.getSessions().filter(s => s.date >= start && s.date <= end);
    const all = [...workouts.map(w => ({...w, _label:w.type})), ...gym.map(s => ({...s, _label:'Jõusaal'}))];
    document.getElementById('dashboard-training-count').textContent = all.length;
    const last = all.sort((a,b) => (b.date || '').localeCompare(a.date || ''))[0];
    document.getElementById('dashboard-last-workout').textContent = last
      ? `Viimane: ${last._label} · ${DateUtils.formatEt(last.date)}`
      : 'Selle nädala esimest treeningut pole veel logitud.';
  },

  renderFinanceCard() {
    const sts = Finance.computeSafeToSpend();
    document.getElementById('dashboard-safe-spend').textContent = `${Finance.fmt(sts.today)} €`;
    document.getElementById('dashboard-payday-days').textContent = sts.daysToPayday;
  },

  initStepsBackfill() {
    const toggle = document.getElementById('steps-backfill-toggle');
    const form = document.getElementById('steps-backfill-form');
    const dateInput = document.getElementById('steps-backfill-date');
    dateInput.value = DateUtils.todayISO();
    toggle.addEventListener('click', (e) => { e.preventDefault(); form.classList.toggle('hidden'); });
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
      el.innerHTML = `<span>Tsükkel — pole andmeid</span><a href="#" class="cycle-strip-link" data-nav="cycle">Lisa →</a>`;
    } else {
      const phaseInfo = Cycle.PHASES[status.phase];
      el.innerHTML = `<span>${phaseInfo.label} · päev ${status.currentDay}/${status.cycleLength}</span><a href="#" class="cycle-strip-link" data-nav="cycle">Vaata →</a>`;
    }
    el.querySelector('[data-nav]')?.addEventListener('click', (e) => { e.preventDefault(); App.showTab('cycle'); });
  },

  renderMoneyStrip() {
    const el = document.getElementById('money-strip');
    const sts = Finance.computeSafeToSpend();
    el.innerHTML = `<span>Safe to spend · ${Finance.fmt(sts.today)} € / päev</span><a href="#" class="cycle-strip-link" data-nav="finance">Finance →</a>`;
    el.querySelector('[data-nav]')?.addEventListener('click', (e) => { e.preventDefault(); App.showTab('finance'); });
  },

  render() {
    this.renderDateRow();
    this.renderDailyBrief();
    this.renderQuickActions();
    this.renderHeroEnergy();
    this.renderHeroWeek();
    this.renderSecondaryGrid();
    this.renderTrainingCard();
    this.renderFinanceCard();
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
