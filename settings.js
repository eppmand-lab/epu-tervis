const Settings = {
  loadIntoForms() {
    const p = Storage.getProfile();
    document.getElementById('p-age').value = p.age ?? '';
    document.getElementById('p-height').value = p.height ?? '';
    document.getElementById('p-activity').value = p.activity || 'moderate';
    document.getElementById('mt-kcal').value = p.macros.kcal ?? '';
    document.getElementById('mt-protein').value = p.macros.protein ?? '';
    document.getElementById('mt-fat').value = p.macros.fat ?? '';
    document.getElementById('mt-carbs').value = p.macros.carbs ?? '';
    document.getElementById('wt-target').value = p.waterTarget ?? '';
    document.getElementById('anthropic-key').value = p.anthropicApiKey || '';
  },

  handleProfileSubmit(e) {
    e.preventDefault();
    const p = Storage.getProfile();
    p.age = parseInt(document.getElementById('p-age').value, 10) || p.age;
    p.height = parseFloat(document.getElementById('p-height').value) || p.height;
    p.activity = document.getElementById('p-activity').value;
    Storage.saveProfile(p);
    UI.toast('Profiil salvestatud');
  },

  handleMacroSubmit(e) {
    e.preventDefault();
    const p = Storage.getProfile();
    p.macros = {
      kcal: parseFloat(document.getElementById('mt-kcal').value) || p.macros.kcal,
      protein: parseFloat(document.getElementById('mt-protein').value) || p.macros.protein,
      fat: parseFloat(document.getElementById('mt-fat').value) || p.macros.fat,
      carbs: parseFloat(document.getElementById('mt-carbs').value) || p.macros.carbs,
    };
    Storage.saveProfile(p);
    Nutrition.renderAll();
    UI.toast('Eesmärgid salvestatud');
  },

  handleWaterTargetSubmit(e) {
    e.preventDefault();
    const p = Storage.getProfile();
    p.waterTarget = parseFloat(document.getElementById('wt-target').value) || p.waterTarget;
    Storage.saveProfile(p);
    Water.renderAll();
    UI.toast('Vee eesmärk salvestatud');
  },

  handleApiKeySubmit(e) {
    e.preventDefault();
    const p = Storage.getProfile();
    p.anthropicApiKey = document.getElementById('anthropic-key').value.trim();
    Storage.saveProfile(p);
    UI.toast('API võti salvestatud');
  },

  exportData() {
    const all = {};
    Object.values(Storage.KEYS).forEach(key => {
      all[key] = Storage.get(key, null);
    });
    const blob = new Blob([JSON.stringify(all, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fitness-varukoopia-${DateUtils.todayISO()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  },

  resetData() {
    if (!confirm('Kas oled kindel? See kustutab KÕIK andmed (toitumine, treeningud, mõõdud, tsükkel, harjumused, vesi, fotod) jäädavalt.')) return;
    if (!confirm('Viimane kinnitus: kustutada kõik andmed?')) return;
    Object.values(Storage.KEYS).forEach(key => localStorage.removeItem(key));
    location.reload();
  },

  init() {
    this.loadIntoForms();
    document.getElementById('profile-form').addEventListener('submit', (e) => this.handleProfileSubmit(e));
    document.getElementById('macro-form').addEventListener('submit', (e) => this.handleMacroSubmit(e));
    document.getElementById('water-target-form').addEventListener('submit', (e) => this.handleWaterTargetSubmit(e));
    document.getElementById('apikey-form').addEventListener('submit', (e) => this.handleApiKeySubmit(e));
    document.getElementById('export-data-btn').addEventListener('click', () => this.exportData());
    document.getElementById('reset-data-btn').addEventListener('click', () => this.resetData());
  },
};
