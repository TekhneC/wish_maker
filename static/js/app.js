const messageLayer = document.getElementById("messageLayer");
const meteorLayer = document.getElementById("meteorLayer");
const sendButton = document.getElementById("sendButton");
const wishInput = document.getElementById("wishInput");
const MAX_MESSAGE_LENGTH = 80;
const positions = [];

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function createWishElement(message, isNew) {
  const wish = document.createElement("div");
  wish.className = "wish";
  wish.textContent = message;
  if (!isNew) {
    wish.style.animation = "none";
    wish.style.opacity = "1";
  }
  return wish;
}

function placeWish(wish) {
  const layerRect = messageLayer.getBoundingClientRect();
  const safePadding = 40;
  const bottomPadding = 140;
  const topPadding = 40;
  const x = clamp(
    safePadding + Math.random() * (layerRect.width - safePadding * 2),
    safePadding,
    layerRect.width - safePadding
  );
  const baseY = clamp(
    topPadding + Math.random() * (layerRect.height - topPadding - bottomPadding),
    topPadding,
    layerRect.height - bottomPadding
  );
  let y = baseY;

  const wishRect = { width: 240, height: 40 };
  for (const pos of positions) {
    const overlapX = Math.abs(x - pos.x) < (wishRect.width + pos.width) / 2;
    const overlapY = Math.abs(y - pos.y) < (wishRect.height + pos.height) / 2;
    if (overlapX && overlapY) {
      y = clamp(pos.y - 50, topPadding, layerRect.height - bottomPadding);
    }
  }

  wish.style.left = `${x}px`;
  wish.style.top = `${y}px`;
  positions.push({ x, y, width: wishRect.width, height: wishRect.height });
}

function addWish(message, isNew = false) {
  const wish = createWishElement(message, isNew);
  messageLayer.appendChild(wish);
  placeWish(wish);
}

function sparkAt(button) {
  const spark = document.createElement("span");
  spark.className = "spark";
  const rect = button.getBoundingClientRect();
  spark.style.left = `${rect.left + rect.width / 2}px`;
  spark.style.top = `${rect.top + rect.height / 2}px`;
  document.body.appendChild(spark);
  spark.addEventListener("animationend", () => spark.remove());
}

function sendWish() {
  const message = wishInput.value.trim();
  if (!message) {
    wishInput.focus();
    return;
  }
  if (message.length > MAX_MESSAGE_LENGTH) {
    wishInput.value = message.slice(0, MAX_MESSAGE_LENGTH);
    return;
  }

  sendButton.classList.add("is-firing");
  sparkAt(sendButton);
  setTimeout(() => sendButton.classList.remove("is-firing"), 900);

  fetch("/api/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message }),
  })
    .then((response) => response.json().then((data) => ({ ok: response.ok, data })))
    .then(({ ok, data }) => {
      if (!ok) {
        return;
      }
      addWish(data.message, true);
      wishInput.value = "";
      wishInput.focus();
    })
    .catch(() => {});
}

function loadInitialMessages() {
  fetch("/api/messages?recent=12&random=10")
    .then((response) => response.json())
    .then((data) => {
      const seen = new Set();
      [...data.recent, ...data.random].forEach((item) => {
        if (!seen.has(item.id)) {
          addWish(item.message, false);
          seen.add(item.id);
        }
      });
    })
    .catch(() => {});
}

function spawnMeteor() {
  const meteor = document.createElement("div");
  meteor.className = "meteor";
  const startX = Math.random() * window.innerWidth * 0.6 + window.innerWidth * 0.2;
  const startY = Math.random() * window.innerHeight * 0.3 + 20;
  meteor.style.left = `${startX}px`;
  meteor.style.top = `${startY}px`;
  meteorLayer.appendChild(meteor);
  meteor.addEventListener("animationend", () => meteor.remove());

  const next = Math.random() * 6000 + 5000;
  window.setTimeout(spawnMeteor, next);
}

sendButton.addEventListener("click", sendWish);
wishInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    sendWish();
  }
});

loadInitialMessages();
spawnMeteor();
wishInput.focus();
