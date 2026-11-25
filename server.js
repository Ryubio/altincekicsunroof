const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const os = require('node:os');

const PORT = process.env.PORT || 8765;
const DEFAULT_PASSWORD = process.env.ADMIN_PASSWORD || 'AcS-2026!Bursa#77';
const TOKEN_SECRET = process.env.TOKEN_SECRET || 'altincekic-sunroof-bursa-secret-2026';

const ROOT_DIR = __dirname;
const DATA_DIR = path.join(ROOT_DIR, 'data');
const UPLOADS_DIR = path.join(ROOT_DIR, 'uploads');
const MEDIA_FILE = path.join(DATA_DIR, 'media.json');
const CONFIG_FILE = path.join(DATA_DIR, 'config.json');

fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(UPLOADS_DIR, { recursive: true });

function hashPassword(pw) {
  return crypto.createHash('sha256').update(String(pw)).digest('hex');
}

if (!fs.existsSync(CONFIG_FILE)) {
  fs.writeFileSync(
    CONFIG_FILE,
    JSON.stringify({ passwordHash: hashPassword(DEFAULT_PASSWORD) }, null, 2),
    'utf8'
  );
}

if (!fs.existsSync(MEDIA_FILE)) {
  const initialMedia = [
    {
      id: 'seed-1',
      url: 'assets/hero-sunroof.jpg',
      mediaType: 'image',
      placement: 'slider',
      title: 'Panoramik Cam Tavan & Sunroof Bakımı',
      createdAt: new Date().toISOString()
    },
    {
      id: 'seed-2',
      url: 'assets/workshop-precision.jpg',
      mediaType: 'image',
      placement: 'slider',
      title: 'Kızak, Ray & Mekanizma Onarımı',
      createdAt: new Date().toISOString()
    },
    {
      id: 'seed-3',
      url: 'assets/workshop-precision.jpg',
      mediaType: 'image',
      placement: 'gallery',
      title: 'Mekanizma & Ray Kalibrasyonu',
      createdAt: new Date().toISOString()
    },
    {
      id: 'seed-4',
      url: 'assets/interior-sunshade.jpg',
      mediaType: 'image',
      placement: 'gallery',
      title: 'Tavan Döşemesine Sıfır Hasar Teslimat',
      createdAt: new Date().toISOString()
    }
  ];
  fs.writeFileSync(MEDIA_FILE, JSON.stringify(initialMedia, null, 2), 'utf8');
}

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.heic': 'image/heic',
  '.heif': 'image/heif',
  '.svg': 'image/svg+xml',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mov': 'video/quicktime',
  '.m4v': 'video/mp4',
  '.3gp': 'video/3gpp'
};

function getStoredPasswordHash() {
  try {
    const cfg = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
    return cfg.passwordHash || hashPassword(DEFAULT_PASSWORD);
  } catch {
    return hashPassword(DEFAULT_PASSWORD);
  }
}

function readMedia() {
  try {
    return JSON.parse(fs.readFileSync(MEDIA_FILE, 'utf8'));
  } catch {
    return [];
  }
}

function writeMedia(items) {
  fs.writeFileSync(MEDIA_FILE, JSON.stringify(items, null, 2), 'utf8');
}

function createToken() {
  const payload = Buffer.from(JSON.stringify({ role: 'admin', iat: Date.now() })).toString('base64url');
  const sig = crypto.createHmac('sha256', TOKEN_SECRET).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

function verifyToken(authHeader) {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return false;
  const token = authHeader.slice(7).trim();
  const [payload, sig] = token.split('.');
  if (!payload || !sig) return false;
  const expected = crypto.createHmac('sha256', TOKEN_SECRET).update(payload).digest('base64url');
  if (sig.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
}

function sendJson(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data));
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
      if (raw.length > 1024 * 64) {
        reject(new Error('Body too large'));
        req.destroy();
      }
    });
    req.on('end', () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}

function sanitizeFilename(name) {
  const base = path.basename(name || 'dosya').replace(/[^a-zA-Z0-9._-]/g, '_');
  return base.slice(-80) || 'dosya';
}

const server = http.createServer(async (req, res) => {
  const urlObj = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = decodeURIComponent(urlObj.pathname);

  // API: Login
  if (req.method === 'POST' && pathname === '/api/login') {
    try {
      const body = await readJsonBody(req);
      const inputHash = hashPassword(body.password || '');
      const storedHash = getStoredPasswordHash();
      if (crypto.timingSafeEqual(Buffer.from(inputHash), Buffer.from(storedHash))) {
        return sendJson(res, 200, { ok: true, token: createToken() });
      }
      return sendJson(res, 401, { ok: false, error: 'Hatalı şifre.' });
    } catch {
      return sendJson(res, 400, { ok: false, error: 'Geçersiz istek.' });
    }
  }

  // API: Change Password
  if (req.method === 'POST' && pathname === '/api/change-password') {
    if (!verifyToken(req.headers.authorization)) {
      return sendJson(res, 401, { ok: false, error: 'Yetkisiz işlem.' });
    }
    try {
      const body = await readJsonBody(req);
      const newPw = String(body.newPassword || '').trim();
      if (newPw.length < 8) {
        return sendJson(res, 400, { ok: false, error: 'Yeni şifre en az 8 karakter olmalıdır.' });
      }
      fs.writeFileSync(CONFIG_FILE, JSON.stringify({ passwordHash: hashPassword(newPw) }, null, 2), 'utf8');
      return sendJson(res, 200, { ok: true });
    } catch {
      return sendJson(res, 400, { ok: false, error: 'Geçersiz istek.' });
    }
  }

  // API: Verify Session
  if (req.method === 'GET' && pathname === '/api/session') {
    return sendJson(res, 200, { authenticated: verifyToken(req.headers.authorization) });
  }

  // API: List Media
  if (req.method === 'GET' && pathname === '/api/media') {
    return sendJson(res, 200, { items: readMedia() });
  }

  // API: Upload Media (Raw binary stream, mobile-friendly)
  if (req.method === 'POST' && pathname === '/api/upload') {
    if (!verifyToken(req.headers.authorization)) {
      return sendJson(res, 401, { ok: false, error: 'Yetkisiz işlem. Lütfen tekrar giriş yapın.' });
    }

    const rawName = decodeURIComponent(req.headers['x-file-name'] || 'medya.jpg');
    const mimeType = String(req.headers['x-mime-type'] || '').toLowerCase();
    const title = decodeURIComponent(req.headers['x-title'] || '').trim() || 'Atölye Çalışması';
    const placementRaw = String(req.headers['x-placement'] || 'gallery');
    const placement = ['slider', 'video', 'gallery'].includes(placementRaw) ? placementRaw : 'gallery';

    const ext = path.extname(rawName).toLowerCase();
    const isVideo = mimeType.startsWith('video/') || ['.mp4', '.webm', '.mov', '.m4v', '.3gp'].includes(ext);
    const isImage = mimeType.startsWith('image/') || ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.heic', '.heif'].includes(ext);

    if (!isVideo && !isImage) {
      return sendJson(res, 400, { ok: false, error: 'Sadece fotoğraf veya video dosyası yüklenebilir.' });
    }

    const safeName = `${Date.now()}-${sanitizeFilename(rawName)}`;
    const destPath = path.join(UPLOADS_DIR, safeName);
    const writeStream = fs.createWriteStream(destPath);

    req.pipe(writeStream);

    writeStream.on('finish', () => {
      const items = readMedia();
      const newItem = {
        id: crypto.randomUUID(),
        url: `uploads/${safeName}`,
        mediaType: isVideo ? 'video' : 'image',
        placement,
        title,
        createdAt: new Date().toISOString()
      };
      items.unshift(newItem);
      writeMedia(items);
      sendJson(res, 201, { ok: true, item: newItem });
    });

    writeStream.on('error', () => {
      sendJson(res, 500, { ok: false, error: 'Dosya kaydedilemedi.' });
    });
    return;
  }

  // API: Delete Media
  if (req.method === 'DELETE' && pathname.startsWith('/api/media/')) {
    if (!verifyToken(req.headers.authorization)) {
      return sendJson(res, 401, { ok: false, error: 'Yetkisiz işlem.' });
    }
    const id = pathname.slice('/api/media/'.length);
    const items = readMedia();
    const target = items.find((x) => x.id === id);
    if (!target) {
      return sendJson(res, 404, { ok: false, error: 'Kayıt bulunamadı.' });
    }
    const remaining = items.filter((x) => x.id !== id);
    writeMedia(remaining);

    if (target.url.startsWith('uploads/')) {
      const filePath = path.join(ROOT_DIR, target.url);
      if (fs.existsSync(filePath)) {
        fs.unlink(filePath, () => {});
      }
    }
    return sendJson(res, 200, { ok: true });
  }

  // Static Files
  let relPath = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
  const fullPath = path.resolve(ROOT_DIR, relPath);
  if (!fullPath.startsWith(ROOT_DIR)) {
    res.writeHead(403);
    return res.end('Forbidden');
  }

  fs.stat(fullPath, (err, stat) => {
    if (err || !stat.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end('Bulunamadı');
    }

    const ext = path.extname(fullPath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    const range = req.headers.range;
    if (range) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : stat.size - 1;
      const chunkSize = end - start + 1;

      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${stat.size}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunkSize,
        'Content-Type': contentType
      });
      fs.createReadStream(fullPath, { start, end }).pipe(res);
      return;
    }

    res.writeHead(200, {
      'Content-Type': contentType,
      'Content-Length': stat.size
    });
    fs.createReadStream(fullPath).pipe(res);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Altınçekiç Sunroof sunucusu çalışıyor: http://localhost:${PORT}`);
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        console.log(`Telefondan erişim (aynı Wi-Fi): http://${net.address}:${PORT}/admin.html`);
      }
    }
  }
});
