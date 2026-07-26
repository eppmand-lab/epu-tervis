const CloudSync = {
  URL: 'https://tmhoxiyhihsveokagdzx.supabase.co',
  KEY: 'sb_publishable_Q39wb2IDL8KGtI5c4Ck8zA_88zESYpJ',
  OWNER_EMAIL: 'epp.mand@gmail.com',
  MARKER: 'epp35_cloud_initialized',
  PHOTO_BUCKET: 'epp-photos',
  ready: false,
  applyingRemote: false,
  client: null,
  user: null,
  timer: null,
  syncing: false,

  async init() {
    if (!window.supabase?.createClient) {
      this.showAuth('Pilveühendust ei saanud laadida. Kontrolli internetiühendust ja värskenda lehte.');
      return false;
    }

    this.client = window.supabase.createClient(this.URL, this.KEY, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    });
    this.bindAuthForm();

    const { data, error } = await this.client.auth.getSession();
    if (error) console.error('Session error', error);
    const session = data?.session || null;
    if (!session) {
      this.showAuth();
      this.watchAuth();
      return false;
    }
    return this.activate(session.user);
  },

  watchAuth() {
    this.client.auth.onAuthStateChange((_event, session) => {
      if (session?.user && !this.ready) {
        window.setTimeout(async () => {
          const ok = await this.activate(session.user);
          if (ok && !window.__eppAppStarted) {
            window.__eppAppStarted = true;
            App.init();
          }
        }, 0);
      }
    });
  },

  bindAuthForm() {
    const form = document.getElementById('auth-form');
    const input = document.getElementById('auth-email');
    input.value = this.OWNER_EMAIL;
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const email = input.value.trim().toLowerCase();
      if (email !== this.OWNER_EMAIL) {
        this.showAuth('Selle e-postiga ei ole ligipääs lubatud.');
        return;
      }
      const button = document.getElementById('auth-submit');
      button.disabled = true;
      button.textContent = 'SAADAN…';
      const redirectTo = `${location.origin}${location.pathname}`;
      const { error } = await this.client.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: redirectTo, shouldCreateUser: true },
      });
      button.disabled = false;
      button.textContent = 'SAADA SISSELOGIMISLINK';
      this.showAuth(error
        ? `Sisselogimislinki ei saanud saata: ${error.message}`
        : 'Link saadetud. Ava see samas seadmes oma e-postist — pärast esimest korda jääd sisse logituks.');
    });
  },

  async activate(user) {
    if ((user.email || '').toLowerCase() !== this.OWNER_EMAIL) {
      await this.client.auth.signOut();
      this.showAuth('Selle kasutajaga ei ole ligipääs lubatud.');
      return false;
    }
    this.user = user;
    try {
      await this.initialSync();
    } catch (error) {
      console.error('Initial sync failed', error);
      this.showAuth(`Pilveühendus ei ole veel valmis: ${error.message}`);
      return false;
    }
    this.ready = true;
    document.getElementById('auth-screen').classList.add('hidden');
    document.getElementById('app-shell').classList.remove('auth-pending');
    this.updateStatus('Kõik andmed on sünkroniseeritud');
    this.watchAuth();
    return true;
  },

  showAuth(message) {
    document.getElementById('auth-screen').classList.remove('hidden');
    document.getElementById('app-shell').classList.add('auth-pending');
    if (message) document.getElementById('auth-message').textContent = message;
  },

  updateStatus(message) {
    const account = document.getElementById('sync-account');
    const status = document.getElementById('sync-status');
    if (account) account.textContent = this.user?.email || 'Pole sisse logitud';
    if (status) status.textContent = message;
  },

  localState() {
    const data = {};
    Object.entries(Storage.KEYS).forEach(([name, key]) => {
      const value = Storage.get(key, null);
      if (name === 'PROFILE' && value) {
        const safeProfile = { ...value };
        delete safeProfile.anthropicApiKey;
        data[key] = safeProfile;
      } else if (name === 'PHOTOS') {
        data[key] = (value || []).map(({ image, ...photo }) => photo);
      } else {
        data[key] = value;
      }
    });
    return data;
  },

  hasLocalData() {
    return Object.values(Storage.KEYS).some(key => key !== Storage.KEYS.PROFILE && localStorage.getItem(key) !== null);
  },

  async initialSync() {
    const { data: remote, error } = await this.client
      .from('app_state')
      .select('data, revision')
      .eq('user_id', this.user.id)
      .maybeSingle();
    if (error) throw error;

    const initialized = localStorage.getItem(this.MARKER) === this.user.id;
    if (!remote) {
      await this.syncPhotos();
      await this.uploadState();
    } else if (!initialized || !this.hasLocalData()) {
      await this.applyRemote(remote.data || {});
    } else {
      await this.syncPhotos();
      await this.uploadState();
    }
    localStorage.setItem(this.MARKER, this.user.id);
  },

  async applyRemote(data) {
    this.applyingRemote = true;
    try {
      for (const key of Object.values(Storage.KEYS)) {
        if (!(key in data)) continue;
        if (key === Storage.KEYS.PROFILE) {
          const localProfile = Storage.getProfile();
          const merged = { ...data[key], anthropicApiKey: localProfile.anthropicApiKey || '' };
          localStorage.setItem(key, JSON.stringify(merged));
        } else if (key === Storage.KEYS.PHOTOS) {
          const hydrated = [];
          for (const photo of (data[key] || [])) {
            if (!photo.storagePath) continue;
            const { data: blob, error } = await this.client.storage.from(this.PHOTO_BUCKET).download(photo.storagePath);
            if (error) {
              console.warn('Photo download failed', photo.storagePath, error);
              continue;
            }
            hydrated.push({ ...photo, image: await this.blobToDataUrl(blob) });
          }
          localStorage.setItem(key, JSON.stringify(hydrated));
        } else {
          localStorage.setItem(key, JSON.stringify(data[key]));
        }
      }
    } finally {
      this.applyingRemote = false;
    }
  },

  queue(photosChanged = false) {
    clearTimeout(this.timer);
    this.updateStatus('Muudatus ootab sünkroniseerimist…');
    this.timer = window.setTimeout(() => this.syncNow(false, photosChanged), photosChanged ? 900 : 500);
  },

  async syncNow(showToast = false, photosChanged = true) {
    if (!this.ready || this.syncing || !navigator.onLine) {
      if (!navigator.onLine) this.updateStatus('Võrguühenduseta — muudatused jäävad seadmesse ootele');
      return;
    }
    this.syncing = true;
    this.updateStatus('Sünkroniseerin…');
    try {
      if (photosChanged) await this.syncPhotos();
      await this.uploadState();
      this.updateStatus(`Sünkroniseeritud ${new Date().toLocaleTimeString('et-EE', { hour: '2-digit', minute: '2-digit' })}`);
      if (showToast) UI.toast('Pilvesünkroniseerimine valmis');
    } catch (error) {
      console.error('Cloud sync failed', error);
      this.updateStatus('Sünkroniseerimine ebaõnnestus — proovin järgmise muudatusega uuesti');
      if (showToast) UI.toast(`Sünkroniseerimine ebaõnnestus: ${error.message}`);
    } finally {
      this.syncing = false;
    }
  },

  async uploadState() {
    const payload = {
      user_id: this.user.id,
      data: this.localState(),
      revision: Date.now(),
    };
    const { error } = await this.client.from('app_state').upsert(payload, { onConflict: 'user_id' });
    if (error) throw error;
  },

  async syncPhotos() {
    const photos = Storage.get(Storage.KEYS.PHOTOS, []);
    let changed = false;
    for (const photo of photos) {
      if (!photo.storagePath) {
        photo.storagePath = `${this.user.id}/${photo.id}.jpg`;
        changed = true;
      }
      if (photo.image?.startsWith('data:')) {
        const blob = await (await fetch(photo.image)).blob();
        const { error } = await this.client.storage
          .from(this.PHOTO_BUCKET)
          .upload(photo.storagePath, blob, { contentType: 'image/jpeg', upsert: true });
        if (error) throw error;
      }
    }
    if (changed) localStorage.setItem(Storage.KEYS.PHOTOS, JSON.stringify(photos));
  },

  blobToDataUrl(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  },

  async signOut() {
    await this.client.auth.signOut();
    this.ready = false;
    this.user = null;
    localStorage.removeItem(this.MARKER);
    location.reload();
  },
};
