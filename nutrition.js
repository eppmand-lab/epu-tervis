const Nutrition = {
  healthByDate: {},

  emptyTotals() {
    return {
      kcal: 0,
      protein: 0,
      fat: 0,
      carbs: 0,
      fiber: 0,
    };
  },

  async loadDay(iso) {
    const health = await CloudSync.getHealthDaily(iso);

    if (!health) {
      this.healthByDate[iso] = null;
      return null;
    }

    const totals = {
      kcal: Number(health.dietary_energy_kcal || 0),
      protein: Number(health.protein_g || 0),
      fat: Number(health.total_fat_g || 0),
      carbs: Number(health.carbohydrates_g || 0),
      fiber: Number(health.fiber_g || 0),
    };

    this.healthByDate[iso] = totals;
    return totals;
  },

  dayTotals(iso) {
    return this.healthByDate[iso] || this.emptyTotals();
  },

  selectedDate() {
    const input = document.getElementById('nutrition-date');

    return (
      (input && input.value) ||
      DateUtils.todayISO()
    );
  },

  async renderAll() {
    const iso = this.selectedDate();
    const summary = document.getElementById('macro-summary');
    const log = document.getElementById('food-log-list');

    if (summary) {
      summary.innerHTML =
        '<p class="hint">Laen FatSecreti andmeid…</p>';
    }

    const totals = await this.loadDay(iso);
    const profile = Storage.getProfile();
    const targets = profile.macros;

    if (!totals) {
      if (summary) {
        summary.innerHTML = `
          <p class="hint">
            Selle päeva FatSecreti andmeid ei ole veel sünkroniseeritud.
          </p>
        `;
      }

      if (log) {
        log.innerHTML = `
          <p class="hint">
            Ava Health Auto Export ja käivita sünkroniseerimine.
          </p>
        `;
      }

      return;
    }

    const rows = [
      {
        label: 'Kalorid',
        value: totals.kcal,
        target: targets.kcal,
        unit: 'kcal',
        color: 'var(--espresso)',
      },
      {
        label: 'Valk',
        value: totals.protein,
        target: targets.protein,
        unit: 'g',
        color: 'var(--chart-red)',
      },
      {
        label: 'Rasv',
        value: totals.fat,
        target: targets.fat,
        unit: 'g',
        color: 'var(--powder-blue)',
      },
      {
        label: 'Süsivesikud',
        value: totals.carbs,
        target: targets.carbs,
        unit: 'g',
        color: 'var(--butter)',
      },
      {
        label: 'Kiudained',
        value: totals.fiber,
        target: 30,
        unit: 'g',
        color: 'var(--espresso)',
      },
    ];

    if (summary) {
      summary.innerHTML = rows
        .map((row) => {
          const pct = row.target
            ? Math.min(
                100,
                (row.value / row.target) * 100
              )
            : 0;

          return `
            <div class="macro-bar-row">
              <div class="macro-bar-label">
                ${row.label}
              </div>

              <div class="macro-bar-track">
                <div
                  class="macro-bar-fill"
                  style="
                    width: ${pct}%;
                    background: ${row.color};
                  "
                ></div>
              </div>

              <div class="macro-bar-value">
                ${Fmt.round1(row.value)}
                /
                ${Fmt.int(row.target)}
                ${row.unit}
              </div>
            </div>
          `;
        })
        .join('');
    }

    if (log) {
      log.innerHTML = `
        <div class="food-log-item">
          <div>
            <div class="fli-main">
              FATSECRET · APPLE HEALTH
            </div>

            <div class="fli-sub">
              ${Fmt.round1(totals.kcal)} kcal ·
              V ${Fmt.round1(totals.protein)} g ·
              R ${Fmt.round1(totals.fat)} g ·
              SV ${Fmt.round1(totals.carbs)} g ·
              K ${Fmt.round1(totals.fiber)} g
            </div>
          </div>
        </div>
      `;
    }
  },

  init() {
    const dateInput =
      document.getElementById('nutrition-date');

    if (!dateInput) return;

    dateInput.value = DateUtils.todayISO();

    dateInput.addEventListener(
      'change',
      () => this.renderAll()
    );

    this.renderAll();
  },
};
