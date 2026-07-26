const App = {
  GROUPS: {
    today: [{ tab: 'dashboard', label: 'Täna' }],
    nutrition: [
      { tab: 'nutrition', label: 'Toit' },
      { tab: 'water', label: 'Vesi' },
    ],
    movement: [
      { tab: 'workouts', label: 'Treeninglogi' },
      { tab: 'gymplans', label: 'Jõusaalikavad' },
    ],
    body: [
      { tab: 'measurements', label: 'Mõõdud' },
      { tab: 'cycle', label: 'Tsükkel' },
      { tab: 'photos', label: 'Fotod' },
    ],
    progress: [{ tab: 'progress', label: 'Progress' }],
    finance: [{ tab: 'finance', label: 'Finantsid' }],
    settings: [{ tab: 'settings', label: 'Seaded' }],
  },

  TAB_THEMES: {
    dashboard: 'body',
    nutrition: 'body', workouts: 'body', gymplans: 'body', measurements: 'body',
    cycle: 'body', water: 'body', photos: 'body',
    progress: 'body',
    finance: 'money',
    settings: 'body',
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
    progress: () => Progress.renderAll(),
    finance: () => Finance.renderAll(),
    settings: () => Settings.loadIntoForms(),
  },

  showTab(tabId) {
    const groupId = Object.keys(this.GROUPS).find(group =>
      this.GROUPS[group].some(item => item.tab === tabId)
    ) || 'today';

    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.group === groupId);
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
    this.renderSubtabs(groupId, tabId, theme);

    const refresh = this.refreshers[tabId];
    if (refresh) refresh();
  },

  renderSubtabs(groupId, activeTab, theme) {
    const subtabbar = document.getElementById('subtabbar');
    const items = this.GROUPS[groupId] || [];
    if (items.length <= 1) {
      subtabbar.className = 'subtabbar hidden';
      subtabbar.innerHTML = '';
      return;
    }
    subtabbar.className = `subtabbar theme-${theme}`;
    subtabbar.innerHTML = items.map(item => `
      <button class="subtab-btn ${item.tab === activeTab ? 'active' : ''}" data-tab="${item.tab}">
        ${item.label}
      </button>
    `).join('');
    subtabbar.querySelectorAll('.subtab-btn').forEach(btn => {
      btn.addEventListener('click', () => this.showTab(btn.dataset.tab));
    });
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
    Progress.init();
    Finance.init();
    Settings.init();
    Dashboard.init();
  },
};

document.addEventListener('DOMContentLoaded', async () => {
  const signedIn = await CloudSync.init();
  if (signedIn) App.init();
});
