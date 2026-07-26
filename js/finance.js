const Finance = {
  CATEGORIES: ['Toit', 'Transport', 'Kodu', 'Riided', 'Tervis', 'Trenn', 'Meelelahutus', 'Reisimine', 'Tellimused', 'Muu'],

  monthKey(iso) {
    return iso.slice(0, 7);
  },

  todayMonthKey() {
    return this.monthKey(DateUtils.todayISO());
  },

  previousMonthKey(monthKey) {
    const [year, month] = monthKey.split('-').map(Number);
    const date = new Date(year, month - 2, 1);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  },

  defaultPlan() {
    return { income: 0, fixedCosts: 0, invest: 0, extra: 0, buffer: 0, paydayDay: 31 };
  },

  getPlans() {
    return Storage.get(Storage.KEYS.FINANCE_PLANS, {});
  },

  savePlans(plans) {
    Storage.set(Storage.KEYS.FINANCE_PLANS, plans);
  },

  getPlan(monthKey) {
    const plans = this.getPlans();
    return plans[monthKey] || this.defaultPlan();
  },

  savePlan(monthKey, plan) {
    const plans = this.getPlans();
    plans[monthKey] = plan;
    this.savePlans(plans);
  },

  freeAmount(plan) {
    return plan.income - plan.fixedCosts - plan.invest - plan.extra - plan.buffer;
  },

  getTransactions() {
    return Storage.get(Storage.KEYS.FINANCE_TRANSACTIONS, []);
  },

  saveTransactions(list) {
    Storage.set(Storage.KEYS.FINANCE_TRANSACTIONS, list);
  },

  addTransaction(tx) {
    const all = this.getTransactions();
    all.push(tx);
    all.sort((a, b) => a.date.localeCompare(b.date));
    this.saveTransactions(all);
  },

  removeTransaction(id) {
    this.saveTransactions(this.getTransactions().filter(t => t.id !== id));
  },

  // Netomõju kuludele: ülekanded ei loe, tagastus/jagatud summa lahutatakse.
  netAmount(tx) {
    if (tx.isTransfer) return 0;
    let amount = tx.amount - (tx.sharedAmount || 0);
    if (tx.isRefund) amount = -amount;
    return amount;
  },

  monthTransactions(monthKey) {
    return this.getTransactions().filter(t => this.monthKey(t.date) === monthKey);
  },

  spentInMonth(monthKey) {
    return this.monthTransactions(monthKey).reduce((sum, t) => sum + this.netAmount(t), 0);
  },

  categoryTotals(monthKey) {
    const totals = {};
    this.monthTransactions(monthKey).forEach(t => {
      const net = this.netAmount(t);
      if (net <= 0) return;
      totals[t.category] = (totals[t.category] || 0) + net;
    });
    return totals;
  },

  getRecurring() {
    return Storage.get(Storage.KEYS.FINANCE_RECURRING, []);
  },

  saveRecurring(list) {
    Storage.set(Storage.KEYS.FINANCE_RECURRING, list);
  },

  addRecurring(item) {
    const all = this.getRecurring();
    all.push(item);
    this.saveRecurring(all);
  },

  removeRecurring(id) {
    this.saveRecurring(this.getRecurring().filter(r => r.id !== id));
  },

  getGoals() {
    return Storage.get(Storage.KEYS.FINANCE_GOALS, []);
  },

  saveGoals(list) {
    Storage.set(Storage.KEYS.FINANCE_GOALS, list);
  },

  addGoal(goal) {
    const all = this.getGoals();
    all.push(goal);
    this.saveGoals(all);
  },

  removeGoal(id) {
    this.saveGoals(this.getGoals().filter(g => g.id !== id));
  },

  contributeToGoal(id, amount) {
    const all = this.getGoals();
    const goal = all.find(g => g.id === id);
    if (!goal) return;
    goal.currentAmount += amount;
    goal.history.push({ date: DateUtils.todayISO(), amount });
    this.saveGoals(all);
  },

  goalPace(goal) {
    if (!goal.history || goal.history.length < 2) return null;
    const first = goal.history[0];
    const daysSpan = Math.max(1, DateUtils.diffDays(DateUtils.todayISO(), first.date));
    const totalContributed = goal.history.reduce((s, h) => s + h.amount, 0);
    const perDay = totalContributed / daysSpan;
    if (perDay <= 0) return null;
    const remaining = goal.targetAmount - goal.currentAmount;
    if (remaining <= 0) return { done: true };
    const daysLeft = Math.ceil(remaining / perDay);
    return { done: false, projectedDate: DateUtils.addDays(DateUtils.todayISO(), daysLeft), perDay };
  },

  // Kuu viimane kehtiv päev (nt päev=30 veebruaris -> 28/29). Kasuta paydayDay/dayOfMonth=31
  // kokkuleppena "kuu viimane päev", kuna see klambitakse alati õigesse kuupäeva.
  lastValidDay(year, month, day) {
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    return Math.min(day, daysInMonth);
  },

  // Järgmine palgapäev antud kuupäeva (dayOfMonth) järgi.
  nextPayday(fromIso, paydayDay) {
    const from = new Date(fromIso + 'T00:00:00');
    const candidate = new Date(from.getFullYear(), from.getMonth(), this.lastValidDay(from.getFullYear(), from.getMonth(), paydayDay));
    if (candidate >= from) return DateUtils.toISO(candidate);
    const y = from.getFullYear(), m = from.getMonth() + 1;
    const next = new Date(y, m, this.lastValidDay(y, m, paydayDay));
    return DateUtils.toISO(next);
  },

  // Kõik plaanitud püsikulud, mis jäävad täna ja järgmise palgapäeva vahele.
  upcomingRecurring(todayIso, paydayIso) {
    const today = new Date(todayIso + 'T00:00:00');
    const items = [];
    this.getRecurring().forEach(r => {
      [0, 1].forEach(offset => {
        const y = today.getFullYear(), m = today.getMonth() + offset;
        const d = new Date(y, m, this.lastValidDay(y, m, r.dayOfMonth));
        const iso = DateUtils.toISO(d);
        if (iso >= todayIso && iso <= paydayIso) {
          items.push({ ...r, date: iso });
        }
      });
    });
    return items.sort((a, b) => a.date.localeCompare(b.date));
  },

  computeSafeToSpend() {
    const todayIso = DateUtils.todayISO();
    const monthKey = this.monthKey(todayIso);
    const plan = this.getPlan(monthKey);
    const free = this.freeAmount(plan);
    const spent = this.spentInMonth(monthKey);
    const remainingFree = free - spent;

    const paydayIso = this.nextPayday(todayIso, plan.paydayDay || 31);
    const upcoming = this.upcomingRecurring(todayIso, paydayIso);
    const upcomingTotal = upcoming.reduce((s, u) => s + u.amount, 0);

    const toPayday = Math.max(0, remainingFree - upcomingTotal);
    const daysToPayday = Math.max(1, DateUtils.diffDays(paydayIso, todayIso));
    const today = toPayday / daysToPayday;
    const week = Math.min(toPayday, today * 7);

    return { plan, free, spent, remainingFree, paydayIso, upcoming, upcomingTotal, toPayday, daysToPayday, today, week };
  },

  fmt(n) {
    return Math.round(n).toLocaleString('et-EE');
  },

  renderStsHero() {
    const el = document.getElementById('finance-sts-hero');
    const sts = this.computeSafeToSpend();
    el.innerHTML = `
      <div class="tile-label">SAFE TO SPEND</div>
      <div class="weekly-headline">${this.fmt(sts.today)} € / päev</div>
      <div class="weekly-stats-plain">
        TÄNA — ${this.fmt(sts.today)} €<br>
        NÄDALAKS — ${this.fmt(sts.week)} €<br>
        PALGAPÄEVANI (${DateUtils.formatEt(sts.paydayIso)}) — ${this.fmt(sts.toPayday)} €
      </div>
      <button class="finance-breakdown-toggle" id="finance-breakdown-toggle">Kuidas see on arvutatud? →</button>
      <div class="finance-breakdown hidden" id="finance-breakdown">
        Sissetulek — ${this.fmt(sts.plan.income)} €<br>
        − Püsikulud — ${this.fmt(sts.plan.fixedCosts)} €<br>
        − Investeeringud — ${this.fmt(sts.plan.invest)} €<br>
        − Erakorralised kulud — ${this.fmt(sts.plan.extra)} €<br>
        − Minimaalne puhver — ${this.fmt(sts.plan.buffer)} €<br>
        = Vabalt kasutatav — ${this.fmt(sts.free)} €<br>
        − Kulutatud sel kuul — ${this.fmt(sts.spent)} €<br>
        − Lähenevad püsikulud enne palgapäeva — ${this.fmt(sts.upcomingTotal)} €<br>
        = Safe to Spend palgapäevani — ${this.fmt(sts.toPayday)} €
      </div>
    `;
    document.getElementById('finance-breakdown-toggle').addEventListener('click', () => {
      document.getElementById('finance-breakdown').classList.toggle('hidden');
    });
  },

  renderMonthTotal() {
    const monthKey = this.todayMonthKey();
    const plan = this.getPlan(monthKey);
    const transactions = this.spentInMonth(monthKey);
    const total = plan.fixedCosts + transactions;
    const previousKey = this.previousMonthKey(monthKey);
    const previousPlan = this.getPlan(previousKey);
    const previousTransactions = this.spentInMonth(previousKey);
    const previousTotal = previousPlan.fixedCosts + previousTransactions;
    const hasPreviousData = previousPlan.fixedCosts > 0 || this.monthTransactions(previousKey).length > 0;
    const difference = total - previousTotal;
    const monthLabel = new Intl.DateTimeFormat('et-EE', { month: 'long', year: 'numeric' })
      .format(new Date(`${monthKey}-01T00:00:00`));

    document.getElementById('finance-month-total').innerHTML = `
      <div class="finance-total-row">
        <div>
          <div class="tile-label">${monthLabel.toUpperCase()} · KUU KULUD KOKKU</div>
          <div class="finance-total-value">${this.fmt(total)} €</div>
        </div>
        <div class="finance-total-detail">
          <span>PÜSIKULUD ${this.fmt(plan.fixedCosts)} €</span>
          <span>MUUD KULUKANDED ${this.fmt(transactions)} €</span>
          ${hasPreviousData ? `<span class="${difference <= 0 ? 'is-positive' : 'is-negative'}">EELMISE KUUGA ${difference > 0 ? '+' : ''}${this.fmt(difference)} €</span>` : ''}
        </div>
      </div>
    `;
  },

  renderSecondary() {
    const monthKey = this.todayMonthKey();
    const plan = this.getPlan(monthKey);
    const spent = this.spentInMonth(monthKey);
    const free = this.freeAmount(plan);

    const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
    const dayOfMonth = new Date().getDate();
    const projectedSpend = dayOfMonth > 0 ? (spent / dayOfMonth) * daysInMonth : spent;
    const projectedLeftover = free - projectedSpend;

    const el = document.getElementById('finance-secondary');
    el.innerHTML = `
      <div class="sec-tile sec-blue">
        <div class="tile-label">MUUD KULUKANDED SEL KUUL</div>
        <div class="sec-tile-value">${this.fmt(spent)} €</div>
        <div class="sec-tile-sub">VABA ${this.fmt(free)} €-st</div>
      </div>
      <div class="sec-tile sec-butter">
        <div class="tile-label">KUU LÕPU PROGNOOS</div>
        <div class="sec-tile-value">${this.fmt(projectedLeftover)} €</div>
        <div class="sec-tile-sub">${projectedLeftover >= 0 ? 'JÄÄB ÜLE' : 'ÜLE EELARVE'}</div>
      </div>
    `;
  },

  renderUpcoming() {
    const el = document.getElementById('finance-upcoming');
    const todayIso = DateUtils.todayISO();
    const plan = this.getPlan(this.todayMonthKey());
    const paydayIso = this.nextPayday(todayIso, plan.paydayDay || 31);
    const upcoming = this.upcomingRecurring(todayIso, paydayIso);
    if (!upcoming.length) {
      el.innerHTML = '<p class="hint">Ühtegi püsikulu ei ole plaanis enne palgapäeva.</p>';
      return;
    }
    el.innerHTML = `
      <p class="hint">${upcoming.length} makse${upcoming.length > 1 ? 't' : ''} enne palgapäeva (${DateUtils.formatEt(paydayIso)}), kokku ${this.fmt(upcoming.reduce((s, u) => s + u.amount, 0))} €.</p>
      <div class="finance-timeline">
        ${upcoming.map(u => `
          <div class="finance-timeline-day has-payment">
            <div class="ftd-dot"></div>
            <div class="ftd-label">${DateUtils.formatEt(u.date)}</div>
            <div>${this._esc(u.name)}</div>
            <div>${this.fmt(u.amount)} €</div>
          </div>
        `).join('')}
      </div>
    `;
  },

  renderGoals() {
    const el = document.getElementById('finance-goals-display');
    const goals = this.getGoals();
    if (!goals.length) {
      el.innerHTML = '<p class="hint">Eesmärke pole veel lisatud.</p>';
      return;
    }
    el.innerHTML = goals.map(g => {
      const pct = Math.min(100, (g.currentAmount / g.targetAmount) * 100);
      const pace = this.goalPace(g);
      let paceLine = 'Lisa rohkem sissemakseid, et näha prognoosi.';
      if (pace && pace.done) paceLine = 'Eesmärk on täidetud!';
      else if (pace) paceLine = `Praeguse tempoga saavutad selle ${DateUtils.formatEt(pace.projectedDate)}.`;
      return `
        <div class="history-entry">
          <div class="he-top">
            <span class="he-date">${this._esc(g.name)}</span>
            <button class="he-remove" data-id="${g.id}">Kustuta</button>
          </div>
          <div class="he-title">${this.fmt(g.currentAmount)} / ${this.fmt(g.targetAmount)} €</div>
          <div class="hero-bar-track"><div class="hero-bar-fill" style="width:${pct}%"></div></div>
          <div class="he-sub">${paceLine}</div>
          <div class="form-row" style="margin-top:8px">
            <input type="number" class="goal-contribute-input" data-id="${g.id}" placeholder="Lisa sissemakse (€)" style="max-width:160px">
            <button class="btn btn-ghost goal-contribute-btn" data-id="${g.id}">Lisa</button>
          </div>
        </div>
      `;
    }).join('');
    el.querySelectorAll('.he-remove').forEach(btn => {
      btn.addEventListener('click', () => { this.removeGoal(btn.dataset.id); this.renderGoals(); });
    });
    el.querySelectorAll('.goal-contribute-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const input = el.querySelector(`.goal-contribute-input[data-id="${btn.dataset.id}"]`);
        const amount = parseFloat(input.value);
        if (!amount) { UI.toast('Sisesta summa'); return; }
        this.contributeToGoal(btn.dataset.id, amount);
        this.renderGoals();
        UI.toast('Sissemakse lisatud');
      });
    });
  },

  renderTxHistory() {
    const el = document.getElementById('finance-tx-history');
    const all = this.getTransactions().slice().sort((a, b) => b.date.localeCompare(a.date));
    if (!all.length) {
      el.innerHTML = '<p class="hint">Tehinguid pole veel lisatud.</p>';
      return;
    }
    el.innerHTML = all.slice(0, 50).map(t => {
      const net = this.netAmount(t);
      const tags = [t.lifeDomain, t.necessity, t.isRefund ? 'tagastus' : '', t.isTransfer ? 'ülekanne' : ''].filter(Boolean).join(' · ');
      return `
        <div class="history-entry">
          <div class="he-top">
            <span class="he-date">${DateUtils.formatEt(t.date)}</span>
            <button class="he-remove" data-id="${t.id}">Kustuta</button>
          </div>
          <div class="he-title">${this._esc(t.category)} — ${this.fmt(net)} €</div>
          ${tags ? `<div class="he-sub">${this._esc(tags)}</div>` : ''}
          ${t.note ? `<div class="he-sub">${this._esc(t.note)}</div>` : ''}
        </div>
      `;
    }).join('');
    el.querySelectorAll('.he-remove').forEach(btn => {
      btn.addEventListener('click', () => { this.removeTransaction(btn.dataset.id); this.renderAll(); });
    });
  },

  renderRecurringList() {
    const el = document.getElementById('finance-recurring-list');
    const all = this.getRecurring();
    if (!all.length) {
      el.innerHTML = '<p class="hint">Püsikulusid pole veel lisatud.</p>';
      return;
    }
    const total = all.reduce((sum, recurring) => sum + (Number(recurring.amount) || 0), 0);
    el.innerHTML = all.map(r => `
      <div class="history-entry">
        <div class="he-top">
          <span class="he-date">${this._esc(r.name)}</span>
          <button class="he-remove" data-id="${r.id}">Kustuta</button>
        </div>
        <div class="he-sub">${this.fmt(r.amount)} € · iga kuu ${r.dayOfMonth}. kuupäev</div>
      </div>
    `).join('') + `
      <div class="recurring-total-row" aria-label="Püsikulud kokku">
        <span>PÜSIKULUD KOKKU</span>
        <strong>${this.fmt(total)} € / KUU</strong>
      </div>
    `;
    el.querySelectorAll('.he-remove').forEach(btn => {
      btn.addEventListener('click', () => { this.removeRecurring(btn.dataset.id); this.renderAll(); });
    });
  },

  exportCsv() {
    const rows = [['Kuupäev', 'Kategooria', 'Summa', 'Eluvaldkond', 'Vajalikkus', 'Tagastus', 'Ülekanne', 'Jagatud summa', 'Märkus']];
    this.getTransactions().forEach(t => {
      rows.push([t.date, t.category, t.amount, t.lifeDomain || '', t.necessity || '', t.isRefund ? 'jah' : '', t.isTransfer ? 'jah' : '', t.sharedAmount || '', t.note || '']);
    });
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tehingud-${DateUtils.todayISO()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  },

  // --- Kuu kokkuvõte ---

  monthStats(monthKey) {
    const plan = this.getPlan(monthKey);
    const free = this.freeAmount(plan);
    const spent = this.spentInMonth(monthKey);
    const leftover = free - spent;
    const catTotals = this.categoryTotals(monthKey);
    const topCategories = Object.entries(catTotals).sort((a, b) => b[1] - a[1]).slice(0, 3);
    const goalContributions = this.getGoals().reduce((sum, g) => {
      return sum + (g.history || []).filter(h => this.monthKey(h.date) === monthKey).reduce((s, h) => s + h.amount, 0);
    }, 0);
    return { monthKey, plan, free, spent, leftover, topCategories, goalContributions };
  },

  buildMonthPromptText(stats) {
    const lines = [
      `Kuu ${stats.monthKey}.`,
      `Sissetulek ${stats.plan.income}€, vabalt kasutatav (pärast püsikulusid/investeeringuid/puhvrit) ${Math.round(stats.free)}€.`,
      `Kulutatud ${Math.round(stats.spent)}€, jäi üle ${Math.round(stats.leftover)}€.`,
    ];
    if (stats.topCategories.length) {
      lines.push('Suurimad kulukategooriad: ' + stats.topCategories.map(([c, v]) => `${c} ${Math.round(v)}€`).join(', ') + '.');
    }
    if (stats.goalContributions > 0) {
      lines.push(`Eesmärkidesse pandi kokku ${Math.round(stats.goalContributions)}€.`);
    }
    lines.push('');
    lines.push('Kirjuta lühike (3-4 lauset) toetav ja konstruktiivne kuukokkuvõte eesti keeles. Too välja üks positiivne trend ja vajadusel üks õrn soovitus järgmiseks kuuks. Väldi moraliseerimist ja süütunde tekitamist kulutuste pärast.');
    return lines.join('\n');
  },

  async callClaude(promptText) {
    const profile = Storage.getProfile();
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': profile.anthropicApiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({ model: 'claude-sonnet-5', max_tokens: 400, messages: [{ role: 'user', content: promptText }] }),
    });
    if (!res.ok) throw new Error(`API viga ${res.status}`);
    const data = await res.json();
    return (data.content || []).map(b => b.text || '').join('\n').trim() || null;
  },

  getMonthSummaries() {
    return Storage.get(Storage.KEYS.FINANCE_MONTH_SUMMARY, []);
  },

  saveMonthSummaries(list) {
    Storage.set(Storage.KEYS.FINANCE_MONTH_SUMMARY, list);
  },

  latestMonthSummary() {
    const all = this.getMonthSummaries();
    if (!all.length) return null;
    return all.slice().sort((a, b) => b.monthKey.localeCompare(a.monthKey))[0];
  },

  async generateMonthSummary(monthKey) {
    const profile = Storage.getProfile();
    const stats = this.monthStats(monthKey);
    const record = { monthKey, stats, aiSummary: null, aiError: null, generatedAt: new Date().toISOString() };
    if (profile.anthropicApiKey) {
      try {
        record.aiSummary = await this.callClaude(this.buildMonthPromptText(stats));
      } catch (e) {
        record.aiError = e.message;
      }
    }
    const all = this.getMonthSummaries().filter(s => s.monthKey !== monthKey);
    all.push(record);
    this.saveMonthSummaries(all);
    return record;
  },

  async maybeAutoGenerateMonthSummary() {
    const today = new Date();
    if (today.getDate() > 3) return;
    const prevMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const prevKey = `${prevMonth.getFullYear()}-${String(prevMonth.getMonth() + 1).padStart(2, '0')}`;
    if (this.getMonthSummaries().some(s => s.monthKey === prevKey)) return;
    if (!this.monthTransactions(prevKey).length) return;
    await this.generateMonthSummary(prevKey);
  },

  async handleGenerateMonthSummary() {
    const btn = document.getElementById('finance-month-generate-btn');
    if (btn) { btn.disabled = true; btn.textContent = 'Genereerin...'; }
    try {
      await this.generateMonthSummary(this.todayMonthKey());
      this.renderMonthSummary();
    } catch (e) {
      UI.toast('Ebaõnnestus: ' + e.message);
      if (btn) { btn.disabled = false; }
    }
  },

  renderMonthSummary() {
    const el = document.getElementById('finance-month-summary');
    const record = this.latestMonthSummary();
    const profile = Storage.getProfile();
    const manualBtn = `<button class="weekly-btn" id="finance-month-generate-btn">GENEREERI KUU KOKKUVÕTE →</button>`;

    if (!record) {
      el.innerHTML = `
        <div class="tile-label">KUU KOKKUVÕTE</div>
        <div class="weekly-headline">POLE VEEL KOKKUVÕTET.</div>
        <div class="weekly-stats-plain">Ilmub automaatselt kuu alguses eelmise kuu kohta, kui on tehinguid logitud.</div>
        ${manualBtn}
      `;
      document.getElementById('finance-month-generate-btn').addEventListener('click', () => this.handleGenerateMonthSummary());
      return;
    }

    const s = record.stats;
    const statLines = [
      `SISSETULEK — ${this.fmt(s.plan.income)} €`,
      `KULUTATUD — ${this.fmt(s.spent)} € (vaba oli ${this.fmt(s.free)} €)`,
      `JÄI ÜLE — ${this.fmt(s.leftover)} €`,
    ];
    if (s.topCategories.length) {
      statLines.push('SUURIMAD KULUD — ' + s.topCategories.map(([c, v]) => `${c} ${this.fmt(v)}€`).join(', '));
    }
    let aiBlock = '';
    if (record.aiSummary) aiBlock = `<div class="weekly-ai-plain">${this._esc(record.aiSummary)}</div>`;
    else if (record.aiError) aiBlock = `<div class="weekly-ai-plain">AI kokkuvõte ebaõnnestus (${this._esc(record.aiError)}).</div>`;
    else if (!profile.anthropicApiKey) aiBlock = `<div class="weekly-ai-plain">Lisa Anthropic API võti Seaded lehel AI-kommentaari jaoks.</div>`;

    el.innerHTML = `
      <div class="tile-label">KUU KOKKUVÕTE · ${record.monthKey}</div>
      <div class="weekly-headline">${s.leftover >= 0 ? 'JÄID PLUSSI.' : 'ÜLE EELARVE.'}</div>
      <div class="weekly-stats-plain">${statLines.join('<br>')}</div>
      ${aiBlock}
      ${manualBtn}
    `;
    document.getElementById('finance-month-generate-btn').addEventListener('click', () => this.handleGenerateMonthSummary());
  },

  // --- Vormid ---

  handlePlanSubmit(e) {
    e.preventDefault();
    const monthKey = document.getElementById('fp-month').value || this.todayMonthKey();
    const plan = {
      income: parseFloat(document.getElementById('fp-income').value) || 0,
      fixedCosts: parseFloat(document.getElementById('fp-fixed').value) || 0,
      invest: parseFloat(document.getElementById('fp-invest').value) || 0,
      extra: parseFloat(document.getElementById('fp-extra').value) || 0,
      buffer: parseFloat(document.getElementById('fp-buffer').value) || 0,
      paydayDay: parseInt(document.getElementById('fp-payday').value, 10) || 31,
    };
    this.savePlan(monthKey, plan);
    this.renderAll();
    UI.toast('Kuuplaan salvestatud');
  },

  handleTxSubmit(e) {
    e.preventDefault();
    const amount = parseFloat(document.getElementById('tx-amount').value);
    if (!amount) { UI.toast('Sisesta summa'); return; }
    const tx = {
      id: Fmt.uid(),
      date: document.getElementById('tx-date').value || DateUtils.todayISO(),
      amount,
      category: document.getElementById('tx-category').value,
      lifeDomain: document.getElementById('tx-domain').value,
      necessity: document.getElementById('tx-necessity').value,
      note: document.getElementById('tx-note').value.trim(),
      sharedAmount: parseFloat(document.getElementById('tx-shared').value) || 0,
      isRefund: document.getElementById('tx-refund').checked,
      isTransfer: document.getElementById('tx-transfer').checked,
    };
    this.addTransaction(tx);
    document.getElementById('finance-tx-form').reset();
    document.getElementById('tx-date').value = DateUtils.todayISO();
    this.renderAll();
    UI.toast('Kulu salvestatud');
  },

  handleRecurringSubmit(e) {
    e.preventDefault();
    const name = document.getElementById('rec-name').value.trim();
    const amount = parseFloat(document.getElementById('rec-amount').value);
    const dayOfMonth = parseInt(document.getElementById('rec-day').value, 10);
    if (!name || !amount || !dayOfMonth) { UI.toast('Täida kõik väljad'); return; }
    this.addRecurring({ id: Fmt.uid(), name, amount, dayOfMonth });
    document.getElementById('finance-recurring-form').reset();
    this.renderAll();
    UI.toast('Püsikulu lisatud');
  },

  handleGoalSubmit(e) {
    e.preventDefault();
    const name = document.getElementById('goal-name').value.trim();
    const targetAmount = parseFloat(document.getElementById('goal-target').value);
    const targetDate = document.getElementById('goal-date').value;
    const currentAmount = parseFloat(document.getElementById('goal-current').value) || 0;
    if (!name || !targetAmount) { UI.toast('Täida nimi ja sihtsumma'); return; }
    this.addGoal({ id: Fmt.uid(), name, targetAmount, targetDate, currentAmount, history: [{ date: DateUtils.todayISO(), amount: currentAmount }] });
    document.getElementById('finance-goal-form').reset();
    this.renderAll();
    UI.toast('Eesmärk lisatud');
  },

  loadPlanForm() {
    const monthKey = this.todayMonthKey();
    const plan = this.getPlan(monthKey);
    document.getElementById('fp-month').value = monthKey;
    document.getElementById('fp-income').value = plan.income || '';
    document.getElementById('fp-fixed').value = plan.fixedCosts || '';
    document.getElementById('fp-invest').value = plan.invest || '';
    document.getElementById('fp-extra').value = plan.extra || '';
    document.getElementById('fp-buffer').value = plan.buffer || '';
    document.getElementById('fp-payday').value = plan.paydayDay || 31;
  },

  _esc(s) {
    const d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
  },

  renderAll() {
    this.renderMonthTotal();
    this.renderStsHero();
    this.renderSecondary();
    this.renderUpcoming();
    this.renderGoals();
    this.renderTxHistory();
    this.renderRecurringList();
    this.renderMonthSummary();
    this.maybeAutoGenerateMonthSummary().then(() => this.renderMonthSummary());
  },

  init() {
    document.getElementById('tx-date').value = DateUtils.todayISO();
    this.loadPlanForm();
    document.getElementById('finance-plan-form').addEventListener('submit', (e) => this.handlePlanSubmit(e));
    document.getElementById('finance-tx-form').addEventListener('submit', (e) => this.handleTxSubmit(e));
    document.getElementById('finance-recurring-form').addEventListener('submit', (e) => this.handleRecurringSubmit(e));
    document.getElementById('finance-goal-form').addEventListener('submit', (e) => this.handleGoalSubmit(e));
    document.getElementById('finance-csv-btn').addEventListener('click', () => this.exportCsv());
    this.renderAll();
  },
};
