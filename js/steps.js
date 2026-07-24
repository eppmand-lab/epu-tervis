const Steps = {
  getData() {
    return Storage.get(Storage.KEYS.STEPS, {});
  },

  save(iso, count) {
    const data = this.getData();
    data[iso] = count;
    Storage.set(Storage.KEYS.STEPS, data);
  },

  getAmount(iso) {
    return this.getData()[iso] || 0;
  },
};
