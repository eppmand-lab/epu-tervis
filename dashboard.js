const Dashboard = {
  sparkChart: null,

  async safeRender(label, renderFn, fallbackId) {
    try {
      await renderFn();
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

  async renderHeroEnergy() {
    const iso = DateUtils.todayISO();
    await Nutrition.loadDay(iso);
    const profile = Storage.getProfile();
    const totals = Nutrition.dayTotals(iso);
    const pct = profile.macros.kcal
      ? Math.min(100, (totals.kcal / profile.macros.kcal) * 100)
      : 0;

    document.getElementById('hero-kcal-value').textContent = Fmt.int(totals.kcal);
    document.getElementById('hero-kcal-target').textContent =
      `/ ${Fmt.int(profile.macros.kcal)} KCAL`;
    document.getElementById('hero-kcal-fill').style.width = `${pct}%`;
    const percentEl = document.getElementById('hero-kcal-percent');
    if (percentEl) percentEl.textContent = `${Math.round(pct)}%`;
    const ringEl = document.getElementById('hero-kcal-ring');
    if (ringEl) ringEl.style.setProperty('--p', `${pct * 3.6}deg`);
    const macrosEl = document.getElementById('dashboard-macros');
    if (macrosEl) {
      macrosEl.innerHTML = `
        <span>V ${Fmt.round1(totals.protein)} g</span>
        <span>R ${Fmt.round1(totals.fat)} g</span>
        <span>SV ${Fmt.round1(totals.carbs)} g</span>
      `;
    }
  },

  async dailyGuidance() {
    const iso = DateUtils.todayISO();
    await Nutrition.loadDay(iso);
    const health = await CloudSync.getHealthDaily(iso);
    const profile = Storage.getProfile();
    const totals = Nutrition.dayTotals(iso);
    const steps = health?.steps ?? Steps.getAmount(iso);

    const todayWorkouts =
      Workouts.getAll().filter(w => w.date === iso).length +
      GymPlans.getSessions().filter(s => s.date === iso).length;

    const proteinLeft = Math.max(
      0,
      Math.round(profile.macros.protein - totals.protein)
    );

    const kcalLeft = Math.max(
      0,
      Math.round(profile.macros.kcal - totals.kcal)
    );

    let headline = 'PÄEV ON AVATUD.';
    let message =
      `Sul on tänaseks alles ${kcalLeft} kcal ja ${proteinLeft} g valku.`;

    if (totals.kcal === 0) {
      headline = 'ALUSTA ÜHEST LIHTSAST ASJAST.';
      message =
        'Lisa esimene söögikord — ülejäänud päev muutub kohe selgemaks.';
    } else if (proteinLeft > 35) {
      headline = 'VALK VAJAB TÄHELEPANU.';
      message =
        `Valgueesmärgist on puudu ${proteinLeft} g. Planeeri järgmine toidukord selle ümber.`;
    } else if (!todayWorkouts && steps < 8000) {
      headline = 'LIIKUMISEKS ON VEEL RUUMI.';
      message =
        `Täna on kirjas ${Fmt.int(steps)} sammu. Rahulik jalutuskäik viib päeva kenasti edasi.`;
    } else {
      headline = 'PÕHIASJAD ON KONTROLLI ALL.';
      message =
        'Jätka sama rütmiga — sul pole vaja tänast päeva keerulisemaks teha.';
    }

    return {
      headline,
      message,
      proteinLeft,
      kcalLeft
    };
  },

  async renderDailyBrief() {
    const el = document.getElementById('daily-brief');
    const guidance = await this.dailyGuidance();

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
      { tab: 'nutrition', label: 'Vaata toitumist' },
      { tab: 'gymplans', label: 'Jõusaalikava' },
      { tab: 'workouts', label: '+ Logi trenn' },
      { tab: 'measurements', label: 'Mõõtmised' },
    ];

    const el = document.getElementById('dashboard-actions');

    el.innerHTML = actions.map(action => `
      <button class="quick-action-btn" data-nav="${action.tab}">
        ${action.label}
      </button>
    `).join('');

    el.querySelectorAll('[data-nav]').forEach(button => {
      button.addEventListener(
        'click',
        () => App.showTab(button.dataset.nav)
      );
    });
  },

  async renderHeroWeek() {
    if (typeof Chart === 'undefined') return;
    const iso = DateUtils.todayISO();

    document.getElementById('hero-week-num').textContent =
      DateUtils.weekNumber(iso);

    const { start } = DateUtils.weekBounds(iso);
    const days = DateUtils.rangeDays(start, iso);
    await Nutrition.loadDays(days);
    const values = days.map(d => Nutrition.dayTotals(d).kcal);

    const ctx = document.getElementById('chart-week-spark');

    ChartTheme.destroy(this.sparkChart);

    this.sparkChart = new Chart(ctx, {
      type: 'line',

      data: {
        labels: days.map(d => DateUtils.weekdayShortEt(d)),

        datasets: [{
          data: values,
          borderColor: '#25B77B',
          backgroundColor: '#25B77B',
          borderWidth: 2,
          pointRadius: 3,
          pointBackgroundColor: '#25B77B',
          tension: 0.3,
          fill: false,
        }],
      },

      options: {
        responsive: true,
        maintainAspectRatio: false,

        plugins: {
          legend: { display: false },
          tooltip: { enabled: false }
        },

        scales: {
          x: {
            display: false
          },

          y: {
            display: false,
            beginAtZero: true
          },
        },
      },
    });
  },

  secTile(cls, label, value, sub, nav) {
    return `
      <div
        class="sec-tile ${cls}"
        ${nav ? `data-nav="${nav}"` : ''}
      >
        <div class="tile-label">${label}</div>
        <div class="sec-tile-value">${value}</div>
        ${sub ? `<div class="sec-tile-sub">${sub}</div>` : ''}
      </div>
    `;
  },

  async renderSecondaryGrid() {
    const iso = DateUtils.todayISO();
    const profile = Storage.getProfile();

    // Apple Health / Supabase
    // Kui Health-andmeid ei ole, kasutame varuvariandina
    // äpi lokaalselt salvestatud sammude väärtust.
    const health = await CloudSync.getHealthDaily(iso);
    const steps = health?.steps ?? Steps.getAmount(iso);
    const distanceKm = health?.distance_km ?? null;

    const stepsTile = `
      <div class="sec-tile sec-plain" id="dash-steps-tile">
        <div class="tile-label">AKTIIVSUS</div>
        <div class="sec-tile-value">${Fmt.int(steps)}</div>
        <div class="sec-tile-sub">
          SAMMU${distanceKm !== null
            ? ` · ${Number(distanceKm).toFixed(2)} KM`
            : ''}
        </div>
      </div>
    `;

    const latestM = Measurements.latestFor('weight');
    const weightDue = Measurements.isDue('weight', 7);

    const weightSub = latestM
      ? (
          weightDue
            ? 'KG · SELLE NÄDALA KAAL OOTAB'
            : `KG · JÄRGMINE ${DateUtils.formatEt(
                Measurements.nextDueDate('weight', 7)
              ).toUpperCase()}`
        )
      : 'NÄDALA KAAL OOTAB';

    const weightTile = this.secTile(
      weightDue ? 'sec-butter' : 'sec-blue',
      'NÄDALA KAAL',
      latestM ? `${latestM.weight}` : '—',
      weightSub,
      'measurements'
    );

    const lastWorkout = [
      ...Workouts.getAll().map(workout => ({ date: workout.date, type: workout.type || 'Treening' })),
      ...GymPlans.getSessions().map(session => ({ date: session.date, type: session.programLabel || 'Jõusaal' })),
    ].sort((a, b) => b.date.localeCompare(a.date))[0];

    const lastWorkoutTile = this.secTile(
      'sec-oxblood',
      'VIIMANE TRENN',
      lastWorkout
        ? lastWorkout.type.toUpperCase()
        : 'POLE LOGITUD',
      lastWorkout
        ? DateUtils.formatEt(lastWorkout.date).toUpperCase()
        : '',
      'workouts'
    );

    const el = document.getElementById('dashboard-secondary');

    el.innerHTML =
      stepsTile +
      weightTile +
      lastWorkoutTile;

    el.querySelectorAll('[data-nav]').forEach(tile => {
      tile.addEventListener(
        'click',
        () => App.showTab(tile.dataset.nav)
      );
    });
  },

  renderTrainingOverview() {
    const { start, end } = DateUtils.weekBounds(DateUtils.todayISO());
    const regular = Workouts.getAll();
    const gym = GymPlans.getSessions();
    const weekCount = regular.filter(workout => workout.date >= start && workout.date <= end).length
      + gym.filter(session => session.date >= start && session.date <= end).length;
    const combined = [
      ...regular.map(workout => ({ date: workout.date, label: workout.type || 'Treening' })),
      ...gym.map(session => ({ date: session.date, label: session.programLabel || 'Jõusaal' })),
    ].sort((a, b) => b.date.localeCompare(a.date));
    const latest = combined[0];
    document.getElementById('dashboard-training-count').textContent = weekCount;
    document.getElementById('dashboard-last-workout').textContent = latest
      ? `Viimane: ${latest.label} · ${DateUtils.formatEt(latest.date)}`
      : 'Viimast treeningut pole veel logitud';
  },

  renderFinanceOverview() {
    const stats = Finance.computeSafeToSpend();
    document.getElementById('dashboard-safe-spend').textContent = `${Finance.fmt(stats.today)} €`;
    document.getElementById('dashboard-payday-days').textContent = stats.daysToPayday;
  },

  renderMoneyStrip() {
    const el =
      document.getElementById('money-strip');

    const sts =
      Finance.computeSafeToSpend();

    el.innerHTML = `
      <span>
        TÄNANE KULUTUSEELARVE — ${Finance.fmt(sts.today)} €
      </span>

      <a
        href="#"
        class="cycle-strip-link"
        data-nav="finance"
      >
        FINANTSID →
      </a>
    `;

    el
      .querySelector('[data-nav]')
      .addEventListener('click', (e) => {
        e.preventDefault();
        App.showTab('finance');
      });
  },

  render() {
    this.renderDateRow();

    this.safeRender(
      'Tänane fookus',
      () => this.renderDailyBrief(),
      'daily-brief'
    );

    this.safeRender(
      'Kiirvalikud',
      () => this.renderQuickActions(),
      'dashboard-actions'
    );

    this.safeRender(
      'Tänane kütus',
      () => this.renderHeroEnergy(),
      'hero-kcal-target'
    );

    this.safeRender(
      'Nädalagraafik',
      () => this.renderHeroWeek(),
      null
    );

    this.safeRender(
      'Päeva ülevaade',
      () => this.renderSecondaryGrid(),
      'dashboard-secondary'
    );

    this.safeRender(
      'Treeningute ülevaade',
      () => this.renderTrainingOverview(),
      'dashboard-last-workout'
    );

    this.safeRender(
      'Finantsülevaade',
      () => {
        this.renderFinanceOverview();
        this.renderMoneyStrip();
      },
      'dashboard-safe-spend'
    );

  },

  init() {
    this.render();
    if (!this.autoRefreshTimer) {
      this.autoRefreshTimer = window.setInterval(() => {
        if (!document.hidden) this.render();
      }, 5 * 60 * 1000);
      document.addEventListener('visibilitychange', () => {
        if (!document.hidden) this.render();
      });
      window.addEventListener('focus', () => this.render());
    }
  },
};
