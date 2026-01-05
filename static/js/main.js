const wishLayer = document.getElementById("wish-layer");
const input = document.getElementById("wish-input");
const sendButton = document.getElementById("send-button");
const meteor = document.querySelector(".meteor");

const MAX_WISHES = 20; // 减少数量以保证碰撞流畅
const RECENT_LIMIT = 8;
const RANDOM_LIMIT = 10;

// 物理系统配置
const PHYSICS = {
  friction: 0.999, // 空气阻力
  restitution: 0.8, // 碰撞弹性 (1=完全弹性, 0=不反弹)
  minSpeed: 0.01, // 最小漂浮速度
  maxSpeed: 0.5, // 最大漂浮速度
};

// 存储所有的 Wish 对象
const wishes = [];

class Wish {
  constructor(data, isNew = false) {
    this.id = data.id;
    this.text = data.text;
    this.element = document.createElement("div");
    
    // 随机样式
    const variant = Math.random() > 0.5 ? "yellow" : "cyan";
    this.element.className = `wish ${variant}`;
    this.element.textContent = this.text;
    
    wishLayer.appendChild(this.element);
    
    // 获取尺寸
    const rect = this.element.getBoundingClientRect();
    this.width = rect.width;
    this.height = rect.height;
    // 使用圆半径近似碰撞体积
    this.radius = Math.max(this.width, this.height) / 2 * 0.9; 

    // 初始化位置和速度
    const bounds = this.getBounds();
    
    if (isNew) {
      // 新发送的：从底部中间发射
      this.x = window.innerWidth / 2 - this.width / 2;
      this.y = window.innerHeight - 150;
      this.vx = (Math.random() - 0.5) * 6; // 随机水平散射
      this.vy = -(Math.random() * 3 + 4); // 向上冲力
    } else {
      // 历史加载：随机分布
      this.x = Math.random() * (bounds.maxX - bounds.minX) + bounds.minX;
      this.y = Math.random() * (bounds.maxY - bounds.minY) + bounds.minY;
      // 赋予随机初始漂浮速度
      this.vx = (Math.random() - 0.5) * 1;
      this.vy = (Math.random() - 0.5) * 1;
    }

    // 淡入
    requestAnimationFrame(() => {
      this.element.style.opacity = "1";
    });
  }

  getBounds() {
    const padding = 20;
    const inputRect = document.querySelector(".input-bar").getBoundingClientRect();
    return {
      minX: padding,
      maxX: window.innerWidth - this.width - padding,
      minY: padding,
      maxY: inputRect.top - this.height - 40,
    };
  }

  update() {
    const bounds = this.getBounds();

    // 1. 应用速度
    this.x += this.vx;
    this.y += this.vy;

    // 2. 边界碰撞检测与反弹
    if (this.x <= bounds.minX) {
      this.x = bounds.minX;
      this.vx *= -1;
    } else if (this.x >= bounds.maxX) {
      this.x = bounds.maxX;
      this.vx *= -1;
    }

    if (this.y <= bounds.minY) {
      this.y = bounds.minY;
      this.vy *= -1;
    } else if (this.y >= bounds.maxY) {
      this.y = bounds.maxY;
      this.vy *= -1;
    }

    // 3. 施加微小的随机扰动 (模拟气流)，防止静止
    this.vx += (Math.random() - 0.5) * 0.05;
    this.vy += (Math.random() - 0.5) * 0.05;

    // 4. 速度限制 (防止过快或过慢)
    const speed = Math.hypot(this.vx, this.vy);
    if (speed > PHYSICS.maxSpeed) {
      this.vx = (this.vx / speed) * PHYSICS.maxSpeed;
      this.vy = (this.vy / speed) * PHYSICS.maxSpeed;
    }
    
    // 渲染
    this.element.style.transform = `translate(${this.x}px, ${this.y}px)`;
  }

  remove() {
    this.element.style.opacity = "0";
    setTimeout(() => {
      if (this.element.parentNode) {
        this.element.parentNode.removeChild(this.element);
      }
    }, 500);
  }
}

// 物理引擎核心循环
const updatePhysics = () => {
  // 1. 更新每个物体位置
  wishes.forEach(w => w.update());

  // 2. 碰撞检测 (O(N^2) 对少量物体是可以接受的)
  for (let i = 0; i < wishes.length; i++) {
    for (let j = i + 1; j < wishes.length; j++) {
      resolveCollision(wishes[i], wishes[j]);
    }
  }

  requestAnimationFrame(updatePhysics);
};

// 处理两个泡泡的碰撞
const resolveCollision = (w1, w2) => {
  const dx = (w1.x + w1.width / 2) - (w2.x + w2.width / 2);
  const dy = (w1.y + w1.height / 2) - (w2.y + w2.height / 2);
  const distance = Math.hypot(dx, dy);
  const minDist = w1.radius + w2.radius; // 简单的圆碰撞判定

  if (distance < minDist) {
    // 碰撞发生！
    
    // 1. 修正重叠 (将它们推开)
    const overlap = minDist - distance;
    const nx = dx / distance; // 法向量
    const ny = dy / distance;
    
    // 各退一半
    w1.x += nx * overlap * 0.5;
    w1.y += ny * overlap * 0.5;
    w2.x -= nx * overlap * 0.5;
    w2.y -= ny * overlap * 0.5;

    // 2. 交换动量 (简单弹性碰撞)
    // 实际上对于等质量物体，只需交换法向速度分量，这里简化为交换速度并衰减
    const tempVx = w1.vx;
    const tempVy = w1.vy;
    
    w1.vx = w2.vx * PHYSICS.restitution;
    w1.vy = w2.vy * PHYSICS.restitution;
    w2.vx = tempVx * PHYSICS.restitution;
    w2.vy = tempVy * PHYSICS.restitution;
  }
};


const addWishToSystem = (data, isNew) => {
  const wish = new Wish(data, isNew);
  wishes.push(wish);
  
  // 维护最大数量
  if (wishes.length > MAX_WISHES) {
    const removed = wishes.shift(); // 移除最早的
    removed.remove();
  }
};

const fetchInit = async () => {
  try {
    const response = await fetch(`/api/init?recent_limit=${RECENT_LIMIT}&random_limit=${RANDOM_LIMIT}`);
    if (!response.ok) return;
    const data = await response.json();
    const list = [...(data.recent || []), ...(data.random || [])];
    
    // 错开一点时间生成，看起来自然
    list.forEach((item, index) => {
      setTimeout(() => addWishToSystem(item, false), index * 50);
    });
    
  } catch (error) {
    console.error(error);
  }
};

const sendWish = async () => {
  const text = input.value.trim();
  if (!text) {
    input.focus();
    return;
  }

  sendButton.classList.add("fly");
  
  // 等待飞机起飞
  await new Promise(r => setTimeout(r, 300));

  try {
    const response = await fetch("/api/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });

    if (!response.ok) return;

    const wish = await response.json();
    addWishToSystem(wish, true); // true = 新愿望，有发射动画
    
    input.value = "";
    input.focus();
  } catch (error) {
    console.error(error);
  } finally {
    setTimeout(() => sendButton.classList.remove("fly"), 600);
  }
};

const handleKey = (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    sendWish();
  }
};

const scheduleMeteor = () => {
  const nextTime = 4000 + Math.random() * 6000;
  setTimeout(() => {
    meteor.classList.add("active");
    setTimeout(() => meteor.classList.remove("active"), 1500);
    scheduleMeteor();
  }, nextTime);
};

// 交互与启动
sendButton.addEventListener("click", sendWish);
input.addEventListener("keydown", handleKey);

// 启动物理循环
updatePhysics();
fetchInit();
scheduleMeteor();
input.focus();