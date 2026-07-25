const WeeklyAnalysis = {
  getAll() {
    return Storage.get(Storage.KEYS.WEEKLY, []);
  },

  save(list) {
    Storage.set(Storage.KEYS.WEEKLY, list);
  },

  latest() {
    const all = this.getAll();
    if (!all.length) return null;
    return all.slice().sort((a, b) => b.end.localeCompare(a.end))[0];
  },

  findByEnd(endIso) {
    return this.getAll().find(r => r.end === endIso) || null;
  },

  upsert(record) {
    const all = this.getAll().filter(r => r.end !== record.end);
    all.push(record);
    this.save(all);
  },

  computeStats(startIso, endIso) {
    const days = DateUtils.rangeDays(startIso, endIso);

    let kcalSum = 0, proteinSum = 0, fatSum = 0, carbsSum = 0, loggedFoodDays = 0;
    days.forEach(d => {
      const t = Nutrition.dayTotals(d);
      if (t.kcal > 0) {
        loggedFoodDays++;
        kcalSum += t.kcal; proteinSum += t.protein; fatSum += t.fat; carbsSum += t.carbs;
      }
    });

    const workouts = Workouts.getAll().filter(w => w.date >= startIso && w.date <= endIso);
    const totalDuration = workouts.reduce((s, w) => s + (w.duration || 0), 0);

    let waterSum = 0;
    days.forEach(d => { waterSum += Water.getAmount(d); });

    let stepsSum = 0, loggedStepDays = 0;
    days.forEach(d => {
      const s = Steps.getAmount(d);
      if (s > 0) { stepsSum += s; loggedStepDays++; }
    });

    const measurements = Measurements.getAll();
    const before = m => m.date <= endIso && m.weight !== null && m.weight !== undefined;
    const weighted = measurements.filter(before).sort((a, b) => a.date.localeCompare(b.date));
    const startWeight = weighted.filter(m => m.date <= startIso).slice(-1)[0]?.weight ?? null;
    const endWeight = weighted.slice(-1)[0]?.weight ?? null;
    const weightDelta = (startWeight !== null && endWeight !== null) ? Fmt.round1(endWeight - startWeight) : null;

    const cycleStatus = Cycle.computeStatus(endIso);

    return {
      days: days.length,
      loggedFoodDays,
      avgKcal: loggedFoodDays ? Math.round(kcalSum / loggedFoodDays) : 0,
      avgProtein: loggedFoodDays ? Fmt.round1(proteinSum / loggedFoodDays) : 0,
      avgFat: loggedFoodDays ? Fmt.round1(fatSum / loggedFoodDays) : 0,
      avgCarbs: loggedFoodDays ? Fmt.round1(carbsSum / loggedFoodDays) : 0,
      workoutCount: workouts.length,
      workoutTypes: workouts.map(w => w.type),
      workoutDuration: totalDuration,
      avgWater: Math.round(waterSum / days.length),
      loggedStepDays,
      avgSteps: loggedStepDays ? Math.round(stepsSum / loggedStepDays) : 0,
      totalSteps: stepsSum,
      startWeight, endWeight, weightDelta,
      cyclePhase: cycleStatus ? Cycle.PHASES[cycleStatus.phase].label : null,
    };
  },

  buildPromptText(stats, profile, startIso, endIso) {
    const lines = [
      `Nädal ${DateUtils.formatEt(startIso)} - ${DateUtils.formatEt(endIso)}.`,
      `Toitumine: keskmiselt ${stats.avgKcal} kcal/päev (eesmärk ${profile.macros.kcal} kcal), valk ${stats.avgProtein}g (eesmärk ${profile.macros.protein}g), rasv ${stats.avgFat}g (eesmärk ${profile.macros.fat}g), süsivesikud ${stats.avgCarbs}g (eesmärk ${profile.macros.carbs}g). Toitumist logitud ${stats.loggedFoodDays}/${stats.days} päeval.`,
      `Treening: ${stats.workoutCount} treeningut kokku ${stats.workoutDuration} minutit${stats.workoutTypes.length ? ' (' + stats.workoutTypes.join(', ') + ')' : ''}.`,
      `Vesi: keskmiselt ${stats.avgWater} ml/päev.`,
      `Sammud: keskmiselt ${stats.avgSteps} sammu/päev (logitud ${stats.loggedStepDays}/${stats.days} päeval).`,
    ];
    if (stats.weightDelta !== null) {
      lines.push(`Kaal: ${stats.startWeight}kg -> ${stats.endWeight}kg (muutus ${stats.weightDelta > 0 ? '+' : ''}${stats.weightDelta}kg).`);
    }
    if (stats.cyclePhase) {
      lines.push(`Praegune tsükli faas: ${stats.cyclePhase}.`);
    }
    lines.push('');
    lines.push('Kirjuta lühike (3-5 lauset), toetav ja konstruktiivne nädala kokkuvõte eesti keeles. Too välja üks positiivne trend ja vajadusel üks õrn soovitus järgmiseks nädalaks. Väldi kaalu või kehakuju hindavaid kommentaare ja moraliseerimist. Kui andmeid on vähe logitud, mainib seda kergelt ja julgusta rohkem logima, mitte ei tee suuri järeldusi.');
    return lines.join('\n');
  },

  async callClaude(stats, profile, startIso, endIso) {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': profile.anthropicApiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-5',
        max_tokens: 400,
        messages: [{ role: 'user', content: this.buildPromptText(stats, profile, startIso, endIso) }],
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`API viga ${res.status}: ${body.slice(0, 200)}`);
    }
    const data = await res.json();
    return (data.content || []).map(b => b.text || '').join('\n').trim() || null;
  },

  async generate(startIso, endIso) {
    const profile = Storage.getProfile();
    const stats = this.computeStats(startIso, endIso);
    const record = { start: startIso, end: endIso, stats, aiSummary: null, aiError: null, generatedAt: new Date().toISOString() };
    if (profile.anthropicApiKey) {
      try {
        record.aiSummary = await this.callClaude(stats, profile, startIso, endIso);
      } catch (e) {
        console.error(e);
        record.aiError = e.message;
      }
    }
    this.upsert(record);
    return record;
  },

  async maybeAutoGenerate() {
    const today = DateUtils.todayISO();
    if (!DateUtils.isSunday(today)) return;
    if (this.findByEnd(today)) return;
    const { start } = DateUtils.weekBounds(today);
    await this.generate(start, today);
  },

  async handleManualGenerate() {
    const btn = document.getElementById('weekly-generate-btn');
    if (btn) { btn.disabled = true; btn.textContent = 'Genereerin...'; }
    const today = DateUtils.todayISO();
    const { start } = DateUtils.weekBounds(today);
    try {
      await this.generate(start, today);
      this.renderCard();
    } catch (e) {
      UI.toast('Kokkuvõtte tegemine ebaõnnestus: ' + e.message);
      if (btn) { btn.disabled = false; btn.textContent = 'Genereeri kokkuvõte nüüd'; }
    }
  },

  buildInsights(stats, profile) {
    const insights = [];
    const foodCoverage = Math.round((stats.loggedFoodDays / stats.days) * 100);
    const stepCoverage = Math.round((stats.loggedStepDays / stats.days) * 100);
    if (stats.workoutCount >= 3) {
      insights.push({ tone: 'good', label: 'TUGEV NÄDAL', text: `${stats.workoutCount} treeningut ja ${stats.workoutDuration} minutit liikumist.` });
    } else if (stats.workoutCount > 0) {
      insights.push({ tone: 'neutral', label: 'HOIA RÜTMI', text: `${stats.workoutCount} treening${stats.workoutCount === 1 ? '' : 'ut'} tehtud — järgmine väike samm on järjepidevus.` });
    } else {
      insights.push({ tone: 'attention', label: 'UUS ALGUS', text: 'Treeninguid pole veel logitud. Planeeri järgmine liikumine ette.' });
    }

    if (stats.loggedFoodDays) {
      const proteinPct = profile.macros.protein ? Math.round((stats.avgProtein / profile.macros.protein) * 100) : 0;
      insights.push({
        tone: proteinPct >= 90 ? 'good' : 'neutral',
        label: 'VALGU SIHT',
        text: `${stats.avgProtein} g päevas ehk ${proteinPct}% eesmärgist.`,
      });
    }

    const weakestCoverage = Math.min(foodCoverage, stepCoverage);
    if (weakestCoverage < 70) {
      insights.push({ tone: 'attention', label: 'ANDMETE KVALITEET', text: `Toitumine ${foodCoverage}% ja sammud ${stepCoverage}% nädalast logitud — rohkem kirjeid annab täpsema pildi.` });
    } else {
      insights.push({ tone: 'good', label: 'HEA ÜLEVAADE', text: `Toitumine ${foodCoverage}% ja sammud ${stepCoverage}% nädalast logitud.` });
    }
    return insights.slice(0, 3);
  },

  renderCard() {
    const el = document.getElementById('weekly-analysis-card');
    const record = this.latest();
    const profile = Storage.getProfile();

    if (!record) {
      el.innerHTML = `
        <div class="weekly-poster">
          <div class="tile-label">NÄDALA RAPORT</div>
          <div class="weekly-headline">POLE VEEL RAPORTIT.</div>
          <div class="weekly-stats-plain">Logi midagi — või anna endale juba praegu aus versioon.</div>
          <button class="weekly-btn" id="weekly-generate-btn">ANNA RAPORT →</button>
        </div>
      `;
      document.getElementById('weekly-generate-btn').addEventListener('click', () => this.handleManualGenerate());
      return;
    }

    const s = record.stats;
    const noData = s.loggedFoodDays === 0 && s.workoutCount === 0;
    const headline = noData ? 'POLE ANDMEID. POLE ILLUSIOONE.' : 'RAPORT ON VALMIS.';

    const statLines = [
      `KALORID — ${s.avgKcal} / ${profile.macros.kcal} KCAL KESKMISELT · LOGITUD ${s.loggedFoodDays}/${s.days} PÄEVAL`,
      `MAKROD — V ${s.avgProtein}/${profile.macros.protein}G · R ${s.avgFat}/${profile.macros.fat}G · SV ${s.avgCarbs}/${profile.macros.carbs}G`,
      `TRENN — ${s.workoutCount}x, ${s.workoutDuration} MIN KOKKU`,
      `VESI — ${s.avgWater} ML/PÄEV KESKMISELT`,
      `SAMMUD — ${s.avgSteps}/PÄEV · LOGITUD ${s.loggedStepDays}/${s.days} PÄEVAL`,
    ];
    if (s.weightDelta !== null) {
      statLines.push(`KAAL — ${s.startWeight}KG → ${s.endWeight}KG (${s.weightDelta > 0 ? '+' : ''}${s.weightDelta}KG)`);
    }

    let aiBlock = '';
    if (record.aiSummary) {
      aiBlock = `<div class="weekly-ai-plain">${this._esc(record.aiSummary)}</div>`;
    } else if (record.aiError) {
      aiBlock = `<div class="weekly-ai-plain">AI kokkuvõtet ei õnnestunud saada (${this._esc(record.aiError)}).</div>`;
    } else if (!profile.anthropicApiKey) {
      aiBlock = `<div class="weekly-ai-plain">Lisa Anthropic API võti Seaded lehel, et saada ka AI-kommentaar.</div>`;
    }
    const insights = this.buildInsights(s, profile);
    const insightBlock = `
      <div class="weekly-insights">
        ${insights.map(item => `
          <div class="weekly-insight ${item.tone}">
            <span>${item.label}</span>
            <p>${this._esc(item.text)}</p>
          </div>
        `).join('')}
      </div>
    `;

    el.innerHTML = `
      <div class="weekly-poster">
        <div class="tile-label">NÄDALA RAPORT · ${DateUtils.formatEt(record.start).toUpperCase()} – ${DateUtils.formatEt(record.end).toUpperCase()}</div>
        <div class="weekly-headline">${headline}</div>
        <div class="weekly-stats-plain">${statLines.join('<br>')}</div>
        ${insightBlock}
        ${aiBlock}
        <button class="weekly-btn" id="weekly-generate-btn">UUENDA RAPORT →</button>
      </div>
    `;
    document.getElementById('weekly-generate-btn').addEventListener('click', () => this.handleManualGenerate());
  },

  _esc(s) {
    const d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
  },
};
