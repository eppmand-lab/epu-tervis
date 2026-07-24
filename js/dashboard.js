const Dashboard = {
  renderGreeting() {
    document.getElementById('dashboard-date').textContent =
      new Date().toLocaleDateString('et-EE', { weekday: 'long', day: 'numeric', month: 'long' });
  },

  tile(label, value, sub) {
    return `
      <div class="dash-tile">
        <div class="dash-tile-label">${label}</div>
        <div class="dash-tile-value">${value}</div>
        ${sub ? `<div class="dash-tile-sub">${sub}</div>` : ''}
      </div>
    `;
  },

  stepsTile(iso) {
    const amount = Steps.getAmount(iso);
    return `
      <div class="dash-tile">
        <div class="dash-tile-label">Sammud täna</div>
        <input type="number" id="dash-steps-input" class="dash-steps-input" value="${amount || ''}" placeholder="0">
      </div>
    `;
  },

  render() {
    this.renderGreeting();
    const iso = DateUtils.todayISO();
    const profile = Storage.getProfile();

    const totals = Nutrition.dayTotals(iso);
    const kcalTile = this.tile('Kalorid täna', `${Fmt.int(totals.kcal)} / ${profile.macros.kcal}`, `V ${Fmt.int(totals.protein)}g · R ${Fmt.int(totals.fat)}g · SV ${Fmt.int(totals.carbs)}g`);

    const waterAmount = Water.getAmount(iso);
    const waterTile = this.tile('Vesi', `${waterAmount} ml`, `eesmärk ${profile.waterTarget} ml`);

    const latestM = Measurements.latest();
    const weightTile = this.tile('Viimane kaal', latestM && latestM.weight ? `${latestM.weight} kg` : '—', latestM ? DateUtils.formatEt(latestM.date) : 'Pole veel mõõdetud');

    const cycleStatus = Cycle.computeStatus(iso);
    const cycleTile = cycleStatus
      ? this.tile('Tsükkel', Cycle.PHASES[cycleStatus.phase].label, `Päev ${cycleStatus.currentDay} / ${cycleStatus.cycleLength}`)
      : this.tile('Tsükkel', '—', 'Lisa alguskuupäev');

    const workouts = Workouts.getAll();
    const lastWorkout = workouts.slice().sort((a, b) => b.date.localeCompare(a.date))[0];
    const workoutTile = this.tile('Viimane treening', lastWorkout ? lastWorkout.type : '—', lastWorkout ? DateUtils.formatEt(lastWorkout.date) : 'Pole veel logitud');

    document.getElementById('dashboard-cards').innerHTML =
      kcalTile + waterTile + this.stepsTile(iso) + weightTile + cycleTile + workoutTile;

    const stepsInput = document.getElementById('dash-steps-input');
    stepsInput.addEventListener('change', () => {
      const val = parseInt(stepsInput.value, 10) || 0;
      Steps.save(iso, val);
      UI.toast('Sammud salvestatud');
    });

    WeeklyAnalysis.renderCard();
    WeeklyAnalysis.maybeAutoGenerate().then(() => WeeklyAnalysis.renderCard());
  },

  init() {
    this.render();
  },
};
