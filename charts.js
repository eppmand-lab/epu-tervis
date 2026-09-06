// Ühtne Chart.js seadistus, mis kasutab valideeritud brändipaletti
// (vt vestlus: värvid läbisid CVD/kontrasti/heleduse kontrollid dataviz skill'i validaatoriga).
const ChartTheme = {
  colors: {
    red: '#25B77B',
    blue: '#179E94',
    amber: '#F39A5D',
    espresso: '#142126',
  },
  ink: '#142126',
  inkMuted: '#6F777A',
  grid: '#E7ECE9',
  surface: '#FFFFFF',

  base(type, extra) {
    return Object.assign({
      type,
      options: Object.assign({
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: {
            display: true,
            labels: { color: this.inkMuted, boxWidth: 10, boxHeight: 10, usePointStyle: true, font: { size: 11 } },
          },
          tooltip: {
            backgroundColor: this.ink,
            titleColor: '#FFFFFF',
            bodyColor: '#FFFFFF',
            padding: 10,
            cornerRadius: 2,
            displayColors: true,
            titleFont: { family: 'Inter', weight: '700' },
            bodyFont: { family: 'Inter' },
          },
        },
        scales: {
          x: { grid: { color: this.grid, display: false }, ticks: { color: this.inkMuted, font: { size: 11 } } },
          y: { grid: { color: this.grid }, ticks: { color: this.inkMuted, font: { size: 11 } }, beginAtZero: true },
        },
      }, extra?.options || {}),
    }, extra);
  },

  destroy(instance) {
    if (instance) instance.destroy();
  },
};
