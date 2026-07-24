const Cycle = {
  PHASES: {
    menstrual: { label: 'Menstruatsioon', color: '#D6798A' },
    follicular: { label: 'Follikulaarne faas', color: '#8BAF8A' },
    ovulation: { label: 'Ovulatsioon', color: '#D68A1F' },
    luteal: { label: 'Luteaalne faas', color: '#3E7CB1' },
  },

  ADVICE: {
    menstrual: {
      training: ['Kerge liikumine — jalutuskäigud, jooga, venitus', 'Kuula keha, puhkus on osa treeningust', 'Väldi väga intensiivseid treeninguid, kui energiat napib'],
      nutrition: ['Rauarikkad toidud (spinat, punane liha, läätsed) verekaotuse kompenseerimiseks', 'Sooja ja lohutavat toitu, kerge on süüa rohkem süsivesikuid', 'Magneesium võib aidata krampide vastu (pähklid, tume šokolaad)'],
    },
    follicular: {
      training: ['Energia tõuseb — hea aeg jõutreeninguks ja intensiivsemateks treeninguteks', 'Proovi uusi harjutusi või tõsta koormust', 'Hea taastumisvõime, saab treenida tihedamini'],
      nutrition: ['Piisavalt valku lihasmassi toetamiseks', 'Värsked köögiviljad ja kergesti seeditav toit', 'Energia on kõrge — hea aeg jälgida makrosid täpselt'],
    },
    ovulation: {
      training: ['Tipp-energia ja jõud — hea aeg rekordikatseteks ja rasketele treeningutele', 'Koordinatsioon ja jõudlus tavaliselt parimad', 'Soojenda korralikult, liigesed võivad olla veidi lõdvemad'],
      nutrition: ['Toeta keha antioksüdantiderikka toiduga (marjad, roheline lehtköögivili)', 'Piisavalt vett — ainevahetus veidi kiirem', 'Jätka tavapärast makrode jälgimist'],
    },
    luteal: {
      training: ['Energia võib langeda — mõõdukas kardio ja jõutreening, vajadusel deload', 'Kuula keha, PMS võib mõjutada jõudlust', 'Unele ja taastumisele rohkem tähelepanu'],
      nutrition: ['Ainevahetus veidi kiirem — kerge lisakalorite vajadus on normaalne', 'Kompleksed süsivesikud aitavad tuju ja isu kontrolli all hoida', 'B6-vitamiin ja magneesium võivad leevendada PMS-i (pähklid, banaanid, täisteratooted)'],
    },
  },

  getData() {
    const data = Storage.get(Storage.KEYS.CYCLE, null);
    if (!data) {
      const profile = Storage.getProfile();
      const def = { cycleLength: profile.cycleLength || 28, periodStarts: [] };
      Storage.set(Storage.KEYS.CYCLE, def);
      return def;
    }
    return data;
  },

  save(data) {
    Storage.set(Storage.KEYS.CYCLE, data);
  },

  addPeriodStart(date, cycleLength) {
    const data = this.getData();
    if (!data.periodStarts.includes(date)) {
      data.periodStarts.push(date);
      data.periodStarts.sort();
    }
    if (cycleLength) data.cycleLength = cycleLength;
    this.save(data);
  },

  removePeriodStart(date) {
    const data = this.getData();
    data.periodStarts = data.periodStarts.filter(d => d !== date);
    this.save(data);
  },

  lastStartOnOrBefore(iso) {
    const data = this.getData();
    const past = data.periodStarts.filter(d => d <= iso).sort();
    return past.length ? past[past.length - 1] : null;
  },

  computeStatus(iso) {
    const data = this.getData();
    const cycleLength = data.cycleLength || 28;
    const lastStart = this.lastStartOnOrBefore(iso);
    if (!lastStart) return null;
    const daysSince = DateUtils.diffDays(iso, lastStart);
    const currentDay = daysSince + 1;
    const ovulationDay = Math.max(cycleLength - 14, 10);
    const menstrualEnd = Math.min(5, ovulationDay - 2);

    let phase;
    if (currentDay <= menstrualEnd) phase = 'menstrual';
    else if (currentDay < ovulationDay) phase = 'follicular';
    else if (currentDay <= ovulationDay + 1) phase = 'ovulation';
    else phase = 'luteal';

    const nextPeriodIn = cycleLength - currentDay + 1;
    return { currentDay, cycleLength, phase, nextPeriodIn, lastStart };
  },

  renderStatus() {
    const el = document.getElementById('cycle-status');
    const status = this.computeStatus(DateUtils.todayISO());
    if (!status) {
      el.innerHTML = '<p class="hint">Lisa menstruatsiooni alguskuupäev, et näha oma tsükli faasi ja soovitusi.</p>';
      return;
    }
    const phaseInfo = this.PHASES[status.phase];
    const advice = this.ADVICE[status.phase];
    const nextText = status.nextPeriodIn > 0
      ? `Järgmine menstruatsioon eeldatavasti ${status.nextPeriodIn} päeva pärast`
      : `Menstruatsioon võib olla hilinenud (${Math.abs(status.nextPeriodIn) + 1} päeva üle oodatud)`;
    el.innerHTML = `
      <span class="cycle-phase-badge" style="background:${phaseInfo.color}">${phaseInfo.label}</span>
      <p><strong>Tsükli päev ${status.currentDay}</strong> / ${status.cycleLength} · ${nextText}</p>
      <div class="cycle-advice">
        <strong>Treening:</strong>
        <ul>${advice.training.map(t => `<li>${t}</li>`).join('')}</ul>
        <strong>Toitumine:</strong>
        <ul>${advice.nutrition.map(t => `<li>${t}</li>`).join('')}</ul>
      </div>
    `;
  },

  renderHistory() {
    const data = this.getData();
    const el = document.getElementById('cycle-history');
    if (!data.periodStarts.length) {
      el.innerHTML = '<p class="hint">Ajalugu puudub.</p>';
      return;
    }
    const sorted = data.periodStarts.slice().sort().reverse();
    el.innerHTML = sorted.map(d => `
      <div class="history-entry">
        <div class="he-top">
          <span class="he-date">${DateUtils.formatEt(d)}</span>
          <button class="he-remove" data-date="${d}">Kustuta</button>
        </div>
      </div>
    `).join('');
    el.querySelectorAll('.he-remove').forEach(btn => {
      btn.addEventListener('click', () => {
        this.removePeriodStart(btn.dataset.date);
        this.renderAll();
      });
    });
  },

  renderAll() {
    this.renderStatus();
    this.renderHistory();
  },

  handleSubmit(e) {
    e.preventDefault();
    const date = document.getElementById('cycle-date').value;
    const length = parseInt(document.getElementById('cycle-length').value, 10) || null;
    if (!date) { UI.toast('Vali kuupäev'); return; }
    this.addPeriodStart(date, length);
    document.getElementById('cycle-form').reset();
    document.getElementById('cycle-date').value = DateUtils.todayISO();
    this.renderAll();
    UI.toast('Salvestatud');
  },

  init() {
    const data = this.getData();
    document.getElementById('cycle-date').value = DateUtils.todayISO();
    document.getElementById('cycle-length').value = data.cycleLength || 28;
    document.getElementById('cycle-form').addEventListener('submit', (e) => this.handleSubmit(e));
    this.renderAll();
  },
};
