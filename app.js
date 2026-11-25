const WHATSAPP_NUMBER = '905334771406';

// Mobile Menu
const menuToggle = document.getElementById('menuToggle');
const nav = document.getElementById('nav');
if (menuToggle && nav) {
  menuToggle.addEventListener('click', () => {
    const isOpen = nav.classList.toggle('open');
    menuToggle.setAttribute('aria-expanded', String(isOpen));
  });
  nav.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', () => {
      nav.classList.remove('open');
      menuToggle.setAttribute('aria-expanded', 'false');
    });
  });
}

// Slider state
let currentSlide = 0;
let autoTimer = null;

function initSlider() {
  const slides = Array.from(document.querySelectorAll('#slidesTrack .slide'));
  const dotsWrap = document.getElementById('sliderDots');
  const prevBtn = document.getElementById('sliderPrev');
  const nextBtn = document.getElementById('sliderNext');
  if (!slides.length) return;

  dotsWrap.innerHTML = slides
    .map((_, i) => `<button type="button" class="${i === 0 ? 'active' : ''}" aria-label="${i + 1}. Slayt"></button>`)
    .join('');

  const dots = Array.from(dotsWrap.querySelectorAll('button'));

  function goTo(idx) {
    currentSlide = (idx + slides.length) % slides.length;
    slides.forEach((s, i) => {
      const active = i === currentSlide;
      s.classList.toggle('active', active);
      const vid = s.querySelector('video');
      if (vid) {
        if (active) vid.play().catch(() => {});
        else vid.pause();
      }
    });
    dots.forEach((d, i) => d.classList.toggle('active', i === currentSlide));
  }

  function resetTimer() {
    if (autoTimer) clearInterval(autoTimer);
    if (slides.length > 1) {
      autoTimer = setInterval(() => goTo(currentSlide + 1), 6000);
    }
  }

  if (prevBtn) {
    prevBtn.onclick = () => { goTo(currentSlide - 1); resetTimer(); };
  }
  if (nextBtn) {
    nextBtn.onclick = () => { goTo(currentSlide + 1); resetTimer(); };
  }
  dots.forEach((dot, i) => {
    dot.onclick = () => { goTo(i); resetTimer(); };
  });

  goTo(0);
  resetTimer();
}

// Lightbox
const lightbox = document.getElementById('lightbox');
const lightboxContent = document.getElementById('lightboxContent');
const lightboxClose = document.getElementById('lightboxClose');

function openLightbox(url, mediaType) {
  if (!lightbox || !lightboxContent) return;
  lightboxContent.innerHTML = mediaType === 'video'
    ? `<video src="${url}" controls autoplay playsinline></video>`
    : `<img src="${url}" alt="Atölye Görseli" />`;
  lightbox.classList.add('open');
  lightbox.setAttribute('aria-hidden', 'false');
}

function closeLightbox() {
  if (!lightbox) return;
  lightbox.classList.remove('open');
  lightbox.setAttribute('aria-hidden', 'true');
  lightboxContent.innerHTML = '';
}

if (lightboxClose) lightboxClose.addEventListener('click', closeLightbox);
if (lightbox) {
  lightbox.addEventListener('click', (e) => {
    if (e.target === lightbox) closeLightbox();
  });
}

function escapeHtml(str) {
  return String(str || '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

// Load Dynamic Media from /api/media (fallback to static data/media.json on GitHub Pages)
async function loadSiteMedia() {
  try {
    let res = await fetch('/api/media');
    if (!res.ok) {
      res = await fetch('data/media.json');
    }
    const raw = await res.json();
    const items = Array.isArray(raw) ? raw : (raw.items || []);

    // 1. Slider items
    const sliderItems = items.filter((x) => x.placement === 'slider');
    const slidesTrack = document.getElementById('slidesTrack');
    if (slidesTrack && sliderItems.length) {
      slidesTrack.innerHTML = sliderItems.map((item, idx) => {
        const mediaEl = item.mediaType === 'video'
          ? `<video src="${item.url}" muted loop playsinline preload="metadata"></video>`
          : `<img src="${item.url}" alt="${escapeHtml(item.title)}" />`;
        return `
          <div class="slide ${idx === 0 ? 'active' : ''}">
            ${mediaEl}
            <div class="slide-caption">${escapeHtml(item.title)}</div>
          </div>
        `;
      }).join('');
    }
    initSlider();

    // 2. Video items
    const videoItems = items.filter((x) => x.placement === 'video' || (x.mediaType === 'video' && x.placement !== 'slider'));
    const videoGrid = document.getElementById('videoGrid');
    if (videoGrid) {
      if (!videoItems.length) {
        videoGrid.innerHTML = `
          <div class="empty-note">
            Henüz video eklenmedi. Usta panelinden (<a href="/admin.html" style="text-decoration:underline;font-weight:600;">Usta Girişi</a>) kolayca uygulama videosu ekleyebilirsiniz.
          </div>
        `;
      } else {
        videoGrid.innerHTML = videoItems.map((item) => `
          <article class="media-tile">
            <div class="media-tile-box">
              <video src="${item.url}" controls playsinline preload="metadata"></video>
            </div>
            <div class="media-tile-cap">${escapeHtml(item.title)}</div>
          </article>
        `).join('');
      }
    }

    // 3. Gallery items
    const galleryItems = items.filter((x) => x.placement === 'gallery');
    const galleryGrid = document.getElementById('galleryGrid');
    if (galleryGrid) {
      if (!galleryItems.length) {
        galleryGrid.innerHTML = `
          <div class="empty-note">
            Henüz galeri görseli eklenmedi. <a href="/admin.html" style="text-decoration:underline;font-weight:600;">Usta Girişi</a> üzerinden fotoğraf ekleyebilirsiniz.
          </div>
        `;
      } else {
        galleryGrid.innerHTML = galleryItems.map((item) => `
          <article class="media-tile">
            <div class="media-tile-box" onclick="openLightbox('${item.url}', '${item.mediaType}')">
              ${item.mediaType === 'video'
                ? `<video src="${item.url}" muted playsinline preload="metadata"></video>`
                : `<img src="${item.url}" alt="${escapeHtml(item.title)}" />`}
            </div>
            <div class="media-tile-cap">${escapeHtml(item.title)}</div>
          </article>
        `).join('');
      }
    }
  } catch {
    initSlider();
  }
}

window.openLightbox = openLightbox;
loadSiteMedia();

// Direct WhatsApp Form
const waForm = document.getElementById('whatsappForm');
const feedback = document.getElementById('formFeedback');

if (waForm) {
  waForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const fullName = document.getElementById('fullName').value.trim();
    const phone = document.getElementById('phone').value.trim();
    const carModel = document.getElementById('carModel').value.trim();
    const issueType = document.getElementById('issueType').value;
    const notes = document.getElementById('notes').value.trim();

    if (!fullName || !carModel) {
      feedback.style.color = '#b91c1c';
      feedback.textContent = 'Lütfen Ad Soyad ve Araç Modeli alanlarını doldurun.';
      return;
    }

    const msg =
      `Merhaba Halil Usta (Altınçekiç Sunroof),%0A` +
      `Ad Soyad: ${encodeURIComponent(fullName)}%0A` +
      (phone ? `Telefon: ${encodeURIComponent(phone)}%0A` : '') +
      `Araç: ${encodeURIComponent(carModel)}%0A` +
      `Konu: ${encodeURIComponent(issueType)}%0A` +
      (notes ? `Mesaj: ${encodeURIComponent(notes)}` : '');

    feedback.style.color = '#15803d';
    feedback.textContent = 'WhatsApp sohbeti açılıyor...';
    window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${msg}`, '_blank', 'noopener');
  });
}
