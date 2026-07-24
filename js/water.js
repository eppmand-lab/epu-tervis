const Water = {
  ringChart: null,
  weekChart: null,
  QUICK_ADDS: [200, 330, 500, 750],

  getData() {
    return Storage.get(Storage.KEYS.WATER, {});
  },

  save(data) {
    Storage.set(Storage.KEYS.WATER, data);
  },

  getAmount(iso) {
    return this.getData()[iso] || 0;
  },

  add(iso, ml) {
    const data = this.getData();
    data[iso] = Math.max(0, (data[iso] || 0) + ml);
    this.save(data);
  },

  renderButtons() {
    const el = document.getElementById('water-buttons');
    el.innerHTML = this.QUICK_ADDS.map(ml => `<button class="btn btn-secondary" data-ml="${ml}">+${ml}ml</button>`).join('')
      + `<button class="btn btn-ghost" data-ml="-200">-200ml</button>`;
    el.querySelectorAll('button').forEach(btn => {
      btn.addEventListener('click', () => {
        this.add(DateUtils.todayISO(), parseInt(btn.dataset.ml, 10));
        this.renderAll();
      });
    });
  },

  renderRing() {
    const profile = Storage.getProfile();
    const target = profile.waterTarget || 2500;
    const amount = this.getAmount(DateUtils.todayISO());
    const pct = Math.min(100, Math.round((amount / target) * 100));

    document.getElementById('water-ring-label').innerHTML = `
      <div class="wrl-value">${amount} ml</div>
      <div class="wrl-target">eesmärk ${target} ml (${pct}%)</div>
    `;

    const ctx = document.getElementById('water-ring');
    ChartTheme.destroy(this.ringChart);
    this.ringChart = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: ['Joodud', 'Puudu'],
        datasets: [{
          data: [Math.min(amount, target), Math.max(target - amount, 0)],
          backgroundColor: [ChartTheme.colors.red, '#DED4C4'],
          borderWidth: 0,
        }],
      },
      options: {
        cutout: '75%',
        plugins: { legend: { display: false }, tooltip: { enabled: false } },
        animation: { duration: 400 },
      },
    });
  },

  renderWeekChart() {
    const days = DateUtils.lastNDays(7);
    const profile = Storage.getProfile();
    const target = profile.waterTarget || 2500;
    const ctx = document.getElementById('chart-water');
    ChartTheme.destroy(this.weekChart);
    this.weekChart = new Chart(ctx, ChartTheme.base('bar', {
      data: {
        labels: days.map(d => DateUtils.formatEt(d)),
        datasets: [
          {
            type: 'bar',
            label: 'Kogus (ml)',
            data: days.map(d => this.getAmount(d)),
            backgroundColor: ChartTheme.colors.blue,
            borderRadius: 4,
          },
          {
            type: 'line',
            label: 'Eesmärk',
            data: days.map(() => target),
            borderColor: ChartTheme.colors.espresso,
            borderDash: [6, 4],
            borderWidth: 2,
            pointRadius: 0,
            fill: false,
          },
        ],
      },
    }));
  },

  renderAll() {
    this.renderRing();
    this.renderWeekChart();
  },

  init() {
    this.renderButtons();
    this.renderAll();
  },
};
