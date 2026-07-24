const App = {
  TAB_THEMES: {
    dashboard: 'neutral',
    nutrition: 'body', workouts: 'body', gymplans: 'body', measurements: 'body',
    cycle: 'body', water: 'body', photos: 'body',
    finance: 'money',
    settings: 'neutral',
  },

  refreshers: {
    dashboard: () => Dashboard.render(),
    nutrition: () => Nutrition.renderAll(),
    workouts: () => Workouts.renderHistory(),
    gymplans: () => GymPlans.renderAll(),
    measurements: () => Measurements.renderAll(),
    cycle: () => Cycle.renderAll(),
    water: () => Water.renderAll(),
    photos: () => Photos.renderAll(),
    finance: () => Finance.renderAll(),
    settings: () => Settings.loadIntoForms(),
  },

  showTab(tabId) {
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tabId);
    });
    document.querySelectorAll('.tab-panel').forEach(panel => {
      panel.classList.toggle('active', panel.id === `tab-${tabId}`);
    });

    const theme = this.TAB_THEMES[tabId] || 'neutral';
    const brandbar = document.querySelector('.brandbar');
    const tabbar = document.getElementById('tabbar');
    ['theme-body', 'theme-money', 'theme-neutral'].forEach(cls => {
      brandbar.classList.remove(cls);
      tabbar.classList.remove(cls);
    });
    brandbar.classList.add(`theme-${theme}`);
    tabbar.classList.add(`theme-${theme}`);

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
    Finance.init();
    Settings.init();
    Dashboard.init();
  },
};

document.addEventListener('DOMContentLoaded', () => App.init());
