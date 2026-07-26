const Photos = {
  MAX_DIM: 720,
  JPEG_QUALITY: 0.64,
  ANGLES: [
    { key: 'front', label: 'Eestvaade' },
    { key: 'side', label: 'Külgvaade' },
    { key: 'back', label: 'Tagantvaade' },
  ],

  getAll() {
    return Storage.get(Storage.KEYS.PHOTOS, []);
  },

  save(list) {
    return Storage.set(Storage.KEYS.PHOTOS, list);
  },

  add(entry) {
    const all = this.getAll();
    all.push(entry);
    all.sort((a, b) => a.date.localeCompare(b.date));
    return this.save(all);
  },

  remove(id) {
    this.save(this.getAll().filter(p => p.id !== id));
  },

  update(id, patch) {
    const all = this.getAll();
    const idx = all.findIndex(p => p.id === id);
    if (idx === -1) return;
    all[idx] = Object.assign(all[idx], patch);
    this.save(all);
  },

  angleLabel(key) {
    return this.ANGLES.find(angle => angle.key === key)?.label || 'Foto';
  },

  changeAngle(id, angle) {
    const all = this.getAll();
    const photo = all.find(item => item.id === id);
    if (!photo) return;
    const duplicate = all.some(item => item.id !== id && item.date === photo.date && item.angle === angle);
    if (duplicate) {
      UI.toast(`${this.angleLabel(angle)} on sellel kuupäeval juba olemas`);
      this.renderAll();
      return;
    }
    photo.angle = angle;
    this.save(all);
    this.renderAll();
  },

  migrateAngles() {
    const all = this.getAll();
    let changed = false;
    const grouped = all.reduce((groups, photo) => {
      if (!groups[photo.date]) groups[photo.date] = [];
      groups[photo.date].push(photo);
      return groups;
    }, {});
    Object.values(grouped).forEach(photos => {
      const used = new Set(photos.map(photo => photo.angle).filter(Boolean));
      const available = this.ANGLES.map(angle => angle.key).filter(key => !used.has(key));
      photos.forEach(photo => {
        if (!photo.angle) {
          photo.angle = available.shift() || 'front';
          changed = true;
        }
      });
    });
    if (changed) this.save(all);
  },

  // Resize + JPEG-tihenda, et localStorage'i maht püsiks mõistlik.
  async normalizeImage(file) {
    const isHeic = /image\/hei[cf]/i.test(file.type) || /\.hei[cf]$/i.test(file.name);
    if (!isHeic) return file;
    if (typeof HeicTo !== 'function') {
      throw new Error('HEIC_TUGI_PUUDUB');
    }
    return HeicTo({ blob: file, type: 'image/jpeg', quality: 0.86 });
  },

  async resizeImage(file) {
    const imageFile = await this.normalizeImage(file);
    return new Promise((resolve, reject) => {
      const img = new Image();
      const reader = new FileReader();
      reader.onload = () => { img.src = reader.result; };
      reader.onerror = reject;
      img.onload = () => {
        let { width, height } = img;
        if (width > this.MAX_DIM || height > this.MAX_DIM) {
          if (width >= height) {
            height = Math.round(height * (this.MAX_DIM / width));
            width = this.MAX_DIM;
          } else {
            width = Math.round(width * (this.MAX_DIM / height));
            height = this.MAX_DIM;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        canvas.getContext('2d').drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', this.JPEG_QUALITY));
      };
      img.onerror = () => reject(new Error('PILTI_EI_SAA_AVADA'));
      reader.readAsDataURL(imageFile);
    });
  },

  async handleAdd() {
    const note = document.getElementById('photo-note').value.trim();
    const date = document.getElementById('photo-date').value || DateUtils.todayISO();
    const selected = this.ANGLES.map(angle => ({
      ...angle,
      input: document.getElementById(`photo-input-${angle.key}`),
    })).filter(item => item.input.files?.[0]);
    if (!selected.length) { UI.toast('Vali kõigepealt vähemalt üks foto'); return; }
    const existingAngles = new Set(this.getAll().filter(photo => photo.date === date).map(photo => photo.angle));
    const duplicate = selected.find(item => existingAngles.has(item.key));
    if (duplicate) {
      UI.toast(`${DateUtils.formatEt(date)} ${duplicate.label.toLowerCase()} on juba lisatud. Kustuta vana foto enne asendamist.`);
      return;
    }
    UI.toast(`Töötlen ${selected.length} ${selected.length === 1 ? 'fotot' : 'fotot'}...`);
    try {
      const processed = [];
      for (const item of selected) {
        processed.push({ angle: item.key, image: await this.resizeImage(item.input.files[0]) });
      }
      const all = this.getAll();
      processed.forEach(item => {
        all.push({ id: Fmt.uid(), date, image: item.image, angle: item.angle, note, analysis: null });
      });
      all.sort((a, b) => a.date.localeCompare(b.date));
      const ok = this.save(all);
      if (ok) {
        selected.forEach(item => { item.input.value = ''; });
        document.getElementById('photo-note').value = '';
        this.renderAll();
        UI.toast(`${processed.length} ${processed.length === 1 ? 'foto lisatud' : 'fotot lisatud'}`);
      }
    } catch (e) {
      console.error(e);
      if (e.message === 'HEIC_TUGI_PUUDUB') {
        UI.toast('HEIC-foto teisendamine ei käivitunud. Kontrolli internetiühendust või vali JPG-foto.');
      } else if (e.message === 'PILTI_EI_SAA_AVADA') {
        UI.toast('Seda fotofaili ei saa avada. Proovi JPG-, PNG- või HEIC-faili.');
      } else {
        UI.toast('Foto töötlemine ebaõnnestus. Proovi väiksemat või JPG-vormingus pilti.');
      }
    }
  },

  storageEstimateKB() {
    const raw = localStorage.getItem(Storage.KEYS.PHOTOS) || '';
    return Math.round(raw.length / 1024);
  },

  renderStorageHint() {
    const kb = this.storageEstimateKB();
    const el = document.getElementById('photo-storage-hint');
    el.textContent = `Fotod kasutavad hetkel localStorage'is umbes ${kb} KB. Enamikel brauseritel on piir ~5-10 MB kogu saidi kohta — kui see täis saab, ekspordi ja kustuta vanu fotosid (Seaded → Andmete haldus).`;
  },

  async analyze(id) {
    const profile = Storage.getProfile();
    if (!profile.anthropicApiKey) {
      UI.toast('Lisa Anthropic API võti Seaded lehel');
      return;
    }
    const all = this.getAll();
    const idx = all.findIndex(p => p.id === id);
    const current = all[idx];
    const previous = all
      .filter(photo => photo.angle === current.angle && photo.date < current.date)
      .sort((a, b) => b.date.localeCompare(a.date))[0] || null;

    const btn = document.querySelector(`[data-analyze="${id}"]`);
    if (btn) { btn.disabled = true; btn.textContent = 'Analüüsin...'; }

    try {
      const content = [];
      if (previous) {
        content.push({ type: 'text', text: `Mõlemad pildid on sama vaatenurga (${this.angleLabel(current.angle)}) progressifotod. Esimene on varasem (${previous.date}), teine uuem (${current.date}). Võrdle neid ja kirjelda lühidalt (3-4 lauset), milliseid nähtavaid muutuseid märkad (lihastoonus, kehahoid, üldmulje). Ole toetav ja konstruktiivne, väldi kaalu või kehakuju hindavaid kommentaare, keskendu treeningu edenemisele. Vasta eesti keeles.` });
        content.push({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: this._stripPrefix(previous.image) } });
        content.push({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: this._stripPrefix(current.image) } });
      } else {
        content.push({ type: 'text', text: `See on esimene progressifoto. Kirjelda lühidalt (2-3 lauset) üldmuljet toetaval ja konstruktiivsel toonil, ilma kaalu või kehakuju hindavate kommentaarideta — keskendu sellele kui lähtepunktile tulevaste võrdluste jaoks. Vasta eesti keeles.` });
        content.push({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: this._stripPrefix(current.image) } });
      }

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
          max_tokens: 500,
          messages: [{ role: 'user', content }],
        }),
      });

      if (!res.ok) {
        const errBody = await res.text();
        throw new Error(`API viga ${res.status}: ${errBody.slice(0, 200)}`);
      }
      const data = await res.json();
      const text = (data.content || []).map(b => b.text || '').join('\n').trim() || 'Vastust ei saadud.';
      this.update(id, { analysis: text });
      this.renderAll();
    } catch (e) {
      console.error(e);
      UI.toast('Analüüs ebaõnnestus: ' + e.message);
      if (btn) { btn.disabled = false; btn.textContent = 'Analüüsi Claude\'iga'; }
    }
  },

  _stripPrefix(dataUrl) {
    return dataUrl.split(',')[1];
  },

  renderGallery() {
    const all = this.getAll().slice().sort((a, b) => b.date.localeCompare(a.date));
    const el = document.getElementById('photo-gallery');
    if (!all.length) {
      el.innerHTML = '<p class="hint">POLE ÜHTEGI FOTOT. AEG ALUSTADA.</p>';
      return;
    }
    const grouped = all.reduce((groups, photo) => {
      if (!groups[photo.date]) groups[photo.date] = [];
      groups[photo.date].push(photo);
      return groups;
    }, {});
    el.innerHTML = Object.entries(grouped).map(([date, photos]) => `
      <section class="photo-date-group">
        <div class="photo-date-heading">
          <strong>${DateUtils.formatEt(date)}</strong>
          <span>${photos.length}/3 FOTOT</span>
        </div>
        <div class="photo-gallery">
          ${photos.sort((a, b) => this.ANGLES.findIndex(angle => angle.key === a.angle) - this.ANGLES.findIndex(angle => angle.key === b.angle)).map(p => `
            <div class="photo-tile">
              <img src="${p.image}" alt="Progressifoto ${p.date}">
              <div class="photo-tile-body">
                <select class="photo-angle-select" data-angle-id="${p.id}" aria-label="Foto vaatenurk">
                  ${this.ANGLES.map(angle => `<option value="${angle.key}" ${angle.key === p.angle ? 'selected' : ''}>${angle.label}</option>`).join('')}
                </select>
                ${p.note ? `<div class="photo-tile-note">${this._esc(p.note)}</div>` : ''}
                <div class="photo-tile-actions">
                  <button class="btn btn-secondary" data-analyze="${p.id}">Analüüsi Claude'iga</button>
                  <button class="btn btn-ghost danger" data-delete="${p.id}">Kustuta</button>
                </div>
                ${p.analysis ? `<div class="photo-tile-analysis">${this._esc(p.analysis)}</div>` : ''}
              </div>
            </div>
          `).join('')}
        </div>
      </section>
    `).join('');
    el.querySelectorAll('[data-analyze]').forEach(btn => {
      btn.addEventListener('click', () => this.analyze(btn.dataset.analyze));
    });
    el.querySelectorAll('[data-angle-id]').forEach(select => {
      select.addEventListener('change', () => this.changeAngle(select.dataset.angleId, select.value));
    });
    el.querySelectorAll('[data-delete]').forEach(btn => {
      btn.addEventListener('click', () => {
        if (confirm('Kustuta see foto?')) {
          this.remove(btn.dataset.delete);
          this.renderAll();
        }
      });
    });
  },

  renderComparison() {
    const all = this.getAll().slice().sort((a, b) => a.date.localeCompare(b.date));
    const dates = [...new Set(all.map(photo => photo.date))];
    const beforeSelect = document.getElementById('photo-compare-before');
    const afterSelect = document.getElementById('photo-compare-after');
    const comparison = document.getElementById('photo-comparison');
    if (!beforeSelect || !afterSelect || !comparison) return;

    if (dates.length < 2) {
      beforeSelect.innerHTML = '';
      afterSelect.innerHTML = '';
      beforeSelect.disabled = true;
      afterSelect.disabled = true;
      comparison.innerHTML = '<p class="hint">Võrdluseks lisa fotod vähemalt kahele eri kuupäevale.</p>';
      return;
    }

    const previousBefore = beforeSelect.value;
    const previousAfter = afterSelect.value;
    const options = dates.map(date => `<option value="${date}">${DateUtils.formatEt(date)} · ${all.filter(p => p.date === date).length} fotot</option>`).join('');
    beforeSelect.innerHTML = options;
    afterSelect.innerHTML = options;
    beforeSelect.disabled = false;
    afterSelect.disabled = false;
    beforeSelect.value = dates.includes(previousBefore) ? previousBefore : dates[0];
    afterSelect.value = dates.includes(previousAfter) ? previousAfter : dates[dates.length - 1];

    const beforePhotos = all.filter(p => p.date === beforeSelect.value);
    const afterPhotos = all.filter(p => p.date === afterSelect.value);
    const dayDifference = Math.abs(Math.round((new Date(`${afterSelect.value}T00:00:00`) - new Date(`${beforeSelect.value}T00:00:00`)) / 86400000));
    comparison.innerHTML = `
      <div class="photo-comparison-head">
        <span>ENNE · ${DateUtils.formatEt(beforeSelect.value)}</span>
        <span>PÄRAST · ${DateUtils.formatEt(afterSelect.value)}</span>
      </div>
      <div class="photo-comparison-angles">
        ${this.ANGLES.map(angle => {
          const before = beforePhotos.find(photo => photo.angle === angle.key);
          const after = afterPhotos.find(photo => photo.angle === angle.key);
          if (!before && !after) return '';
          return `
            <section class="photo-comparison-angle">
              <div class="photo-angle-title">${angle.label}</div>
              <div class="photo-comparison-pair">
                ${before ? `<img src="${before.image}" alt="Varasem ${angle.label.toLowerCase()}">` : '<div class="photo-missing">Foto puudub</div>'}
                ${after ? `<img src="${after.image}" alt="Hilisem ${angle.label.toLowerCase()}">` : '<div class="photo-missing">Foto puudub</div>'}
              </div>
            </section>
          `;
        }).join('')}
      </div>
      <div class="photo-compare-duration">${dayDifference} PÄEVA VAHEL</div>
    `;
  },

  _esc(s) {
    const d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
  },

  renderAll() {
    this.renderComparison();
    this.renderGallery();
    this.renderStorageHint();
  },

  init() {
    this.migrateAngles();
    document.getElementById('photo-date').value = DateUtils.todayISO();
    document.getElementById('photo-add-btn').addEventListener('click', () => this.handleAdd());
    document.getElementById('photo-compare-before').addEventListener('change', () => this.renderComparison());
    document.getElementById('photo-compare-after').addEventListener('change', () => this.renderComparison());
    this.renderAll();
  },
};
