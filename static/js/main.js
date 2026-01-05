const wishSky = document.getElementById('wish-sky');
const input = document.getElementById('wish-input');
const sendBtn = document.getElementById('send-btn');
const hintText = document.getElementById('hint-text');
const countText = document.getElementById('count-text');
const starLayer = document.getElementById('star-layer');
const meteorLayer = document.getElementById('meteor-layer');
const fireworksCanvas = document.getElementById('fireworks-text');

const placements = [];
const MAX_WISHES = 80;

function updateCount() {
  const length = input.value.length;
  countText.textContent = `${length} / ${input.maxLength}`;
}

function showHint(message, isError = false) {
  hintText.textContent = message;
  hintText.style.color = isError ? '#ffd46b' : 'rgba(255, 255, 255, 0.7)';
}

function getSafeArea() {
  const skyRect = wishSky.getBoundingClientRect();
  const inputPanel = document.querySelector('.input-panel');
  const panelRect = inputPanel.getBoundingClientRect();
  const top = 20;
  const left = 10;
  const right = skyRect.width - 10;
  const bottom = panelRect.top - skyRect.top - 24;
  return {
    width: right - left,
    height: bottom - top,
    top,
    left,
  };
}

function overlaps(rect) {
  return placements.some((item) => {
    return !(
      rect.x + rect.width < item.x - 12 ||
      rect.x > item.x + item.width + 12 ||
      rect.y + rect.height < item.y - 12 ||
      rect.y > item.y + item.height + 12
    );
  });
}

function findPlacement(width, height) {
  const area = getSafeArea();
  for (let i = 0; i < 20; i += 1) {
    const x = area.left + Math.random() * Math.max(0, area.width - width);
    const y = area.top + Math.random() * Math.max(0, area.height - height);
    const rect = { x, y, width, height };
    if (!overlaps(rect)) {
      return rect;
    }
  }
  return {
    x: area.left + Math.random() * Math.max(0, area.width - width),
    y: area.top + Math.random() * Math.max(0, area.height - height),
    width,
    height,
  };
}

function addWish(text, { initial = false } = {}) {
  if (!text) return;
  const wishEl = document.createElement('div');
  wishEl.className = 'wish';
  wishEl.textContent = text;
  wishSky.appendChild(wishEl);

  const rect = wishEl.getBoundingClientRect();
  const placement = findPlacement(rect.width, rect.height);
  wishEl.style.left = `${placement.x}px`;
  wishEl.style.top = `${placement.y}px`;
  placements.push(placement);

  const delay = initial ? Math.random() * 600 : 0;
  setTimeout(() => {
    wishEl.classList.add('visible');
    wishEl.classList.add('floating');
  }, delay);

  if (placements.length > MAX_WISHES) {
    placements.shift();
    const first = wishSky.querySelector('.wish');
    if (first) first.remove();
  }
}

async function sendWish() {
  const text = input.value.trim();
  if (!text) {
    showHint('寄语不能为空', true);
    return;
  }
  if (text.length > input.maxLength) {
    showHint('寄语太长了', true);
    return;
  }

  try {
    const response = await fetch('/api/wishes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });
    if (!response.ok) {
      const error = await response.json();
      showHint(error.error || '发送失败', true);
      return;
    }
    const data = await response.json();
    addWish(data.text);
    input.value = '';
    updateCount();
    input.focus();
    showHint('寄语已送达');
    triggerPlane();
  } catch (error) {
    showHint('网络异常，请稍后再试', true);
  }
}

function triggerPlane() {
  const buttonRect = sendBtn.getBoundingClientRect();
  const sceneRect = document.querySelector('.scene').getBoundingClientRect();
  const plane = document.createElement('div');
  plane.className = 'flying-plane';
  plane.style.left = `${buttonRect.left - sceneRect.left + 8}px`;
  plane.style.top = `${buttonRect.top - sceneRect.top + 10}px`;
  document.querySelector('.scene').appendChild(plane);

  for (let i = 0; i < 6; i += 1) {
    const spark = document.createElement('span');
    spark.className = 'plane-spark';
    spark.style.left = `${buttonRect.left - sceneRect.left + 6 + i * 2}px`;
    spark.style.top = `${buttonRect.top - sceneRect.top + 30 + Math.random() * 6}px`;
    spark.style.animationDelay = `${i * 0.04}s`;
    document.querySelector('.scene').appendChild(spark);
    spark.addEventListener('animationend', () => spark.remove());
  }

  plane.addEventListener('animationend', () => plane.remove());
}

function initStars() {
  const total = 120;
  for (let i = 0; i < total; i += 1) {
    const star = document.createElement('span');
    star.className = 'star';
    const size = Math.random() * 2 + 1;
    star.style.width = `${size}px`;
    star.style.height = `${size}px`;
    star.style.left = `${Math.random() * 100}%`;
    star.style.top = `${Math.random() * 80}%`;
    star.style.animationDelay = `${Math.random() * 4}s`;
    star.style.animationDuration = `${3 + Math.random() * 5}s`;
    starLayer.appendChild(star);
  }
}

function scheduleMeteor() {
  const delay = 6000 + Math.random() * 14000;
  setTimeout(() => {
    const meteor = document.createElement('div');
    meteor.className = 'meteor';
    meteor.style.left = `${Math.random() * 70}%`;
    meteor.style.top = `${Math.random() * 40}%`;
    meteorLayer.appendChild(meteor);
    meteor.addEventListener('animationend', () => meteor.remove());
    scheduleMeteor();
  }, delay);
}

let fireworksParticles = [];
let fireworksCtx;

function buildFireworksText() {
  const canvas = fireworksCanvas;
  const ctx = canvas.getContext('2d');
  fireworksCtx = ctx;
  const { width, height } = canvas.getBoundingClientRect();
  canvas.width = Math.round(width * window.devicePixelRatio);
  canvas.height = Math.round(height * window.devicePixelRatio);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

  const offscreen = document.createElement('canvas');
  offscreen.width = width;
  offscreen.height = height;
  const offCtx = offscreen.getContext('2d');
  offCtx.clearRect(0, 0, width, height);

  const fontSize = Math.min(width * 0.14, 150);
  offCtx.font = `700 ${fontSize}px "Segoe UI", sans-serif`;
  offCtx.textAlign = 'center';
  offCtx.textBaseline = 'middle';
  offCtx.fillStyle = 'rgba(255, 214, 120, 0.9)';
  offCtx.fillText('TOWARDS 2026', width / 2, height * 0.35);

  const data = offCtx.getImageData(0, 0, width, height).data;
  fireworksParticles = [];
  for (let y = 0; y < height; y += 6) {
    for (let x = 0; x < width; x += 6) {
      const index = (y * width + x) * 4 + 3;
      if (data[index] > 10) {
        fireworksParticles.push({
          x,
          y,
          radius: Math.random() * 1.6 + 0.6,
          phase: Math.random() * Math.PI * 2,
        });
      }
    }
  }
}

function renderFireworksText(time) {
  if (!fireworksCtx) return;
  const ctx = fireworksCtx;
  const { width, height } = fireworksCanvas.getBoundingClientRect();
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = 'rgba(255, 214, 120, 0.18)';

  fireworksParticles.forEach((particle) => {
    const pulse = 0.4 + 0.6 * Math.sin(time / 1200 + particle.phase);
    ctx.globalAlpha = 0.18 + pulse * 0.22;
    ctx.beginPath();
    ctx.arc(particle.x, particle.y, particle.radius + pulse * 0.6, 0, Math.PI * 2);
    ctx.fill();
  });

  ctx.globalAlpha = 1;
  requestAnimationFrame(renderFireworksText);
}

async function loadInitialWishes() {
  try {
    const response = await fetch('/api/wishes/seed?recent=20&random=30');
    if (!response.ok) return;
    const data = await response.json();
    const combined = [...data.recent, ...data.random];
    combined.forEach((wish) => addWish(wish.text, { initial: true }));
  } catch (error) {
    showHint('加载寄语失败', true);
  }
}

function init() {
  initStars();
  scheduleMeteor();
  buildFireworksText();
  requestAnimationFrame(renderFireworksText);
  loadInitialWishes();
  updateCount();
  input.focus();
}

sendBtn.addEventListener('click', sendWish);
input.addEventListener('input', updateCount);
input.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    event.preventDefault();
    sendWish();
  }
});

window.addEventListener('resize', () => {
  buildFireworksText();
});

init();
