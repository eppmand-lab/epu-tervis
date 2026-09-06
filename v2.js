const V2 = {
  openMore() {
    document.getElementById('v2-more-sheet')?.classList.remove('hidden');
  },
  closeMore() {
    document.getElementById('v2-more-sheet')?.classList.add('hidden');
  },
  navigate(tab) {
    if (!tab) return;
    App.showTab(tab);
    this.closeMore();
    document.querySelectorAll('.v2-nav-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.v2Tab === tab || (tab === 'dashboard' && btn.dataset.v2Tab === 'dashboard'));
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  },
  init() {
    document.querySelectorAll('[data-v2-tab]').forEach(btn => btn.addEventListener('click', () => this.navigate(btn.dataset.v2Tab)));
    document.querySelectorAll('[data-nav-direct]').forEach(btn => btn.addEventListener('click', () => this.navigate(btn.dataset.navDirect)));
    document.getElementById('v2-more-btn')?.addEventListener('click', () => this.openMore());
    document.getElementById('v2-more-close')?.addEventListener('click', () => this.closeMore());
  }
};
document.addEventListener('DOMContentLoaded', () => V2.init());
