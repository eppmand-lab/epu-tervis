const App = {
  refreshers: {
    dashboard: () => Dashboard.render(),
    nutrition: () => Nutrition.renderAll(),
    workouts: () => Workouts.renderHistory(),
    gymplans: () => GymPlans.renderAll(),
    measurements: () => Measurements.renderAll(),
    cycle: () => Cycle.renderAll(),
    water: () => Water.renderAll(),
    photos: () => Photos.renderAll(),
    settings: () => Settings.loadIntoForms(),
  },

  showTab(tabId) {
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tabId);
    });
    document.querySelectorAll('.tab-panel').forEach(panel => {
      panel.classList.toggle('active', panel.id === `tab-${tabId}`);
    });
    const refresh = this.refreshers[tabId];
    if (refresh) refresh();
  },

  initTabs() {
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => this.showTab(btn.dataset.tab));
    });
  },

  init() {
    this.initTabs();
    Nutrition.init();
    Workouts.init();
    GymPlans.init();
    Measurements.init();
    Cycle.init();
    Water.init();
    Photos.init();
    Settings.init();
    Dashboard.init();
  },
};

document.addEventListener('DOMContentLoaded', () => App.init());
