const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// UI элементы
const strengthEl = document.getElementById('strength');
const moneyEl = document.getElementById('money');
const staminaBar = document.getElementById('stamina-bar');
const statusMsg = document.getElementById('status-message');
const minigameUI = document.getElementById('minigame-ui');
const startMinigameBtn = document.getElementById('start-minigame-btn');
const tugBarFill = document.getElementById('tug-bar-fill');

// Размеры
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

// --- ЗАГРУЗКА ВАШИХ ФОТО ---
// Имена файлов точно как в вашем репозитории
const imageSources = {
    face1: '20260929_120903.jpg', 
    face2: '20260929_120911.jpg',
    face3: 'Screenshot_20260928_...jpg' // Вставьте точное название скриншота ежа
};

const images = {};
let imagesLoaded = 0;
const totalImages = Object.keys(imageSources).length;

for (let key in imageSources) {
    images[key] = new Image();
    images[key].src = imageSources[key];
    images[key].onload = () => {
        imagesLoaded++;
        if (imagesLoaded === totalImages) {
            console.log("Все фото загружены!");
        }
    };
    images[key].onerror = () => console.error("Ошибка загрузки: " + imageSources[key]);
}

// Состояние игры
let player = {
    x: 400, y: 300,
    width: 40, height: 40,
    speed: 3,
    runSpeed: 6,
    strength: 0,
    money: 100, // Дадим немного денег на старт
    stamina: 100,
    maxStamina: 100,
    isExhausted: false,
    color: '#4a90e2'
};

// NPC (Качки)
let npcs = [
    { x: 200, y: 150, w: 60, h: 60, name: 'Качок 1', imgKey: 'face1' },
    { x: 600, y: 400, w: 60, h: 60, name: 'Качок 2', imgKey: 'face2' },
    { x: 800, y: 200, w: 80, h: 80, name: 'Финальный Босс (Ёж)', imgKey: 'face3', isBoss: true }
];

// Зоны
let zones = [
    { x: 100, y: 400, w: 150, h: 150, type: 'gym', name: 'Зона качалки' },
    { x: 500, y: 100, w: 120, h: 120, type: 'armwrestling', name: 'Стол для армрестлинга' }
];

// Управление
const keys = {};
window.addEventListener('keydown', (e) => {
    keys[e.code] = true;
    if (e.code === 'Space' && isMinigameActive) handleMinigameInput();
});

// Мобильное управление (виртуальный джойстик)
let touchStartX = 0, touchStartY = 0;
let touchMoveX = 0, touchMoveY = 0;

canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
});

canvas.addEventListener('touchmove', (e) => {
    e.preventDefault();
    touchMoveX = e.touches[0].clientX - touchStartX;
    touchMoveY = e.touches[0].clientY - touchStartY;
    
    // Нормализация
    let dist = Math.hypot(touchMoveX, touchMoveY);
    if (dist > 50) dist = 50;
    touchMoveX = (touchMoveX / dist) * 50;
    touchMoveY = (touchMoveY / dist) * 50;
});

canvas.addEventListener('touchend', () => {
    touchMoveX = 0; touchMoveY = 0;
});

window.addEventListener('keyup', (e) => keys[e.code] = false);

// Мини-игра
let isMinigameActive = false;
let opponentStrength = 0;
let playerTug = 50;
let opponentTug = 50;
let currentOpponent = null;

function startArmwrestling(opponent) {
    currentOpponent = opponent;
    minigameUI.classList.remove('hidden');
    isMinigameActive = true;
    playerTug = 50;
    opponentTug = 50;
    opponentStrength = opponent.isBoss ? 12 : 6; // Ёж сложнее
    updateTugBar();
    document.getElementById('minigame-title').innerText = `Против: ${opponent.name}`;
}

function handleMinigameInput() {
    if (!isMinigameActive) return;
    playerTug += 1.5; // Игрок жмет
    opponentTug += opponentStrength * 0.4; // Враг тянет

    let total = playerTug + opponentTug;
    let playerPercent = (playerTug / total) * 100;
    playerPercent = Math.max(0, Math.min(100, playerPercent));
    tugBarFill.style.width = playerPercent + '%';

    if (playerPercent >= 95) endArmwrestling(true);
    else if (playerPercent <= 5) endArmwrestling(false);
}

function endArmwrestling(win) {
    isMinigameActive = false;
    minigameUI.classList.add('hidden');
    
    if (win) {
        let reward = currentOpponent.isBoss ? 1000 : 150;
        player.money += reward;
        player.strength += currentOpponent.isBoss ? 100 : 15;
        statusMsg.innerText = `Победа! +${reward}$ и +${currentOpponent.isBoss ? 100 : 15} силы.`;
        if (currentOpponent.isBoss) alert("ПОЗДРАВЛЯЕМ! Вы победили Финального Босса!");
    } else {
        statusMsg.innerText = `Вы проиграли. Нужно больше силы!`;
    }
    updateUI();
}

startMinigameBtn.addEventListener('click', () => {
    if (currentOpponent) {
        startMinigameBtn.style.display = 'none';
        setTimeout(() => { statusMsg.innerText = "Жми ПРОБЕЛ или ТАПАЙ!"; }, 100);
    }
});

function updateTugBar() {
    let total = playerTug + opponentTug;
    tugBarFill.style.width = ((playerTug / total) * 100) + '%';
}

// --- ИГРОВОЙ ЦИКЛ ---
function update() {
    if (isMinigameActive) return;

    let dx = 0, dy = 0;
    let isRunning = keys['ShiftLeft'] || keys['ShiftRight'];
    
    // Клавиатура
    if (keys['KeyW'] || keys['ArrowUp']) dy -= 1;
    if (keys['KeyS'] || keys['ArrowDown']) dy += 1;
    if (keys['KeyA'] || keys['ArrowLeft']) dx -= 1;
    if (keys['KeyD'] || keys['ArrowRight']) dx += 1;

    // Тач-управление
    if (Math.abs(touchMoveX) > 10 || Math.abs(touchMoveY) > 10) {
        dx = touchMoveX / 50;
        dy = touchMoveY / 50;
        isRunning = Math.abs(touchMoveX) > 40 || Math.abs(touchMoveY) > 40; // Автобег при сильном свайпе
    }

    // Нормализация
    if (dx !== 0 && dy !== 0) { dx *= 0.707; dy *= 0.707; }

    let currentSpeed = player.isExhausted ? player.speed * 0.5 : (isRunning ? player.runSpeed : player.speed);
    player.x += dx * currentSpeed;
    player.y += dy * currentSpeed;

    // Границы
    player.x = Math.max(0, Math.min(canvas.width - player.width, player.x));
    player.y = Math.max(0, Math.min(canvas.height - player.height, player.y));

    // Выносливость
    if (isRunning && (dx !== 0 || dy !== 0)) {
        player.stamina -= 0.5;
        if (player.stamina <= 0) { player.stamina = 0; player.isExhausted = true; statusMsg.innerText = "Вы устали!"; }
    } else {
        player.stamina += 0.2;
        if (player.stamina > player.maxStamina) player.stamina = player.maxStamina;
        if (player.stamina > 30) player.isExhausted = false;
    }

    // Взаимодействие
    let interactionText = "";
    zones.forEach(zone => {
        if (checkCollision(player, zone)) {
            if (zone.type === 'gym') {
                interactionText = "Жми [E] чтобы качаться (-10$)";
                if (keys['KeyE']) {
                    if (player.money >= 10) {
                        player.money -= 10;
                        player.strength += player.isExhausted ? 1 : 5;
                        statusMsg.innerText = `Тренировка! +${player.isExhausted ? 1 : 5} силы.`;
                        keys['KeyE'] = false;
                    } else { statusMsg.innerText = "Мало денег!"; keys['KeyE'] = false; }
                }
            } else if (zone.type === 'armwrestling') {
                interactionText = "Жми [E] чтобы вызвать на армрестлинг";
                if (keys['KeyE']) {
                    let closest = npcs[0]; let minDist = 9999;
                    npcs.forEach(n => { let dist = Math.hypot(player.x - n.x, player.y - n.y); if (dist < minDist) { minDist = dist; closest = n; } });
                    if (closest.isBoss && player.strength < 100) statusMsg.innerText = "Босс слишком силен! Нужно 100+ силы.";
                    else startArmwrestling(closest);
                    keys['KeyE'] = false;
                }
            }
        }
    });

    npcs.forEach(npc => {
        if (checkCollision(player, npc)) statusMsg.innerText = `${npc.name}: ${npc.isBoss ? 'Я жду тебя!' : 'Привет!'}`;
    });

    if (interactionText) statusMsg.innerText = interactionText;
    updateUI();
}

function checkCollision(r1, r2) {
    return r1.x < r2.x + r2.w && r1.x + r1.width > r2.x && r1.y < r2.y + r2.h && r1.y + r1.height > r2.y;
}

function updateUI() {
    strengthEl.innerText = Math.floor(player.strength);
    moneyEl.innerText = Math.floor(player.money);
    let stPercent = (player.stamina / player.maxStamina) * 100;
    staminaBar.style.width = stPercent + '%';
    staminaBar.style.backgroundColor = stPercent < 30 ? '#ff4444' : '#00ff00';
}

// --- ОТРИСОВКА ---
function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Сетка
    ctx.strokeStyle = '#444'; ctx.lineWidth = 1;
    for(let i = 0; i < canvas.width; i += 50) { ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, canvas.height); ctx.stroke(); }
    for(let i = 0; i < canvas.height; i += 50) { ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(canvas.width, i); ctx.stroke(); }

    // Зоны
    zones.forEach(z => {
        ctx.fillStyle = z.type === 'gym' ? 'rgba(255, 200, 0, 0.2)' : 'rgba(255, 0, 0, 0.2)';
        ctx.fillRect(z.x, z.y, z.w, z.h);
        ctx.strokeStyle = z.type === 'gym' ? '#ffcc00' : '#ff4444';
        ctx.strokeRect(z.x, z.y, z.w, z.h);
        ctx.fillStyle = '#fff'; ctx.font = '14px Arial';
        ctx.fillText(z.name, z.x + 10, z.y + 20);
    });

    // NPC
    npcs.forEach(npc => {
        // Если картинка загружена - рисуем её
        if (images[npc.imgKey] && images[npc.imgKey].complete) {
            ctx.save();
            // Круглая маска для фото
            ctx.beginPath();
            ctx.arc(npc.x + npc.w/2, npc.y + npc.h/2, npc.w/2, 0, Math.PI * 2);
            ctx.clip();
            ctx.drawImage(images[npc.imgKey], npc.x, npc.y, npc.w, npc.h);
            ctx.restore();
            
            // Обводка
            ctx.strokeStyle = npc.isBoss ? '#ff0000' : '#fff';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(npc.x + npc.w/2, npc.y + npc.h/2, npc.w/2, 0, Math.PI * 2);
            ctx.stroke();
        } else {
            // Заглушка, если фото не загрузилось
            ctx.fillStyle = '#888';
            ctx.fillRect(npc.x, npc.y, npc.w, npc.h);
            ctx.fillStyle = '#fff';
            ctx.font = '10px Arial';
            ctx.fillText('Загрузка...', npc.x, npc.y + 20);
        }
        
        // Имя
        ctx.fillStyle = '#fff'; ctx.font = 'bold 14px Arial'; ctx.textAlign = 'center';
        ctx.fillText(npc.name, npc.x + npc.w/2, npc.y - 10);
        ctx.textAlign = 'left';
    });

    // Игрок
    ctx.fillStyle = player.color;
    ctx.fillRect(player.x, player.y, player.width, player.height);
    ctx.fillStyle = '#fff';
    ctx.fillRect(player.x + 8, player.y + 10, 8, 5);
    ctx.fillRect(player.x + 24, player.y + 10, 8, 5);
    ctx.fillStyle = '#000';
    ctx.fillRect(player.x + 10, player.y + 10, 3, 5);
    ctx.fillRect(player.x + 26, player.y + 10, 3, 5);

    if (player.isExhausted) {
        ctx.fillStyle = 'red'; ctx.font = '20px Arial';
        ctx.fillText('💀', player.x + 10, player.y - 10);
    }
}

function gameLoop() {
    update();
    draw();
    requestAnimationFrame(gameLoop);
}

// Ресайз
window.addEventListener('resize', () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
});

gameLoop();