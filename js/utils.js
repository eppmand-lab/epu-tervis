const DateUtils = {
  todayISO() {
    return this.toISO(new Date());
  },
  toISO(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  },
  addDays(iso, days) {
    const d = new Date(iso + 'T00:00:00');
    d.setDate(d.getDate() + days);
    return this.toISO(d);
  },
  diffDays(isoA, isoB) {
    const a = new Date(isoA + 'T00:00:00');
    const b = new Date(isoB + 'T00:00:00');
    return Math.round((a - b) / 86400000);
  },
  lastNDays(n) {
    const today = this.todayISO();
    const days = [];
    for (let i = n - 1; i >= 0; i--) days.push(this.addDays(today, -i));
    return days;
  },
  formatEt(iso) {
    const [y, m, d] = iso.split('-');
    const months = ['jaan', 'veebr', 'märts', 'apr', 'mai', 'juuni', 'juuli', 'aug', 'sept', 'okt', 'nov', 'dets'];
    return `${parseInt(d, 10)}. ${months[parseInt(m, 10) - 1]}`;
  },
  weekdayShortEt(iso) {
    const names = ['P', 'E', 'T', 'K', 'N', 'R', 'L'];
    const d = new Date(iso + 'T00:00:00');
    return names[d.getDay()];
  },
  weekdayFullEt(iso) {
    const names = ['PÜHAPÄEV', 'ESMASPÄEV', 'TEISIPÄEV', 'KOLMAPÄEV', 'NELJAPÄEV', 'REEDE', 'LAUPÄEV'];
    const d = new Date(iso + 'T00:00:00');
    return names[d.getDay()];
  },
  isSunday(iso) {
    return new Date(iso + 'T00:00:00').getDay() === 0;
  },
  // Nädal algab esmaspäevast. Tagastab {start, end} (E...P) nädala kohta, mis sisaldab antud kuupäeva.
  weekBounds(iso) {
    const dow = new Date(iso + 'T00:00:00').getDay();
    const daysSinceMonday = dow === 0 ? 6 : dow - 1;
    const start = this.addDays(iso, -daysSinceMonday);
    const end = this.addDays(start, 6);
    return { start, end };
  },
  // ISO 8601 nädalanumber
  weekNumber(iso) {
    const d = new Date(iso + 'T00:00:00');
    d.setDate(d.getDate() + 4 - (d.getDay() || 7));
    const yearStart = new Date(d.getFullYear(), 0, 1);
    return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  },
  rangeDays(startIso, endIso) {
    const days = [];
    let d = startIso;
    while (d <= endIso) {
      days.push(d);
      d = this.addDays(d, 1);
    }
    return days;
  },
};

const Fmt = {
  round1(n) {
    return Math.round(n * 10) / 10;
  },
  int(n) {
    return Math.round(n);
  },
  uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  },
};

// Rakenduse (personaalne) makrotoitainete arvestus per gramm toorainest,
// kasutades Open Food Facts "nutriments per 100g" väärtusi.
const NutriMath = {
  scale(per100, grams) {
    return (per100 || 0) * (grams / 100);
  },
};
