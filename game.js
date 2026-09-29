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

// Состояние игры
let player = {
    x: 400, y: 300,
    width: 40, height: 40,
    speed: 3,
    runSpeed: 6,
    strength: 0,
    money: 0,
    stamina: 100,
    maxStamina: 100,
    isExhausted: false,
    color: '#4a90e2' // Синий игрок
};

// Враги/Качки
let npcs = [
    { x: 200, y: 150, w: 50, h: 50, color: '#e2a54a', name: 'Качок 1', face: 1 },
    { x: 600, y: 400, w: 50, h: 50, color: '#e24a4a', name: 'Качок 2', face: 2 },
    { x: 800, y: 200, w: 60, h: 60, color: '#7a4ae2', name: 'Финальный Босс (Ёж)', face: 3, isBoss: true }
];

// Зоны взаимодействия
let zones = [
    { x: 100, y: 400, w: 150, h: 150, type: 'gym', name: 'Зона качалки' },
    { x: 500, y: 100, w: 100, h: 100, type: 'armwrestling', name: 'Стол для армрестлинга' }
];

// Управление
const keys = {};
window.addEventListener('keydown', (e) => {
    keys[e.code] = true;
    if (e.code === 'Space' && minigameUI.classList.contains('hidden') === false) {
        handleMinigameInput();
    }
});
window.addEventListener('keyup', (e) => keys[e.code] = false);

// --- Мини-игра Армрестлинг ---
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
    // Сложность врага
    opponentStrength = opponent.isBoss ? 15 : 8;
    updateTugBar();
    document.getElementById('minigame-title').innerText = `Против: ${opponent.name}`;
}

function handleMinigameInput() {
    if (!isMinigameActive) return;
    
    // Игрок жмет, тянет в свою сторону
    playerTug += 2;
    
    // Враг сопротивляется
    opponentTug += opponentStrength * 0.5;

    // Нормализация
    let total = playerTug + opponentTug;
    let playerPercent = (playerTug / total) * 100;
    
    // Ограничения
    playerPercent = Math.max(0, Math.min(100, playerPercent));
    tugBarFill.style.width = playerPercent + '%';

    // Проверка победы/поражения
    if (playerPercent >= 95) {
        endArmwrestling(true);
    } else if (playerPercent <= 5) {
        endArmwrestling(false);
    }
}

function endArmwrestling(win) {
    isMinigameActive = false;
    minigameUI.classList.add('hidden');
    
    if (win) {
        let reward = currentOpponent.isBoss ? 500 : 100;
        player.money += reward;
        player.strength += currentOpponent.isBoss ? 50 : 10;
        statusMsg.innerText = `Победа! +${reward}$ и +${currentOpponent.isBoss ? 50 : 10} силы.`;
        if (currentOpponent.isBoss) {
            alert("ПОЗДРАВЛЯЕМ! Вы победили Финального Босса и стали самым крутым качком!");
        }
    } else {
        statusMsg.innerText = `Вы проиграли. Нужно больше силы!`;
    }
    updateUI();
}

startMinigameBtn.addEventListener('click', () => {
    if (currentOpponent) {
        startMinigameBtn.style.display = 'none';
        // Небольшая задержка для старта
        setTimeout(() => { 
            statusMsg.innerText = "Жми ПРОБЕЛ!";
        }, 100);
    }
});

function updateTugBar() {
    let total = playerTug + opponentTug;
    let playerPercent = (playerTug / total) * 100;
    tugBarFill.style.width = playerPercent + '%';
}


// --- Основной игровой цикл ---
function update() {
    if (isMinigameActive) return; // Пауза во время армрестлинга

    let dx = 0;
    let dy = 0;
    let isRunning = keys['ShiftLeft'] || keys['ShiftRight'];
    let currentSpeed = player.isExhausted ? player.speed * 0.5 : (isRunning ? player.runSpeed : player.speed);

    // Движение
    if (keys['KeyW'] || keys['ArrowUp']) dy -= 1;
    if (keys['KeyS'] || keys['ArrowDown']) dy += 1;
    if (keys['KeyA'] || keys['ArrowLeft']) dx -= 1;
    if (keys['KeyD'] || keys['ArrowRight']) dx += 1;

    // Нормализация диагонали
    if (dx !== 0 && dy !== 0) {
        dx *= 0.707;
        dy *= 0.707;
    }

    player.x += dx * currentSpeed;
    player.y += dy * currentSpeed;

    // Границы карты
    player.x = Math.max(0, Math.min(canvas.width - player.width, player.x));
    player.y = Math.max(0, Math.min(canvas.height - player.height, player.y));

    // Выносливость
    if (isRunning && (dx !== 0 || dy !== 0)) {
        player.stamina -= 0.5;
        if (player.stamina <= 0) {
            player.stamina = 0;
            player.isExhausted = true;
            statusMsg.innerText = "Вы устали! Идите шагом.";
        }
    } else {
        player.stamina += 0.2;
        if (player.stamina > player.maxStamina) player.stamina = player.maxStamina;
        if (player.stamina > 30) player.isExhausted = false;
    }

    // Взаимодействие с зонами и NPC
    let interactionText = "";
    
    // Проверка зон
    zones.forEach(zone => {
        if (checkCollision(player, zone)) {
            if (zone.type === 'gym') {
                interactionText = "Нажмите [E], чтобы качаться (Стоимость: 10$)";
                if (keys['KeyE']) {
                    if (player.money >= 10) {
                        player.money -= 10;
                        // Сила зависит от выносливости
                        let gain = player.isExhausted ? 1 : 5;
                        player.strength += gain;
                        statusMsg.innerText = `Вы потренировались! +${gain} силы.`;
                        keys['KeyE'] = false; // Сброс, чтобы не спамить
                    } else {
                        statusMsg.innerText = "Недостаточно денег!";
                        keys['KeyE'] = false;
                    }
                }
            } else if (zone.type === 'armwrestling') {
                interactionText = "Нажмите [E], чтобы вызвать на армрестлинг";
                if (keys['KeyE']) {
                    // Ищем ближайшего NPC
                    let closest = npcs[0];
                    let minDist = 9999;
                    npcs.forEach(n => {
                        let dist = Math.hypot(player.x - n.x, player.y - n.y);
                        if (dist < minDist) { minDist = dist; closest = n; }
                    });
                    
                    // Проверка на силу для босса
                    if (closest.isBoss && player.strength < 100) {
                        statusMsg.innerText = "Босс слишком силен! Нужно минимум 100 силы.";
                    } else {
                        startArmwrestling(closest);
                    }
                    keys['KeyE'] = false;
                }
            }
        }
    });

    // Проверка NPC
    npcs.forEach(npc => {
        if (checkCollision(player, npc)) {
            statusMsg.innerText = `${npc.name}: ${npc.isBoss ? 'Я жду тебя, слабак!' : 'Привет, качок!'}`;
        }
    });

    if (interactionText) statusMsg.innerText = interactionText;
    else if (!interactionText && !isMinigameActive) statusMsg.innerText = "";

    // Обновление UI
    updateUI();
}

function checkCollision(r1, r2) {
    return r1.x < r2.x + r2.w &&
           r1.x + r1.width > r2.x &&
           r1.y < r2.y + r2.h &&
           r1.y + r1.height > r2.y;
}

function updateUI() {
    strengthEl.innerText = Math.floor(player.strength);
    moneyEl.innerText = Math.floor(player.money);
    let stPercent = (player.stamina / player.maxStamina) * 100;
    staminaBar.style.width = stPercent + '%';
    if (stPercent < 30) staminaBar.style.backgroundColor = '#ff4444';
    else staminaBar.style.backgroundColor = '#00ff00';
}

// --- Отрисовка ---
function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Сетка зала
    ctx.strokeStyle = '#444';
    ctx.lineWidth = 1;
    for(let i = 0; i < canvas.width; i += 50) {
        ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, canvas.height); ctx.stroke();
    }
    for(let i = 0; i < canvas.height; i += 50) {
        ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(canvas.width, i); ctx.stroke();
    }

    // Зоны
    zones.forEach(z => {
        ctx.fillStyle = z.type === 'gym' ? 'rgba(255, 200, 0, 0.2)' : 'rgba(255, 0, 0, 0.2)';
        ctx.fillRect(z.x, z.y, z.w, z.h);
        ctx.strokeStyle = z.type === 'gym' ? '#ffcc00' : '#ff4444';
        ctx.strokeRect(z.x, z.y, z.w, z.h);
        ctx.fillStyle = '#fff';
        ctx.font = '14px Arial';
        ctx.fillText(z.name, z.x + 10, z.y + 20);
    });

    // NPC
    npcs.forEach(npc => {
        // Тело
        ctx.fillStyle = npc.color;
        ctx.fillRect(npc.x, npc.y, npc.w, npc.h);
        
        // Лицо (Стилизация под фото)
        ctx.fillStyle = '#fff';
        if (npc.face === 1) { // Первое фото (серьезный)
            ctx.fillRect(npc.x + 10, npc.y + 10, 10, 5); // Глаза
            ctx.fillRect(npc.x + 30, npc.y + 10, 10, 5);
            ctx.fillStyle = '#000';
            ctx.fillRect(npc.x + 15, npc.y + 25, 20, 3); // Рот
        } else if (npc.face === 2) { // Второе фото (улыбка)
            ctx.fillRect(npc.x + 10, npc.y + 10, 8, 5); // Глаза
            ctx.fillRect(npc.x + 32, npc.y + 10, 8, 5);
            ctx.beginPath();
            ctx.arc(npc.x + 25, npc.y + 25, 10, 0, Math.PI, false); // Улыбка
            ctx.stroke();
        } else if (npc.face === 3) { // Ёж (Босс)
            // Иглы
            ctx.fillStyle = '#555';
            for(let i=0; i<360; i+=20) {
                let rad = i * Math.PI / 180;
                let ix = npc.x + npc.w/2 + Math.cos(rad) * 35;
                let iy = npc.y + npc.h/2 + Math.sin(rad) * 35;
                ctx.beginPath();
                ctx.moveTo(npc.x + npc.w/2, npc.y + npc.h/2);
                ctx.lineTo(ix, iy);
                ctx.stroke();
            }
            ctx.fillStyle = '#d2b48c'; // Морда
            ctx.beginPath();
            ctx.arc(npc.x + 30, npc.y + 30, 25, 0, Math.PI * 2);
            ctx.fill();
            // Глаза ежа
            ctx.fillStyle = '#fff';
            ctx.beginPath(); ctx.arc(npc.x + 20, npc.y + 20, 8, 0, Math.PI*2); ctx.fill();
            ctx.beginPath(); ctx.arc(npc.x + 40, npc.y + 20, 8, 0, Math.PI*2); ctx.fill();
            ctx.fillStyle = '#000';
            ctx.beginPath(); ctx.arc(npc.x + 20, npc.y + 20, 4, 0, Math.PI*2); ctx.fill();
            ctx.beginPath(); ctx.arc(npc.x + 40, npc.y + 20, 4, 0, Math.PI*2); ctx.fill();
            // Нос
            ctx.beginPath(); ctx.arc(npc.x + 30, npc.y + 35, 5, 0, Math.PI*2); ctx.fill();
        }
        
        // Имя
        ctx.fillStyle = '#fff';
        ctx.font = '12px Arial';
        ctx.fillText(npc.name, npc.x, npc.y - 10);
    });

    // Игрок
    ctx.fillStyle = player.color;
    ctx.fillRect(player.x, player.y, player.width, player.height);
    
    // Глаза игрока
    ctx.fillStyle = '#fff';
    ctx.fillRect(player.x + 8, player.y + 10, 8, 5);
    ctx.fillRect(player.x + 24, player.y + 10, 8, 5);
    ctx.fillStyle = '#000';
    ctx.fillRect(player.x + 10, player.y + 10, 3, 5);
    ctx.fillRect(player.x + 26, player.y + 10, 3, 5);

    // Индикатор усталости над игроком
    if (player.isExhausted) {
        ctx.fillStyle = 'red';
        ctx.font = '20px Arial';
        ctx.fillText('💀', player.x + 10, player.y - 10);
    }
}

// Игровой цикл
function gameLoop() {
    update();
    draw();
    requestAnimationFrame(gameLoop);
}

gameLoop();

// Ресайз окна
window.addEventListener('resize', () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
});