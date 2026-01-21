/* static/js/main.js */
const wishLayer = document.getElementById("wish-layer");
const input = document.getElementById("wish-input");
const sendButton = document.getElementById("send-button");
const fireworkToggle = document.getElementById("firework-toggle");

/* 配置参数 */
const CONFIG = {
  maxWishes: 18,         // 稍微减少数量以配合大字体
  baseSpeed: 0.3,        // 稍微加快一点上升速度
  floatAmp: 0.5,         
  canvasStarCount: 150,
  
  // 气泡碰撞检测参数
  wishWidth: 260,        // 估算的卡片宽度（用于碰撞计算）
  wishHeight: 80,        // 估算的卡片高度
};

let wishesData = []; 
let isFireworkActive = false; 

/* -----------------------------------------------------------
   PART 1: Canvas 粒子系统 (增强版烟花 + 星空)
   ----------------------------------------------------------- */
const canvas = document.getElementById("particle-canvas");
const ctx = canvas.getContext("2d");
let particles = []; 
let stars = [];     

function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  initStars();
}

function initStars() {
  stars = [];
  for (let i = 0; i < CONFIG.canvasStarCount; i++) {
    stars.push({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      size: Math.random() * 1.5,
      alpha: Math.random(),
      fadeSpeed: 0.005 + Math.random() * 0.01
    });
  }
}

// 增强版烟花粒子
class FireworkParticle {
  constructor(x, y, color, type = 'normal') {
    this.x = x;
    this.y = y;
    this.color = color;
    this.type = type; // 'normal' 或 'big'

    this.air = type == 'big' ? 0.98 : 0.95

    // 随机大小，制造层次感
    this.size = (Math.random() * 2 + 0.5) * (type === 'big' ? 1.5 : 1);
    
    // 爆炸发散
    const angle = Math.random() * Math.PI * 2;
    // 这种速度分布会让烟花更像圆球
    const velocity = Math.random() * (type === 'big' ? 7 : 4.5); 
    this.vx = Math.cos(angle) * velocity;
    this.vy = Math.sin(angle) * velocity;
    
    this.life =  (Math.random() + 2) * (type === 'big' ? 1.5 : 1); 
    this.decay = 0.01 + Math.random() * 0.015; 
    this.gravity = 0.03;
  }

  update() {
    this.x += this.vx;
    this.y += this.vy;
    this.vy += this.gravity; 
    this.vx *= this.air; // 空气阻力
    this.vy *= this.air;
    this.life -= this.decay;
  }

  draw(ctx) {
    ctx.globalAlpha = Math.max(0, this.life);
    ctx.fillStyle = this.color;
    
    // --- 核心修改：添加发光边缘 ---
    // 注意：大量的 shadowBlur 会消耗性能，这里根据粒子寿命动态控制
    if (this.life > 0.5) {
      ctx.shadowBlur = 10; 
      ctx.shadowColor = this.color;
    } else {
      ctx.shadowBlur = 0;
    }

    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
    ctx.fill();
    
    // 重置 shadow 避免影响其他绘制
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1.0;
  }
}

// 触发烟花爆炸
// type: 'normal' (随机小烟花) | 'big' (发送时的庆典烟花)
function createExplosion(x, y, type = 'normal') {
  const colors = ['#ffec44', '#ffbac4', '#4cccff', '#8bff64', '#ffce6b', '#fff9f9'];
  const color = colors[Math.floor(Math.random() * colors.length)];
  
  // 大烟花粒子更多
  const particleCount = type === 'big' ? 130 : 35; 
  
  for (let i = 0; i < particleCount; i++) {
    particles.push(new FireworkParticle(x, y, color, type));
  }
}

function renderLoop() {
  // 使用 source-over 和带透明度的 clearRect 可以制造一点点拖尾效果（可选，这里保持清晰）
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // 1. 绘制星星
  ctx.fillStyle = "#FFF";
  stars.forEach(star => {
    star.alpha += star.fadeSpeed;
    if (star.alpha > 1 || star.alpha < 0.2) star.fadeSpeed = -star.fadeSpeed;
    ctx.globalAlpha = star.alpha;
    ctx.beginPath();
    ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.globalAlpha = 1.0;

  // 2. 绘制烟花
  if (particles.length > 0) {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.update();
      p.draw(ctx);
      if (p.life <= 0) particles.splice(i, 1);
    }
  }
  
  // 3. 自动随机燃放
  if (isFireworkActive && Math.random() < 0.02) { 
    createExplosion(
      Math.random() * canvas.width, 
      Math.random() * canvas.height * 0.75
    );
  }

  requestAnimationFrame(renderLoop);
}


/* -----------------------------------------------------------
   PART 2: 寄语卡片逻辑 (防重叠 + 滚动刷新)
   ----------------------------------------------------------- */

// 检查位置是否与现有的卡片重叠
const checkCollision = (x, y, existingWishes) => {
  for (let w of existingWishes) {
    // 简单的矩形距离检测
    const dx = Math.abs(x - w.x);
    const dy = Math.abs(y - w.y);
    // 如果水平距离小于宽度，且垂直距离小于高度，则认为重叠
    if (dx < CONFIG.wishWidth && dy < CONFIG.wishHeight) {
      return true; // 发生碰撞
    }
  }
  return false;
};

// 智能寻找空位
// startFromBottom: true 表示从屏幕底部生成（新/循环），false 表示屏幕中间（初始化）
const findFreePosition = (startFromBottom = true) => {
  const padding = 20;
  const minX = padding;
  const maxX = window.innerWidth - padding - 220; // 留出一点右边距
  
  // 尝试 20 次寻找不重叠的位置
  for (let i = 0; i < 20; i++) {
    const x = minX + Math.random() * (maxX - minX);
    let y;

    if (startFromBottom) {
      // 从屏幕底部下方生成 (100% height + 随机缓冲)
      y = window.innerHeight + 50 + Math.random() * 150;
    } else {
      // 屏幕中间区域随机
      y = window.innerHeight * 0.2 + Math.random() * (window.innerHeight * 0.6);
    }

    if (!checkCollision(x, y, wishesData)) {
      return { x, y };
    }
  }
  
  // 如果实在找不到（屏幕太挤），就只能随机给一个了
  return {
    x: minX + Math.random() * (maxX - minX),
    y: startFromBottom ? window.innerHeight + 50 : Math.random() * window.innerHeight
  };
};

const deleteWish = async (id, element) => {
  if (!confirm("确定要删除这条寄语吗？")) return;
  
  // 视觉移除
  element.style.transition = "all 0.3s ease";
  element.style.opacity = '0';
  element.style.transform = 'scale(0.5)';
  
  // 逻辑移除
  wishesData = wishesData.filter(w => w.id !== id);
  setTimeout(() => {
      if(element.parentNode) element.parentNode.removeChild(element);
  }, 300);

  try {
    await fetch(`/api/delete/${id}`, { method: 'DELETE' });
  } catch (err) { console.error(err); }
};

const addWishToScene = (data, isNew = false) => {
  if (wishesData.some(w => w.id === data.id)) return;

  const el = document.createElement("div");
  el.className = "wish";
  el.textContent = data.text;
  
  const closeBtn = document.createElement("span");
  closeBtn.className = "close-btn";
  closeBtn.textContent = "×";
  closeBtn.onclick = (e) => { e.stopPropagation(); deleteWish(data.id, el); };
  el.appendChild(closeBtn);

  // --- 关键修改：位置计算 ---
  // 新发送的：强制从中间底部出现
  // 初始加载的：在屏幕中寻找空位
  let pos;
  if (isNew) {
      pos = { x: window.innerWidth / 2 - 100, y: window.innerHeight - 100 };
  } else {
      pos = findFreePosition(false); // false 表示不在底部生成，而是在屏幕里随机
  }

  el.style.left = `${pos.x}px`;
  el.style.top = `${pos.y}px`;
  wishLayer.appendChild(el);

  const wishObj = {
    id: data.id,
    element: el,
    x: pos.x,
    y: pos.y,
    speed: CONFIG.baseSpeed + Math.random() * 0.4, 
    phase: Math.random() * Math.PI * 2,
    phaseSpeed: 0.02 + Math.random() * 0.02
  };
  wishesData.push(wishObj);

  // 进场动画
  requestAnimationFrame(() => {
    el.style.opacity = "1";
    if (isNew) {
        el.style.transform = "scale(1.1)";
        setTimeout(() => el.style.transform = "scale(1)", 300);
        // 发送成功：屏幕中央绽放大烟花
        createExplosion(window.innerWidth / 2, window.innerHeight * 0.3, 'big');
    }
  });

  if (wishesData.length > CONFIG.maxWishes) {
    const old = wishesData.shift(); 
    if (old && old.element) {
      old.element.style.opacity = '0';
      setTimeout(() => old.element.remove(), 1000);
    }
  }
};

function animateWishes() {
  wishesData.forEach(w => {
    // 移动
    w.y -= w.speed;
    w.phase += w.phaseSpeed;
    const offsetX = Math.sin(w.phase) * CONFIG.floatAmp;
    
    // --- 关键修改：循环刷新逻辑 ---
    // 当气泡完全飘出屏幕上方 (y < -150)
    if (w.y < -150) {
      // 重新寻找一个不重叠的底部位置
      const newPos = findFreePosition(true); // true = 从底部生成
      w.x = newPos.x;
      w.y = newPos.y;
      
      // 可以顺便随机微调一下速度，让它看起来像个新气泡
      w.speed = CONFIG.baseSpeed + Math.random() * 0.4;
    }

    w.element.style.transform = `translate3d(${offsetX}px, 0, 0)`; 
    w.element.style.top = `${w.y}px`;
    w.element.style.left = `${w.x}px`; // 实时更新 left 以确保位置重置生效
  });
  
  requestAnimationFrame(animateWishes);
}

/* -----------------------------------------------------------
   PART 3: 初始化与事件
   ----------------------------------------------------------- */

const fetchInit = async () => {
  try {
    const res = await fetch("/api/init?recent_limit=15&random_limit=15");
    if (!res.ok) return;
    const data = await res.json();
    const all = [...(data.recent || []), ...(data.random || [])];
    all.sort(() => Math.random() - 0.5);
    all.forEach(w => addWishToScene(w, false));
  } catch (e) { console.error(e); }
};

const sendWish = async () => {
  const text = input.value.trim();
  if (!text) { input.focus(); return; }

  sendButton.classList.add("fly");
  
  try {
    const res = await fetch("/api/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });

    if (res.ok) {
      const wish = await res.json();
      addWishToScene(wish, true); 
      input.value = "";
      input.focus();
    }
  } catch (e) { console.error(e); } 
  finally { setTimeout(() => sendButton.classList.remove("fly"), 700); }
};

if (fireworkToggle) {
    fireworkToggle.addEventListener('change', (e) => isFireworkActive = e.target.checked);
}
sendButton.addEventListener("click", sendWish);
input.addEventListener("keydown", (e) => e.key === "Enter" && sendWish());
window.addEventListener("resize", resizeCanvas);

resizeCanvas();
renderLoop();
animateWishes();
fetchInit();