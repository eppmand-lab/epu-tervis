const Nutrition = {
  _lastSearchResults: [],

  getLog() {
    return Storage.get(Storage.KEYS.FOOD_LOG, {});
  },

  getDayEntries(iso) {
    const log = this.getLog();
    return log[iso] || [];
  },

  addEntry(iso, entry) {
    const log = this.getLog();
    if (!log[iso]) log[iso] = [];
    log[iso].push(entry);
    Storage.set(Storage.KEYS.FOOD_LOG, log);
  },

  removeEntry(iso, entryId) {
    const log = this.getLog();
    if (!log[iso]) return;
    log[iso] = log[iso].filter(e => e.id !== entryId);
    Storage.set(Storage.KEYS.FOOD_LOG, log);
  },

  dayTotals(iso) {
    const entries = this.getDayEntries(iso);
    return entries.reduce((acc, e) => {
      acc.kcal += e.kcal || 0;
      acc.protein += e.protein || 0;
      acc.fat += e.fat || 0;
      acc.carbs += e.carbs || 0;
      return acc;
    }, { kcal: 0, protein: 0, fat: 0, carbs: 0 });
  },

  async searchOFF(term) {
    const url = `https://world.openfoodfacts.org/cgi/search.pl?json=1&action=process&search_terms=${encodeURIComponent(term)}&page_size=20&fields=product_name,brands,nutriments`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('OFF API viga');
    const data = await res.json();
    return (data.products || [])
      .filter(p => p.product_name && p.nutriments && (p.nutriments['energy-kcal_100g'] || p.nutriments['energy-kcal_value']))
      .map(p => ({
        name: p.brands ? `${p.product_name} (${p.brands})` : p.product_name,
        kcal100: p.nutriments['energy-kcal_100g'] || 0,
        protein100: p.nutriments['proteins_100g'] || 0,
        fat100: p.nutriments['fat_100g'] || 0,
        carbs100: p.nutriments['carbohydrates_100g'] || 0,
      }));
  },

  async runSearch() {
    const input = document.getElementById('food-search-input');
    const resultsEl = document.getElementById('food-search-results');
    const term = input.value.trim();
    if (!term) return;
    resultsEl.innerHTML = '<p class="hint">Otsin...</p>';
    try {
      const results = await this.searchOFF(term);
      this._lastSearchResults = results;
      if (!results.length) {
        resultsEl.innerHTML = '<p class="hint">Tulemusi ei leitud. Kasuta käsitsi sisestust allpool.</p>';
        this.showManualForm(term);
        return;
      }
      resultsEl.innerHTML = results.map((r, i) => `
        <div class="search-result-item" data-idx="${i}">
          <div>
            <div class="sri-name">${this._esc(r.name)}</div>
            <div class="sri-kcal">${Fmt.int(r.kcal100)} kcal / 100g · V ${Fmt.round1(r.protein100)}g · R ${Fmt.round1(r.fat100)}g · SV ${Fmt.round1(r.carbs100)}g</div>
          </div>
          <span>+</span>
        </div>
      `).join('');
      resultsEl.querySelectorAll('.search-result-item').forEach(el => {
        el.addEventListener('click', () => this.promptAddFromSearch(parseInt(el.dataset.idx, 10)));
      });
    } catch (e) {
      console.error(e);
      resultsEl.innerHTML = '<p class="hint">Otsing ebaõnnestus (internetiühendus?). Kasuta käsitsi sisestust allpool.</p>';
      this.showManualForm(term);
    }
  },

  promptAddFromSearch(idx) {
    const item = this._lastSearchResults[idx];
    if (!item) return;
    const grams = parseFloat(prompt(`Kogus grammides toidule "${item.name}":`, '100'));
    if (!grams || grams <= 0) return;
    const entry = {
      id: Fmt.uid(),
      name: item.name,
      grams,
      kcal: NutriMath.scale(item.kcal100, grams),
      protein: NutriMath.scale(item.protein100, grams),
      fat: NutriMath.scale(item.fat100, grams),
      carbs: NutriMath.scale(item.carbs100, grams),
      time: new Date().toISOString(),
    };
    this.addEntry(DateUtils.todayISO(), entry);
    document.getElementById('food-search-input').value = '';
    document.getElementById('food-search-results').innerHTML = '';
    this.renderAll();
    UI.toast('Toit lisatud päevikusse');
  },

  showManualForm(prefillName) {
    const el = document.getElementById('manual-food-form');
    el.classList.remove('hidden');
    el.innerHTML = `
      <h2>Käsitsi sisestus (100g kohta)</h2>
      <div class="stacked-form">
        <div class="form-row">
          <label>Nimetus <input type="text" id="mf-name" value="${this._esc(prefillName || '')}"></label>
          <label>Kogus (g) <input type="number" id="mf-grams" value="100"></label>
        </div>
        <div class="form-row">
          <label>Kcal/100g <input type="number" id="mf-kcal"></label>
          <label>Valk g/100g <input type="number" id="mf-protein"></label>
          <label>Rasv g/100g <input type="number" id="mf-fat"></label>
          <label>SV g/100g <input type="number" id="mf-carbs"></label>
        </div>
        <button class="btn btn-primary" id="mf-submit">Lisa päevikusse</button>
      </div>
    `;
    document.getElementById('mf-submit').addEventListener('click', () => {
      const name = document.getElementById('mf-name').value.trim() || 'Toit';
      const grams = parseFloat(document.getElementById('mf-grams').value) || 0;
      const kcal100 = parseFloat(document.getElementById('mf-kcal').value) || 0;
      const protein100 = parseFloat(document.getElementById('mf-protein').value) || 0;
      const fat100 = parseFloat(document.getElementById('mf-fat').value) || 0;
      const carbs100 = parseFloat(document.getElementById('mf-carbs').value) || 0;
      if (grams <= 0) { UI.toast('Sisesta kogus grammides'); return; }
      const entry = {
        id: Fmt.uid(), name, grams,
        kcal: NutriMath.scale(kcal100, grams),
        protein: NutriMath.scale(protein100, grams),
        fat: NutriMath.scale(fat100, grams),
        carbs: NutriMath.scale(carbs100, grams),
        time: new Date().toISOString(),
      };
      this.addEntry(DateUtils.todayISO(), entry);
      el.classList.add('hidden');
      el.innerHTML = '';
      document.getElementById('food-search-input').value = '';
      document.getElementById('food-search-results').innerHTML = '';
      this.renderAll();
      UI.toast('Toit lisatud päevikusse');
    });
  },

  renderMacroSummary() {
    const profile = Storage.getProfile();
    const totals = this.dayTotals(DateUtils.todayISO());
    const targets = profile.macros;
    const rows = [
      { label: 'Kalorid', value: totals.kcal, target: targets.kcal, unit: 'kcal', color: 'var(--pink)' },
      { label: 'Valk', value: totals.protein, target: targets.protein, unit: 'g', color: 'var(--chart-green)' },
      { label: 'Rasv', value: totals.fat, target: targets.fat, unit: 'g', color: 'var(--chart-blue)' },
      { label: 'Süsivesikud', value: totals.carbs, target: targets.carbs, unit: 'g', color: 'var(--chart-amber)' },
    ];
    const el = document.getElementById('macro-summary');
    el.innerHTML = rows.map(r => {
      const pct = r.target ? Math.min(100, (r.value / r.target) * 100) : 0;
      return `
        <div class="macro-bar-row">
          <div class="macro-bar-label">${r.label}</div>
          <div class="macro-bar-track"><div class="macro-bar-fill" style="width:${pct}%; background:${r.color}"></div></div>
          <div class="macro-bar-value">${Fmt.int(r.value)} / ${Fmt.int(r.target)} ${r.unit}</div>
        </div>
      `;
    }).join('');
  },

  renderLog() {
    const iso = DateUtils.todayISO();
    const entries = this.getDayEntries(iso).slice().reverse();
    const el = document.getElementById('food-log-list');
    if (!entries.length) {
      el.innerHTML = '<p class="hint">Täna pole veel midagi lisatud.</p>';
      return;
    }
    el.innerHTML = entries.map(e => `
      <div class="food-log-item">
        <div>
          <div class="fli-main">${this._esc(e.name)}</div>
          <div class="fli-sub">${Fmt.int(e.grams)}g · ${Fmt.int(e.kcal)} kcal · V${Fmt.round1(e.protein)} R${Fmt.round1(e.fat)} SV${Fmt.round1(e.carbs)}</div>
        </div>
        <button class="fli-remove" data-id="${e.id}" title="Eemalda">✕</button>
      </div>
    `).join('');
    el.querySelectorAll('.fli-remove').forEach(btn => {
      btn.addEventListener('click', () => {
        this.removeEntry(iso, btn.dataset.id);
        this.renderAll();
      });
    });
  },

  renderAll() {
    this.renderMacroSummary();
    this.renderLog();
  },

  _esc(s) {
    const d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
  },

  init() {
    document.getElementById('food-search-btn').addEventListener('click', () => this.runSearch());
    document.getElementById('food-search-input').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); this.runSearch(); }
    });
    this.renderAll();
  },
};
