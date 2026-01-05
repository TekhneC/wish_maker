const wishLayer = document.getElementById("wish-layer");
const input = document.getElementById("wish-input");
const sendButton = document.getElementById("send-button");
const meteor = document.querySelector(".meteor");

const MAX_WISHES = 28;
const RECENT_LIMIT = 10;
const RANDOM_LIMIT = 12;
const PLACED_WISHES = [];

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const getBounds = () => {
  const padding = 40;
  const inputBar = document.querySelector(".input-bar");
  const inputRect = inputBar.getBoundingClientRect();
  return {
    minX: padding,
    maxX: window.innerWidth - padding,
    minY: padding,
    maxY: inputRect.top - 60,
  };
};

const findPosition = (width, height) => {
  const bounds = getBounds();
  let x = bounds.minX + Math.random() * (bounds.maxX - bounds.minX - width);
  let y = bounds.minY + Math.random() * (bounds.maxY - bounds.minY - height);

  for (let i = 0; i < 14; i += 1) {
    const overlap = PLACED_WISHES.some((item) => {
      const xOverlap = x < item.x + item.width + 14 && x + width > item.x - 14;
      const yOverlap = y < item.y + item.height + 10 && y + height > item.y - 10;
      return xOverlap && yOverlap;
    });
    if (!overlap) {
      return { x, y };
    }
    x = clamp(x + (Math.random() > 0.5 ? 30 : -30), bounds.minX, bounds.maxX - width);
    y = clamp(y - 24, bounds.minY, bounds.maxY - height);
  }
  return { x, y };
};

const addWish = async (wish, shouldRise = true) => {
  const element = document.createElement("div");
  element.className = "wish";
  element.textContent = wish.text;

  wishLayer.appendChild(element);
  const rect = element.getBoundingClientRect();
  const { x, y } = findPosition(rect.width, rect.height);
  element.style.left = `${x}px`;
  element.style.top = `${y}px`;

  PLACED_WISHES.push({ id: wish.id, x, y, width: rect.width, height: rect.height });
  if (PLACED_WISHES.length > MAX_WISHES) {
    PLACED_WISHES.shift();
    if (wishLayer.firstChild) {
      wishLayer.removeChild(wishLayer.firstChild);
    }
  }

  if (!shouldRise) {
    element.style.opacity = "1";
    element.style.transform = "translateY(0)";
    element.classList.add("float");
    return;
  }

  await sleep(1200);
  element.classList.add("float");
};

const fetchInit = async () => {
  try {
    const response = await fetch(`/api/init?recent_limit=${RECENT_LIMIT}&random_limit=${RANDOM_LIMIT}`);
    if (!response.ok) return;
    const data = await response.json();
    const recent = data.recent || [];
    const random = data.random || [];

    [...recent, ...random].forEach((wish) => {
      addWish(wish, false);
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
  await sleep(300);
  try {
    const response = await fetch("/api/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });

    if (!response.ok) {
      return;
    }

    const wish = await response.json();
    addWish(wish, true);
    input.value = "";
    input.focus();
  } catch (error) {
    console.error(error);
  } finally {
    setTimeout(() => sendButton.classList.remove("fly"), 700);
  }
};

const handleKey = (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    sendWish();
  }
};

const scheduleMeteor = () => {
  const nextTime = 3000 + Math.random() * 5000;
  setTimeout(() => {
    meteor.classList.add("active");
    setTimeout(() => meteor.classList.remove("active"), 1600);
    scheduleMeteor();
  }, nextTime);
};

sendButton.addEventListener("click", sendWish);
input.addEventListener("keydown", handleKey);

fetchInit();
scheduleMeteor();
input.focus();
