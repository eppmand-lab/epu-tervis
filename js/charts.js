// Ühtne Chart.js seadistus, mis kasutab valideeritud brändipaletti
// (vt vestlus: värvid läbisid CVD/kontrasti/heleduse kontrollid dataviz skill'i validaatoriga).
const ChartTheme = {
  colors: {
    green: '#3F8F5C',
    blue: '#3E7CB1',
    amber: '#D68A1F',
    pink: '#D6798A',
  },
  ink: '#3A3230',
  inkMuted: '#7A7068',
  grid: '#EAE1DA',
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
            titleColor: '#fff',
            bodyColor: '#fff',
            padding: 10,
            cornerRadius: 8,
            displayColors: true,
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
