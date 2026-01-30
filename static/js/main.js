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

// === 新增：游戏状态变量 ===
let isGaming = false;
let gameScore = 0;
let caughtWishesText = []; // 存储捕获到的文字

const addWishToScene = (data, isNew = false) => {
  if (wishesData.some(w => w.id === data.id)) return;

  const el = document.createElement("div");
  el.className = "wish";
  el.textContent = data.text;

  // --- 修改 1: 添加游戏点击事件 ---
  el.addEventListener('mousedown', (e) => {
    if (isGaming) {
        e.stopPropagation(); // 防止触发其他点击
        handleCatchWish(data, el, e.clientX, e.clientY);
        return;
    }
  });
  
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

/* -----------------------------------------------------------
   PART 4: 游戏模式逻辑 (新增)
   ----------------------------------------------------------- */
   const hudCenter = document.querySelector('.hud-center');
   const timerSpan = document.querySelector('.timer');
   const scoreSpan = document.querySelector('.score');
   const startBtn = document.getElementById('start-game-btn');
   const refreshBtn = document.getElementById('refresh-btn');
   
   // 捕获祝福的处理
   function handleCatchWish(data, element, clientX, clientY) {
       // 1. 加分
       gameScore++;
       scoreSpan.textContent = `✨ ${gameScore}`;
       caughtWishesText.push(data.text);
   
       // 2. 视觉反馈：爆炸并消失
       createExplosion(clientX, clientY, 'normal'); // 复用现有的烟花效果
       
       element.style.transform = "scale(1.5)";
       element.style.opacity = "0";
       
       // 从数据中移除
       wishesData = wishesData.filter(w => w.id !== data.id);
       setTimeout(() => {
           if(element.parentNode) element.parentNode.removeChild(element);
       }, 200);
   }
   
   // 刷新祝福池
   async function refreshWishes() {
       refreshBtn.style.transform = "rotate(360deg)";
       
       // 清空现有 DOM
       wishesData.forEach(w => {
           if(w.element && w.element.parentNode) w.element.parentNode.removeChild(w.element);
       });
       wishesData = [];
       
       // 重新获取
       await fetchInit();
       
       setTimeout(() => refreshBtn.style.transform = "rotate(0deg)", 500);
   }
   
   // 游戏主流程
   function startGame() {
       isGaming = true;
       gameScore = 0;
       caughtWishesText = [];
       let timeLeft = 10;
       
       // UI 切换
       document.body.classList.add('gaming');
       startBtn.style.display = 'none';
       refreshBtn.style.display = 'none';
       hudCenter.style.display = 'flex';
       scoreSpan.textContent = `✨ 0`;
       timerSpan.textContent = `⏳ 10s`;
   
       // 倒计时
       const timerInterval = setInterval(() => {
           timeLeft--;
           timerSpan.textContent = `⏳ ${timeLeft}s`;
           
           if (timeLeft <= 0) {
               clearInterval(timerInterval);
               endGame();
           }
       }, 1000);
   }
   
   function endGame() {
       isGaming = false;
       document.body.classList.remove('gaming');
       hudCenter.style.display = 'none';
       startBtn.style.display = 'block';
       refreshBtn.style.display = 'block';
   
       showResultModal();
   }
   
   // 结果计算与展示
   const modal = document.getElementById('result-modal');
   const modalTitle = document.getElementById('modal-title');
   const finalScore = document.getElementById('final-score');
   const genWishText = document.getElementById('generated-wish-text');
   const finalInput = document.getElementById('final-wish-input');
   
   function showResultModal() {
    // 1. 设置分数
    finalScore.textContent = gameScore;
    
    // 2. 设置称号
    let title = "";
    if (gameScore < 3) title = "🌸 佛系赏花人";
    else if (gameScore < 8) title = "🌟 愿望捕手";
    else if (gameScore < 15) title = "🚀 手速惊人";
    else title = "👑 纳福锦鲤";
    modalTitle.textContent = title;

    // 3. 生成寄语逻辑 (示例)
    let generatedText = "";
    if (caughtWishesText.length > 0) {
        const randomWish = caughtWishesText[Math.floor(Math.random() * caughtWishesText.length)];
        // 为了排版好看，建议生成的句子不要太长，或者手动换行
        const templates = [
            `与${randomWish}\n不期而遇`,
            `2026关键词\n${randomWish}`,
            `保持热爱\n${randomWish}`,
            `${randomWish}\n平安喜乐`
        ];
        generatedText = templates[Math.floor(Math.random() * templates.length)];
    } else {
        generatedText = "万事顺遂\n平安喜乐";
    }
    
    // 4. 赋值并同步
    genWishText.textContent = generatedText;
    finalInput.value = generatedText.replace(/\n/g, " "); // 输入框里显示单行，方便编辑
    
    modal.classList.add('active');
}

// === 核心：输入框实时同步到海报 ===
finalInput.addEventListener('input', (e) => {
    // 这里做一个简单的处理：如果用户输入空格，我们在海报上视作换行，或者直接原样显示
    // 简单起见，直接显示用户输入的文本
    genWishText.textContent = e.target.value || " "; 
});
   
   // 模态框按钮事件
   document.getElementById('close-modal-btn').onclick = () => {
       modal.classList.remove('active');
       // 游戏结束后，最好补货一点，不然屏幕空了
       if (wishesData.length < 5) refreshWishes();
   };
   
   document.getElementById('save-result-btn').onclick = async () => {
       const text = finalInput.value.trim();
       if (text) {
           // 调用原有的输入框和发送逻辑，或者直接 fetch
           // 这里为了简单，直接模拟点击主界面的发送
           input.value = text;
           await sendWish(); // 复用 Part 3 的发送函数
       }
       modal.classList.remove('active');
       alert("✨ 你的新年签已存入祝福池！");
   };
   
   // 绑定新增按钮事件
   startBtn.addEventListener('click', startGame);
   refreshBtn.addEventListener('click', refreshWishes);