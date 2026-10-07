/* ============================================================
   BRAWL STARS КЛОН — ПОЛНЫЙ JAVASCRIPT
   Игровая логика, ИИ, физика, рендеринг, эффекты
   ============================================================ */

'use strict';

/* ============================================================
   1. КОНФИГУРАЦИЯ И КОНСТАНТЫ
   ============================================================ */
const CONFIG = Object.freeze({
  // Карта
  MAP_WIDTH: 2000,
  MAP_HEIGHT: 2000,
  TILE_SIZE: 100,

  // Игрок
  PLAYER_RADIUS: 28,
  PLAYER_SPEED: 5.2,
  MAX_HP: 120,

  // Снаряды
  PROJECTILE_SPEED: 11,
  PROJECTILE_RADIUS: 10,
  PROJECTILE_DAMAGE: 22,
  PROJECTILE_LIFETIME: 55,
  ATTACK_COOLDOWN: 28,

  // Супер
  SUPER_COOLDOWN: 240,
  SUPER_DAMAGE: 60,
  SUPER_RADIUS: 160,

  // Враги
  ENEMY_COUNT: 2,
  ENEMY_SPEED: 3.6,
  ENEMY_ATTACK_COOLDOWN: 55,
  ENEMY_PROJECTILE_DAMAGE: 16,
  ENEMY_DETECTION_RANGE: 600,

  // Матч
  RESPAWN_TIME: 180,
  MATCH_DURATION: 150,
  KILL_SCORE: 1,
  SCORE_TO_WIN: 10,

  // Производительность
  MAX_PARTICLES: 500,
  TARGET_FPS: 60,
  FRAME_TIME: 1000 / 60,
});

/* ============================================================
   2. СОСТОЯНИЕ ИГРЫ
   ============================================================ */
const state = {
  running: true,
  paused: false,
  gameOver: false,
  winner: null,
  timer: CONFIG.MATCH_DURATION,
  scoreBlue: 0,
  scoreRed: 0,
  frame: 0,
  entities: [],
  projectiles: [],
  particles: [],
  damageNumbers: [],
  walls: [],
  obstacles: [],
  effects: [],
  camera: { x: 0, y: 0, shake: 0, targetShake: 0 },
  player: null,
  enemies: [],
  input: {
    joystickActive: false,
    joystickAngle: 0,
    joystickIntensity: 0,
    attackPressed: false,
    superPressed: false,
    keys: {},
  },
  stats: {
    totalKills: 0,
    totalDeaths: 0,
    damageDealt: 0,
    damageTaken: 0,
    superUsed: 0,
    shotsFired: 0,
  },
};

/* ============================================================
   3. УТИЛИТЫ
   ============================================================ */
const Utils = {
  dist(x1, y1, x2, y2) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    return Math.sqrt(dx * dx + dy * dy);
  },

  distSq(x1, y1, x2, y2) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    return dx * dx + dy * dy;
  },

  angle(x1, y1, x2, y2) {
    return Math.atan2(y2 - y1, x2 - x1);
  },

  clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
  },

  lerp(a, b, t) {
    return a + (b - a) * t;
  },

  rand(min, max) {
    return Math.random() * (max - min) + min;
  },

  randInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  },

  randAngle() {
    return Math.random() * Math.PI * 2;
  },

  circleCollision(x1, y1, r1, x2, y2, r2) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const rSum = r1 + r2;
    return dx * dx + dy * dy < rSum * rSum;
  },

  circleRectCollision(cx, cy, cr, rx, ry, rw, rh) {
    const closestX = Utils.clamp(cx, rx, rx + rw);
    const closestY = Utils.clamp(cy, ry, ry + rh);
    const dx = cx - closestX;
    const dy = cy - closestY;
    return dx * dx + dy * dy < cr * cr;
  },

  formatTime(seconds) {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  },

  easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
  },

  easeInOutQuad(t) {
    return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  },

  // Нормализация угла в диапазон [-PI, PI]
  normalizeAngle(a) {
    while (a > Math.PI) a -= Math.PI * 2;
    while (a < -Math.PI) a += Math.PI * 2;
    return a;
  },

  // Плавный поворот к целевому углу
  rotateTowards(current, target, speed) {
    const diff = Utils.normalizeAngle(target - current);
    return current + diff * Utils.clamp(speed, 0, 1);
  },
};

/* ============================================================
   4. КЛАСС ИГРОКА (универсальный для игрока и ботов)
   ============================================================ */
class Player {
  constructor(x, y, team, isBot = false, name = '') {
    this.x = x;
    this.y = y;
    this.startX = x;
    this.startY = y;
    this.team = team;
    this.isBot = isBot;
    this.name = name || (isBot ? `Враг ${Utils.randInt(1, 9)}` : 'Ты');

    this.radius = CONFIG.PLAYER_RADIUS;
    this.hp = CONFIG.MAX_HP;
    this.maxHp = CONFIG.MAX_HP;
    this.speed = isBot ? CONFIG.ENEMY_SPEED : CONFIG.PLAYER_SPEED;

    this.alive = true;
    this.respawnTimer = 0;
    this.attackCooldown = 0;
    this.superCooldown = 0;
    this.superReady = false;

    this.kills = 0;
    this.deaths = 0;

    this.angle = team === 'blue' ? 0 : Math.PI;
    this.targetAngle = this.angle;
    this.moving = false;
    this.hitFlash = 0;
    this.invulnerable = 0;

    // Для ИИ
    this.aiState = 'idle';
    this.aiTimer = 0;
    this.aiTarget = null;
    this.strafeDir = 1;
    this.lastKnownTargetPos = null;
    this.aimError = Utils.rand(-0.15, 0.15);
  }

  /* ---------- ОБНОВЛЕНИЕ ---------- */
  update(dt) {
    if (!this.alive) {
      this.respawnTimer -= dt;
      if (this.respawnTimer <= 0) {
        this.respawn();
      }
      return;
    }

    // Тик кулдаунов
    if (this.attackCooldown > 0) this.attackCooldown -= dt;
    if (this.superCooldown > 0) {
      this.superCooldown -= dt;
      if (this.superCooldown <= 0) {
        this.superReady = true;
        this.onSuperReady();
      }
    }
    if (this.hitFlash > 0) this.hitFlash -= dt;
    if (this.invulnerable > 0) this.invulnerable -= dt;

    // Логика движения
    let moveX = 0;
    let moveY = 0;

    if (this.isBot) {
      const ai = this.updateAI(dt);
      moveX = ai.moveX;
      moveY = ai.moveY;
    } else {
      const input = this.getPlayerInput();
      moveX = input.moveX;
      moveY = input.moveY;
    }

    // Нормализация вектора движения
    const mag = Math.hypot(moveX, moveY);
    if (mag > 0) {
      moveX /= mag;
      moveY /= mag;
      this.moving = true;
      if (!this.isBot) {
        this.targetAngle = Math.atan2(moveY, moveX);
      }
    } else {
      this.moving = false;
    }

    // Применение движения
    const nx = this.x + moveX * this.speed * dt;
    const ny = this.y + moveY * this.speed * dt;
    this.tryMove(nx, ny);

    // Плавный поворот
    const rotSpeed = this.isBot ? 0.12 * dt : 0.2 * dt;
    this.angle = Utils.rotateTowards(this.angle, this.targetAngle, rotSpeed);

    // Границы карты
    this.x = Utils.clamp(this.x, this.radius, CONFIG.MAP_WIDTH - this.radius);
    this.y = Utils.clamp(this.y, this.radius, CONFIG.MAP_HEIGHT - this.radius);
  }

  /* ---------- ВВОД ИГРОКА ---------- */
  getPlayerInput() {
    let moveX = 0;
    let moveY = 0;
    const input = state.input;

    if (input.joystickActive && input.joystickIntensity > 0.1) {
      moveX += Math.cos(input.joystickAngle) * input.joystickIntensity;
      moveY += Math.sin(input.joystickAngle) * input.joystickIntensity;
    }

    if (input.keys['w'] || input.keys['arrowup']) moveY -= 1;
    if (input.keys['s'] || input.keys['arrowdown']) moveY += 1;
    if (input.keys['a'] || input.keys['arrowleft']) moveX -= 1;
    if (input.keys['d'] || input.keys['arrowright']) moveX += 1;

    return { moveX, moveY };
  }

  /* ---------- ИИ ---------- */
  updateAI(dt) {
    this.aiTimer -= dt;

    // Поиск цели
    const target = this.findNearestEnemy();
    if (!target) {
      // Патрулирование
      if (this.aiTimer <= 0) {
        this.aiTimer = Utils.rand(60, 120);
        this.targetAngle = Utils.randAngle();
      }
      return {
        moveX: Math.cos(this.angle) * 0.4,
        moveY: Math.sin(this.angle) * 0.4,
      };
    }

    this.aiTarget = target;
    const dist = Utils.dist(this.x, this.y, target.x, target.y);
    const angleToTarget = Utils.angle(this.x, this.y, target.x, target.y);

    // Предсказание позиции цели (упреждение)
    const leadTime = dist / CONFIG.PROJECTILE_SPEED;
    const predictedX = target.x + Math.cos(target.angle) * target.speed * leadTime;
    const predictedY = target.y + Math.sin(target.angle) * target.speed * leadTime;
    const aimAngle = Utils.angle(this.x, this.y, predictedX, predictedY);

    this.targetAngle = angleToTarget + this.aimError;
    this.aimError = Utils.lerp(this.aimError, Utils.rand(-0.1, 0.1), 0.05 * dt);

    let moveX = 0;
    let moveY = 0;

    // Разные тактики в зависимости от расстояния
    if (dist > 450) {
      // Далеко — приближаемся
      moveX = Math.cos(angleToTarget);
      moveY = Math.sin(angleToTarget);
    } else if (dist < 180) {
      // Слишком близко — отступаем
      moveX = -Math.cos(angleToTarget) * 0.8;
      moveY = -Math.sin(angleToTarget) * 0.8;
    } else {
      // Оптимальная зона — стрейфим
      if (this.aiTimer <= 0) {
        this.aiTimer = Utils.rand(60, 120);
        this.strafeDir *= -1;
      }
      const strafeAngle = angleToTarget + Math.PI / 2 * this.strafeDir;
      moveX = Math.cos(strafeAngle) * 0.7 + Math.cos(angleToTarget) * 0.2;
      moveY = Math.sin(strafeAngle) * 0.7 + Math.sin(angleToTarget) * 0.2;
    }

    // Избегание стен
    const avoid = this.avoidWalls();
    moveX += avoid.x * 0.6;
    moveY += avoid.y * 0.6;

    // Стрельба
    if (dist < CONFIG.ENEMY_DETECTION_RANGE && this.attackCooldown <= 0) {
      // Проверка линии огня (не стреляем в стену)
      if (this.hasLineOfSight(target)) {
        this.shoot(aimAngle);
        this.attackCooldown = CONFIG.ENEMY_ATTACK_COOLDOWN + Utils.randInt(-8, 8);
      }
    }

    // Супер-способность
    if (this.superReady && dist < CONFIG.SUPER_RADIUS * 0.85) {
      this.useSuper();
    }

    return { moveX, moveY };
  }

  /* ---------- ИЗБЕГАНИЕ СТЕН ---------- */
  avoidWalls() {
    let avoidX = 0;
    let avoidY = 0;
    const lookAhead = 80;

    for (const wall of state.walls) {
      const closestX = Utils.clamp(this.x, wall.x, wall.x + wall.w);
      const closestY = Utils.clamp(this.y, wall.y, wall.y + wall.h);
      const dist = Utils.dist(this.x, this.y, closestX, closestY);

      if (dist < lookAhead && dist > 0) {
        const strength = (lookAhead - dist) / lookAhead;
        avoidX += (this.x - closestX) / dist * strength;
        avoidY += (this.y - closestY) / dist * strength;
      }
    }

    return { x: avoidX, y: avoidY };
  }

  /* ---------- ПРОВЕРКА ЛИНИИ ОГНЯ ---------- */
  hasLineOfSight(target) {
    const steps = 12;
    const dx = (target.x - this.x) / steps;
    const dy = (target.y - this.y) / steps;

    for (let i = 1; i < steps; i++) {
      const px = this.x + dx * i;
      const py = this.y + dy * i;
      for (const wall of state.walls) {
        if (Utils.circleRectCollision(px, py, 2, wall.x, wall.y, wall.w, wall.h)) {
          return false;
        }
      }
    }
    return true;
  }

  /* ---------- ПОИСК ЦЕЛИ ---------- */
  findNearestEnemy() {
    let closest = null;
    let closestDistSq = Infinity;

    for (const entity of state.entities) {
      if (entity === this || entity.team === this.team || !entity.alive) continue;
      const d = Utils.distSq(this.x, this.y, entity.x, entity.y);
      if (d < closestDistSq) {
        closestDistSq = d;
        closest = entity;
      }
    }
    return closest;
  }

  /* ---------- ДВИЖЕНИЕ С КОЛЛИЗИЯМИ ---------- */
  tryMove(newX, newY) {
    let canMoveX = true;
    let canMoveY = true;

    for (const wall of state.walls) {
      if (Utils.circleRectCollision(newX, this.y, this.radius, wall.x, wall.y, wall.w, wall.h)) {
        canMoveX = false;
      }
      if (Utils.circleRectCollision(this.x, newY, this.radius, wall.x, wall.y, wall.w, wall.h)) {
        canMoveY = false;
      }
    }

    if (canMoveX) this.x = newX;
    if (canMoveY) this.y = newY;
  }

  /* ---------- ВЫСТРЕЛ ---------- */
  shoot(angle) {
    if (!this.alive) return;

    const spawnDist = this.radius + 8;
    const px = this.x + Math.cos(angle) * spawnDist;
    const py = this.y + Math.sin(angle) * spawnDist;

    const damage = this.isBot ? CONFIG.ENEMY_PROJECTILE_DAMAGE : CONFIG.PROJECTILE_DAMAGE;

    const proj = new Projectile(px, py, angle, damage, this.team, this);
    state.projectiles.push(proj);

    // Отдача
    this.x -= Math.cos(angle) * 2;
    this.y -= Math.sin(angle) * 2;

    // Частицы выстрела
    this.spawnMuzzleFlash(px, py, angle);

    if (!this.isBot) {
      state.stats.shotsFired++;
      // Тряска камеры при выстреле
      state.camera.targetShake = Math.min(state.camera.targetShake + 2, 6);
    }
  }

  spawnMuzzleFlash(x, y, angle) {
    const color = this.team === 'blue' ? '#6bb3ff' : '#ff8a95';
    for (let i = 0; i < 6; i++) {
      const a = angle + Utils.rand(-0.5, 0.5);
      const spd = Utils.rand(2, 5);
      state.particles.push(new Particle(
        x, y,
        Math.cos(a) * spd,
        Math.sin(a) * spd,
        color,
        Utils.rand(4, 8),
        Utils.rand(10, 18)
      ));
    }
  }

  /* ---------- СУПЕР-СПОСОБНОСТЬ ---------- */
  useSuper() {
    if (!this.superReady || !this.alive) return;

    this.superReady = false;
    this.superCooldown = CONFIG.SUPER_COOLDOWN;

    const radius = CONFIG.SUPER_RADIUS;

    // Урон по всем врагам в радиусе
    for (const entity of state.entities) {
      if (entity === this || entity.team === this.team || !entity.alive) continue;
      const d = Utils.dist(this.x, this.y, entity.x, entity.y);
      if (d < radius) {
        const falloff = 1 - (d / radius) * 0.4;
        entity.takeDamage(CONFIG.SUPER_DAMAGE * falloff, this);
      }
    }

    // Визуальный эффект
    state.effects.push({
      type: 'superExplosion',
      x: this.x,
      y: this.y,
      radius: 0,
      maxRadius: radius,
      alpha: 1,
      life: 30,
      maxLife: 30,
    });

    // Волна частиц
    for (let i = 0; i < 40; i++) {
      const a = (i / 40) * Math.PI * 2;
      const spd = Utils.rand(6, 12);
      state.particles.push(new Particle(
        this.x, this.y,
        Math.cos(a) * spd,
        Math.sin(a) * spd,
        '#f5c542',
        Utils.rand(6, 14),
        Utils.rand(25, 45)
      ));
    }

    if (!this.isBot) {
      state.stats.superUsed++;
      state.camera.targetShake = 15;
    }
  }

  onSuperReady() {
    // Визуальный отклик при готовности супера
    if (!this.isBot) {
      // Можно добавить вибрацию
      if (navigator.vibrate) {
        navigator.vibrate(30);
      }
    }
  }

  /* ---------- ПОЛУЧЕНИЕ УРОНА ---------- */
  takeDamage(amount, source) {
    if (!this.alive || this.invulnerable > 0) return;

    this.hp -= amount;
    this.hitFlash = 0.2;

    // Частицы урона
    for (let i = 0; i < 8; i++) {
      const a = Utils.randAngle();
      const spd = Utils.rand(2, 5);
      state.particles.push(new Particle(
        this.x, this.y,
        Math.cos(a) * spd,
        Math.sin(a) * spd,
        '#ff4d5e',
        Utils.rand(4, 8),
        Utils.rand(15, 25)
      ));
    }

    // Цифра урона
    state.damageNumbers.push({
      x: this.x + Utils.rand(-10, 10),
      y: this.y - 20,
      value: Math.round(amount),
      life: 40,
      maxLife: 40,
      vx: Utils.rand(-0.5, 0.5),
      vy: -1.5,
      color: source && source.team === 'blue' ? '#6bb3ff' : '#ff8a95',
    });

    // Статистика
    if (this === state.player) {
      state.stats.damageTaken += amount;
      state.camera.targetShake = Math.min(state.camera.targetShake + 5, 10);
      // Вспышка экрана
      triggerDamageFlash();
    }
    if (source === state.player) {
      state.stats.damageDealt += amount;
    }

    if (this.hp <= 0) {
      this.die(source);
    }
  }

  /* ---------- СМЕРТЬ ---------- */
  die(killer) {
    if (!this.alive) return;

    this.alive = false;
    this.hp = 0;
    this.deaths++;
    this.respawnTimer = CONFIG.RESPAWN_TIME;

    // Очки убийце
    if (killer && killer !== this) {
      killer.kills++;

      if (killer.team === 'blue') {
        state.scoreBlue += CONFIG.KILL_SCORE;
        updateScoreDisplay('blue');
      } else {
        state.scoreRed += CONFIG.KILL_SCORE;
        updateScoreDisplay('red');
      }

      addKillFeed(killer.name, this.name);
    }

    // Статистика
    if (this === state.player) {
      state.stats.totalDeaths++;
      state.camera.targetShake = 12;
    }
    if (killer === state.player) {
      state.stats.totalKills++;
    }

    // Эффект смерти
    for (let i = 0; i < 25; i++) {
      const a = Utils.randAngle();
      const spd = Utils.rand(2, 8);
      state.particles.push(new Particle(
        this.x, this.y,
        Math.cos(a) * spd,
        Math.sin(a) * spd,
        this.team === 'blue' ? '#3b8cff' : '#ff4d5e',
        Utils.rand(6, 12),
        Utils.rand(25, 50)
      ));
    }

    state.effects.push({
      type: 'deathExplosion',
      x: this.x,
      y: this.y,
      radius: 0,
      maxRadius: 80,
      alpha: 1,
      life: 25,
      maxLife: 25,
    });
  }

  /* ---------- РЕСПАВН ---------- */
  respawn() {
    this.alive = true;
    this.hp = this.maxHp;
    this.x = this.startX;
    this.y = this.startY;
    this.hitFlash = 0;
    this.attackCooldown = 0;
    this.invulnerable = 60; // 1 сек неуязвимости

    // Эффект респавна
    for (let i = 0; i < 20; i++) {
      const a = Utils.randAngle();
      const r = Utils.rand(20, 60);
      state.particles.push(new Particle(
        this.x + Math.cos(a) * r,
        this.y + Math.sin(a) * r,
        -Math.cos(a) * 2,
        -Math.sin(a) * 2,
        '#ffffff',
        Utils.rand(3, 7),
        Utils.rand(20, 40)
      ));
    }

    state.effects.push({
      type: 'respawnPulse',
      x: this.x,
      y: this.y,
      radius: 80,
      maxRadius: 0,
      alpha: 1,
      life: 20,
      maxLife: 20,
    });
  }
}

/* ============================================================
   5. КЛАСС СНАРЯДА
   ============================================================ */
class Projectile {
  constructor(x, y, angle, damage, team, owner) {
    this.x = x;
    this.y = y;
    this.vx = Math.cos(angle) * CONFIG.PROJECTILE_SPEED;
    this.vy = Math.sin(angle) * CONFIG.PROJECTILE_SPEED;
    this.radius = CONFIG.PROJECTILE_RADIUS;
    this.damage = damage;
    this.team = team;
    this.owner = owner;
    this.angle = angle;
    this.life = CONFIG.PROJECTILE_LIFETIME;
    this.alive = true;
    this.trail = [];
    this.hue = team === 'blue' ? 210 : 350;
  }

  update() {
    if (!this.alive) return;

    // Движение
    this.x += this.vx;
    this.y += this.vy;
    this.life--;

    // Трейл
    this.trail.push({ x: this.x, y: this.y, life: 8 });
    if (this.trail.length > 10) this.trail.shift();
    for (let i = this.trail.length - 1; i >= 0; i--) {
      this.trail[i].life--;
      if (this.trail[i].life <= 0) {
        this.trail.splice(i, 1);
      }
    }

    // Границы карты
    if (
      this.x < -50 ||
      this.x > CONFIG.MAP_WIDTH + 50 ||
      this.y < -50 ||
      this.y > CONFIG.MAP_HEIGHT + 50
    ) {
      this.alive = false;
      return;
    }

    // Время жизни
    if (this.life <= 0) {
      this.alive = false;
      this.explode();
      return;
    }

    // Коллизии со стенами
    for (const wall of state.walls) {
      if (Utils.circleRectCollision(this.x, this.y, this.radius, wall.x, wall.y, wall.w, wall.h)) {
        this.alive = false;
        this.explode();
        return;
      }
    }

    // Коллизии с сущностями
    for (const entity of state.entities) {
      if (!entity.alive || entity === this.owner || entity.team === this.team) continue;
      if (entity.invulnerable > 0) continue;
      if (Utils.circleCollision(this.x, this.y, this.radius, entity.x, entity.y, entity.radius)) {
        entity.takeDamage(this.damage, this.owner);
        this.alive = false;
        this.explode();
        return;
      }
    }
  }

  explode() {
    for (let i = 0; i < 10; i++) {
      const a = Utils.randAngle();
      const spd = Utils.rand(1, 4);
      state.particles.push(new Particle(
        this.x, this.y,
        Math.cos(a) * spd,
        Math.sin(a) * spd,
        this.team === 'blue' ? '#6bb3ff' : '#ff8a95',
        Utils.rand(3, 6),
        Utils.rand(10, 20)
      ));
    }
  }
}

/* ============================================================
   6. ЧАСТИЦЫ
   ============================================================ */
class Particle {
  constructor(x, y, vx, vy, color, size, life) {
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.color = color;
    this.size = size;
    this.life = life;
    this.maxLife = life;
    this.alive = true;
    this.rotation = Utils.randAngle();
    this.rotSpeed = Utils.rand(-0.2, 0.2);
  }

  update() {
    if (!this.alive) return;
    this.x += this.vx;
    this.y += this.vy;
    this.vx *= 0.96;
    this.vy *= 0.96;
    this.vy += 0.05; // гравитация
    this.rotation += this.rotSpeed;
    this.life--;
    if (this.life <= 0) this.alive = false;
  }
}

/* ============================================================
   7. ГЕНЕРАЦИЯ КАРТЫ
   ============================================================ */
function generateMap() {
  state.walls = [];
  state.obstacles = [];

  const W = CONFIG.MAP_WIDTH;
  const H = CONFIG.MAP_HEIGHT;
  const T = 120;
  const cx = W / 2;
  const cy = H / 2;

  // Внешние стены
  state.walls.push({ x: 0, y: 0, w: W, h: 40 });
  state.walls.push({ x: 0, y: H - 40, w: W, h: 40 });
  state.walls.push({ x: 0, y: 0, w: 40, h: H });
  state.walls.push({ x: W - 40, y: 0, w: 40, h: H });

  // Центральный крест
  state.walls.push({ x: cx - 200, y: cy - 30, w: 400, h: 60 });
  state.walls.push({ x: cx - 30, y: cy - 200, w: 60, h: 400 });

  // Угловые блоки (симметрично)
  const corners = [
    [200, 200],
    [W - 200 - T, 200],
    [200, H - 200 - T],
    [W - 200 - T, H - 200 - T],
  ];
  for (const [x, y] of corners) {
    state.walls.push({ x, y, w: T, h: T });
  }

  // Боковые блоки
  const sides = [
    [400, 400, T, 60],
    [W - 400 - T, 400, T, 60],
    [400, H - 400 - 60, T, 60],
    [W - 400 - T, H - 400 - 60, T, 60],
    [400, 400, 60, T],
    [W - 400 - 60, 400, 60, T],
    [400, H - 400 - T, 60, T],
    [W - 400 - 60, H - 400 - T, 60, T],
  ];
  for (const s of sides) {
    state.walls.push({ x: s[0], y: s[1], w: s[2], h: s[3] });
  }

  // Диагональные барьеры
  const diag = [
    [600, 600, 200, 40],
    [W - 800, 600, 200, 40],
    [600, H - 640, 200, 40],
    [W - 800, H - 640, 200, 40],
    [600, 600, 40, 200],
    [W - 640, 600, 40, 200],
    [600, H - 800, 40, 200],
    [W - 640, H - 800, 40, 200],
  ];
  for (const d of diag) {
    state.walls.push({ x: d[0], y: d[1], w: d[2], h: d[3] });
  }

  // Случайные блоки
  const occupied = state.walls.slice();
  let attempts = 0;
  let placed = 0;
  while (placed < 8 && attempts < 100) {
    attempts++;
    const x = Utils.rand(300, W - 300);
    const y = Utils.rand(300, H - 300);

    // Не ставим в центре
    if (Utils.dist(x, y, cx, cy) < 350) continue;

    // Проверка перекрытия
    let overlaps = false;
    for (const w of occupied) {
      if (x < w.x + w.w + 40 && x + 60 + 40 > w.x &&
          y < w.y + w.h + 40 && y + 60 + 40 > w.y) {
        overlaps = true;
        break;
      }
    }
    if (overlaps) continue;

    state.walls.push({ x, y, w: 60, h: 60 });
    placed++;
  }

  // Кусты (декорации, не блокируют движение)
  for (let i = 0; i < 25; i++) {
    const x = Utils.rand(100, W - 100);
    const y = Utils.rand(100, H - 100);
    let insideWall = false;
    for (const w of state.walls) {
      if (x > w.x && x < w.x + w.w && y > w.y && y < w.y + w.h) {
        insideWall = true;
        break;
      }
    }
    if (insideWall) continue;

    state.obstacles.push({
      x, y,
      r: Utils.rand(18, 32),
      type: 'bush',
      seed: Utils.rand(0, 100),
    });
  }
}

/* ============================================================
   8. СОЗДАНИЕ СУЩНОСТЕЙ
   ============================================================ */
function createEntities() {
  state.entities = [];
  state.player = null;
  state.enemies = [];

  // Игрок
  const player = new Player(300, CONFIG.MAP_HEIGHT / 2, 'blue', false, 'Ты');
  state.player = player;
  state.entities.push(player);

  // Враги
  const positions = [
    [CONFIG.MAP_WIDTH - 300, CONFIG.MAP_HEIGHT / 2 - 200],
    [CONFIG.MAP_WIDTH - 300, CONFIG.MAP_HEIGHT / 2 + 200],
  ];

  for (let i = 0; i < CONFIG.ENEMY_COUNT; i++) {
    const [x, y] = positions[i] || [CONFIG.MAP_WIDTH - 300, CONFIG.MAP_HEIGHT / 2];
    const enemy = new Player(x, y, 'red', true, `Враг ${i + 1}`);
    state.enemies.push(enemy);
    state.entities.push(enemy);
  }
}

/* ============================================================
   9. UI ОБНОВЛЕНИЯ
   ============================================================ */
let scoreDisplayBlue = null;
let scoreDisplayRed = null;
let timerDisplay = null;

function cacheUIDom() {
  scoreDisplayBlue = document.getElementById('score-blue');
  scoreDisplayRed = document.getElementById('score-red');
  timerDisplay = document.getElementById('timer-display');
}

function updateScoreDisplay(team) {
  const el = team === 'blue' ? scoreDisplayBlue : scoreDisplayRed;
  if (!el) return;
  el.textContent = team === 'blue' ? state.scoreBlue : state.scoreRed;
  el.classList.remove('pop');
  void el.offsetWidth; // reflow
  el.classList.add('pop');
}

function updateTimerDisplay() {
  if (!timerDisplay) return;
  timerDisplay.textContent = Utils.formatTime(state.timer);
  if (state.timer <= 30) {
    timerDisplay.classList.add('warning');
  } else {
    timerDisplay.classList.remove('warning');
  }
}

function updateUI() {
  // HP игрока
  const blueHp = document.querySelector('#team-blue .player-hp-fill');
  if (blueHp && state.player) {
    const pct = Math.max(0, state.player.hp / state.player.maxHp) * 100;
    blueHp.style.width = pct + '%';
    blueHp.style.background =
      state.player.hp > state.player.maxHp * 0.5
        ? '#3b8cff'
        : state.player.hp > state.player.maxHp * 0.25
        ? '#f5c542'
        : '#ff4d5e';
  }

  // HP врагов
  const redCards = document.querySelectorAll('#team-red .player-card');
  state.enemies.forEach((enemy, i) => {
    const card = redCards[i];
    if (!card) return;
    const fill = card.querySelector('.player-hp-fill');
    if (fill) {
      const pct = Math.max(0, enemy.hp / enemy.maxHp) * 100;
      fill.style.width = pct + '%';
      fill.style.background =
        enemy.hp > enemy.maxHp * 0.5
          ? '#ff4d5e'
          : enemy.hp > enemy.maxHp * 0.25
          ? '#f5c542'
          : '#ff4d5e';
    }
    if (!enemy.alive) {
      card.classList.add('dead');
    } else {
      card.classList.remove('dead');
    }
  });

  // Супер кнопка
  const superBtn = document.getElementById('super-button');
  if (superBtn && state.player) {
    if (state.player.superReady && state.player.alive) {
      superBtn.classList.remove('disabled');
      superBtn.classList.add('ready');
    } else {
      superBtn.classList.add('disabled');
      superBtn.classList.remove('ready');
    }
  }

  // Кулдаун атаки
  const cdOverlay = document.getElementById('attack-cooldown');
  if (cdOverlay && state.player) {
    if (state.player.attackCooldown > 0) {
      const pct = (state.player.attackCooldown / CONFIG.ATTACK_COOLDOWN) * 100;
      cdOverlay.style.setProperty('--cooldown', pct + '%');
    } else {
      cdOverlay.style.setProperty('--cooldown', '0%');
    }
  }
}

/* ============================================================
   10. УВЕДОМЛЕНИЯ О УБИЙСТВАХ
   ============================================================ */
function addKillFeed(killerName, victimName) {
  const feed = document.getElementById('kill-feed');
  if (!feed) return;

  const item = document.createElement('div');
  item.className = 'kill-feed-item';
  item.innerHTML = `
    <span class="icon">⚔️</span>
    <span class="killer">${killerName}</span>
    <span style="color:#666;">убил</span>
    <span class="victim">${victimName}</span>
  `;
  feed.appendChild(item);

  // Ограничение количества
  while (feed.children.length > 5) {
    feed.removeChild(feed.firstChild);
  }

  setTimeout(() => {
    if (item.parentNode) item.remove();
  }, 3200);
}

/* ============================================================
   11. ВСПЫШКА ЭКРАНА ПРИ УРОНЕ
   ============================================================ */
function triggerDamageFlash() {
  const container = document.getElementById('game-container');
  if (!container) return;
  const flash = document.createElement('div');
  flash.className = 'damage-flash';
  container.appendChild(flash);
  setTimeout(() => flash.remove(), 300);
}

/* ============================================================
   12. ОБНОВЛЕНИЕ КАМЕРЫ
   ============================================================ */
function updateCamera() {
  if (!state.player) return;

  const canvas = document.getElementById('game-canvas');
  const w = canvas.width;
  const h = canvas.height;

  // Целевая позиция
  const targetX = state.player.x - w / 2;
  const targetY = state.player.y - h / 2;

  // Плавное следование
  state.camera.x = Utils.lerp(state.camera.x, targetX, 0.1);
  state.camera.y = Utils.lerp(state.camera.y, targetY, 0.1);

  // Границы
  state.camera.x = Utils.clamp(state.camera.x, 0, CONFIG.MAP_WIDTH - w);
  state.camera.y = Utils.clamp(state.camera.y, 0, CONFIG.MAP_HEIGHT - h);

  // Тряска камеры
  if (state.camera.targetShake > 0) {
    state.camera.shake = state.camera.targetShake;
    state.camera.targetShake *= 0.85;
    if (state.camera.targetShake < 0.3) state.camera.targetShake = 0;
  } else if (state.camera.shake > 0) {
    state.camera.shake *= 0.9;
    if (state.camera.shake < 0.3) state.camera.shake = 0;
  }
}

/* ============================================================
   13. ОБНОВЛЕНИЕ ИГРЫ
   ============================================================ */
function updateGame(dt) {
  if (!state.running || state.gameOver) return;

  state.frame++;

  // Таймер
  if (state.frame % 60 === 0) {
    state.timer--;
    updateTimerDisplay();
    if (state.timer <= 0) {
      state.timer = 0;
      endGame();
      return;
    }
  }

  // Обновление сущностей
  for (const entity of state.entities) {
    entity.update(dt);
  }

  // Обновление снарядов
  for (let i = state.projectiles.length - 1; i >= 0; i--) {
    const proj = state.projectiles[i];
    proj.update();
    if (!proj.alive) {
      state.projectiles.splice(i, 1);
    }
  }

  // Обновление частиц
  for (let i = state.particles.length - 1; i >= 0; i--) {
    const p = state.particles[i];
    p.update();
    if (!p.alive) {
      state.particles.splice(i, 1);
    }
  }

  // Ограничение количества частиц
  if (state.particles.length > CONFIG.MAX_PARTICLES) {
    state.particles.splice(0, state.particles.length - CONFIG.MAX_PARTICLES);
  }

  // Обновление цифр урона
  for (let i = state.damageNumbers.length - 1; i >= 0; i--) {
    const dn = state.damageNumbers[i];
    dn.life--;
    dn.x += dn.vx;
    dn.y += dn.vy;
    dn.vy *= 0.97;
    if (dn.life <= 0) {
      state.damageNumbers.splice(i, 1);
    }
  }

  // Обновление эффектов
  for (let i = state.effects.length - 1; i >= 0; i--) {
    const ef = state.effects[i];
    ef.life--;

    if (ef.type === 'superExplosion') {
      ef.radius = Utils.lerp(ef.radius, ef.maxRadius, 0.12);
      ef.alpha = ef.life / ef.maxLife;
    } else if (ef.type === 'deathExplosion') {
      ef.radius = Utils.lerp(ef.radius, ef.maxRadius, 0.15);
      ef.alpha = ef.life / ef.maxLife;
    } else if (ef.type === 'respawnPulse') {
      ef.radius = Utils.lerp(ef.radius, ef.maxRadius, 0.15);
      ef.alpha = ef.life / ef.maxLife;
    }

    if (ef.life <= 0) {
      state.effects.splice(i, 1);
    }
  }

  // Проверка победы по очкам
  if (state.scoreBlue >= CONFIG.SCORE_TO_WIN) {
    endGame();
    return;
  }
  if (state.scoreRed >= CONFIG.SCORE_TO_WIN) {
    endGame();
    return;
  }

  // Камера
  updateCamera();

  // UI
  updateUI();
}

/* ============================================================
   14. РЕНДЕРИНГ
   ============================================================ */
const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d', { alpha: false });

function resizeCanvas() {
  const container = document.getElementById('game-container');
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = container.clientWidth;
  const h = container.clientHeight;

  canvas.width = w * dpr;
  canvas.height = h * dpr;
  canvas.style.width = w + 'px';
  canvas.style.height = h + 'px';
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  canvas._logicalWidth = w;
  canvas._logicalHeight = h;
}

window.addEventListener('resize', () => {
  resizeCanvas();
});

function render() {
  const w = canvas._logicalWidth || canvas.width;
  const h = canvas._logicalHeight || canvas.height;

  // Тряска камеры
  let shakeX = 0;
  let shakeY = 0;
  if (state.camera.shake > 0.5) {
    shakeX = Utils.rand(-state.camera.shake, state.camera.shake);
    shakeY = Utils.rand(-state.camera.shake, state.camera.shake);
  }

  // Фон
  const bgGrad = ctx.createRadialGradient(w / 2, h / 2, 100, w / 2, h / 2, w);
  bgGrad.addColorStop(0, '#1b2340');
  bgGrad.addColorStop(0.6, '#111827');
  bgGrad.addColorStop(1, '#070a14');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, w, h);

  ctx.save();
  ctx.translate(-state.camera.x + shakeX, -state.camera.y + shakeY);

  // Сетка
  drawGrid(w, h);

  // Кусты (под стенами)
  drawObstacles();

  // Стены
  drawWalls();

  // Частицы (под сущностями)
  drawParticles();

  // Снаряды
  drawProjectiles();

  // Сущности
  drawEntities();

  // Эффекты
  drawEffects();

  // Цифры урона
  drawDamageNumbers();

  ctx.restore();

  // Индикатор границ карты (мини-карта)
  drawMinimap(w, h);
}

/* ---------- СЕТКА ---------- */
function drawGrid(w, h) {
  ctx.strokeStyle = 'rgba(59, 140, 255, 0.05)';
  ctx.lineWidth = 1;
  const gridSize = 100;
  const startX = Math.floor(state.camera.x / gridSize) * gridSize;
  const startY = Math.floor(state.camera.y / gridSize) * gridSize;
  const endX = state.camera.x + w + gridSize;
  const endY = state.camera.y + h + gridSize;

  ctx.beginPath();
  for (let x = startX; x < endX; x += gridSize) {
    ctx.moveTo(x, state.camera.y);
    ctx.lineTo(x, state.camera.y + h);
  }
  for (let y = startY; y < endY; y += gridSize) {
    ctx.moveTo(state.camera.x, y);
    ctx.lineTo(state.camera.x + w, y);
  }
  ctx.stroke();
}

/* ---------- КУСТЫ ---------- */
function drawObstacles() {
  for (const obs of state.obstacles) {
    // Не рисуем за экраном
    if (
      obs.x + obs.r < state.camera.x ||
      obs.x - obs.r > state.camera.x + canvas._logicalWidth ||
      obs.y + obs.r < state.camera.y ||
      obs.y - obs.r > state.camera.y + canvas._logicalHeight
    ) {
      continue;
    }

    ctx.save();
    ctx.globalAlpha = 0.4;

    const grad = ctx.createRadialGradient(obs.x, obs.y, 0, obs.x, obs.y, obs.r);
    grad.addColorStop(0, 'rgba(76, 217, 100, 0.5)');
    grad.addColorStop(1, 'rgba(76, 217, 100, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(obs.x, obs.y, obs.r, 0, Math.PI * 2);
    ctx.fill();

    ctx.globalAlpha = 0.3;
    ctx.strokeStyle = 'rgba(76, 217, 100, 0.6)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.restore();
  }
}

/* ---------- СТЕНЫ ---------- */
function drawWalls() {
  for (const wall of state.walls) {
    // Отсечение по камере
    if (
      wall.x + wall.w < state.camera.x ||
      wall.x > state.camera.x + canvas._logicalWidth ||
      wall.y + wall.h < state.camera.y ||
      wall.y > state.camera.y + canvas._logicalHeight
    ) {
      continue;
    }

    // Тень
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(wall.x + 4, wall.y + 4, wall.w, wall.h);

    // Градиент
    const grad = ctx.createLinearGradient(wall.x, wall.y, wall.x + wall.w, wall.y + wall.h);
    grad.addColorStop(0, '#2a3450');
    grad.addColorStop(0.5, '#1e2840');
    grad.addColorStop(1, '#151d30');
    ctx.fillStyle = grad;
    ctx.fillRect(wall.x, wall.y, wall.w, wall.h);

    // Обводка
    ctx.strokeStyle = 'rgba(59, 140, 255, 0.2)';
    ctx.lineWidth = 2;
    ctx.strokeRect(wall.x, wall.y, wall.w, wall.h);

    // Блик сверху
    ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.fillRect(wall.x, wall.y, wall.w, 6);

    // Паттерн (мелкие точки)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
    for (let x = wall.x + 15; x < wall.x + wall.w - 5; x += 30) {
      for (let y = wall.y + 15; y < wall.y + wall.h - 5; y += 30) {
        ctx.beginPath();
        ctx.arc(x, y, 1.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
}

/* ---------- ЧАСТИЦЫ ---------- */
function drawParticles() {
  for (const p of state.particles) {
    const alpha = p.life / p.maxLife;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size * alpha, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

/* ---------- СНАРЯДЫ ---------- */
function drawProjectiles() {
  for (const proj of state.projectiles) {
    // Трейл
    for (let i = 0; i < proj.trail.length; i++) {
      const t = proj.trail[i];
      const alpha = (t.life / 8) * 0.5;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = proj.team === 'blue' ? '#6bb3ff' : '#ff8a95';
      ctx.beginPath();
      ctx.arc(t.x, t.y, proj.radius * (i / proj.trail.length) * 0.8, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Снаряд
    const grad = ctx.createRadialGradient(proj.x, proj.y, 0, proj.x, proj.y, proj.radius * 1.5);
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(0.4, proj.team === 'blue' ? '#6bb3ff' : '#ff8a95');
    grad.addColorStop(1, proj.team === 'blue' ? '#3b8cff' : '#ff4d5e');
    ctx.fillStyle = grad;
    ctx.shadowColor = proj.team === 'blue' ? '#3b8cff' : '#ff4d5e';
    ctx.shadowBlur = 20;
    ctx.beginPath();
    ctx.arc(proj.x, proj.y, proj.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  }
}

/* ---------- СУЩНОСТИ ---------- */
function drawEntities() {
  // Сортировка по Y для правильного наложения
  const sorted = state.entities
    .filter((e) => e.alive)
    .sort((a, b) => a.y - b.y);

  for (const entity of sorted) {
    // Отсечение по камере
    if (
      entity.x + entity.radius * 3 < state.camera.x ||
      entity.x - entity.radius * 3 > state.camera.x + canvas._logicalWidth ||
      entity.y + entity.radius * 3 < state.camera.y ||
      entity.y - entity.radius * 3 > state.camera.y + canvas._logicalHeight
    ) {
      continue;
    }
    drawEntity(entity);
  }
}

function drawEntity(entity) {
  const x = entity.x;
  const y = entity.y;
  const r = entity.radius;

  // Мигание неуязвимости
  if (entity.invulnerable > 0 && Math.floor(entity.invulnerable / 4) % 2 === 0) {
    ctx.globalAlpha = 0.5;
  }

  // Индикатор игрока
  if (entity === state.player) {
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 6]);
    ctx.beginPath();
    ctx.arc(x, y, r + 12, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // Тень
  ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
  ctx.beginPath();
  ctx.ellipse(x, y + r * 0.85, r * 1.1, r * 0.5, 0, 0, Math.PI * 2);
  ctx.fill();

  // Вспышка при получении урона
  if (entity.hitFlash > 0) {
    ctx.shadowColor = '#ffffff';
    ctx.shadowBlur = 30;
  }

  // Тело
  const bodyGrad = ctx.createRadialGradient(
    x - r * 0.3, y - r * 0.3, r * 0.2,
    x, y, r
  );
  if (entity.team === 'blue') {
    bodyGrad.addColorStop(0, '#8ec5ff');
    bodyGrad.addColorStop(0.6, '#3b8cff');
    bodyGrad.addColorStop(1, '#1e5bb8');
  } else {
    bodyGrad.addColorStop(0, '#ff8a95');
    bodyGrad.addColorStop(0.6, '#ff4d5e');
    bodyGrad.addColorStop(1, '#b81e2e');
  }
  ctx.fillStyle = bodyGrad;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();

  // Обводка
  ctx.strokeStyle = entity.team === 'blue' ? '#6bb3ff' : '#ff8a95';
  ctx.lineWidth = 3;
  ctx.stroke();

  // Внутренний блик
  ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
  ctx.beginPath();
  ctx.arc(x - r * 0.25, y - r * 0.25, r * 0.35, 0, Math.PI * 2);
  ctx.fill();

  // Ствол
  const gunLen = r + 8;
  const gx = x + Math.cos(entity.angle) * gunLen;
  const gy = y + Math.sin(entity.angle) * gunLen;
  ctx.strokeStyle = entity.team === 'blue' ? '#6bb3ff' : '#ff8a95';
  ctx.lineWidth = 7;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x + Math.cos(entity.angle) * r * 0.4, y + Math.sin(entity.angle) * r * 0.4);
  ctx.lineTo(gx, gy);
  ctx.stroke();

  // Кончик ствола
  ctx.fillStyle = entity.team === 'blue' ? '#a3d5ff' : '#ffb0b8';
  ctx.beginPath();
  ctx.arc(gx, gy, 4, 0, Math.PI * 2);
  ctx.fill();

  ctx.shadowBlur = 0;

  // Глаза
  const eyeOffsetX = Math.cos(entity.angle) * r * 0.25;
  const eyeOffsetY = Math.sin(entity.angle) * r * 0.25;
  const eyeSide = entity.angle + Math.PI / 2;
  const eyeSep = r * 0.35;

  for (let s = -1; s <= 1; s += 2) {
    const ex = x + eyeOffsetX + Math.cos(eyeSide) * eyeSep * s;
    const ey = y + eyeOffsetY + Math.sin(eyeSide) * eyeSep * s;

    // Белок
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(ex, ey, r * 0.16, 0, Math.PI * 2);
    ctx.fill();

    // Зрачок
    ctx.fillStyle = '#0b0e1a';
    ctx.beginPath();
    ctx.arc(
      ex + Math.cos(entity.angle) * r * 0.05,
      ey + Math.sin(entity.angle) * r * 0.05,
      r * 0.08,
      0, Math.PI * 2
    );
    ctx.fill();
  }

  // HP-бар
  drawEntityHPBar(entity);

  ctx.globalAlpha = 1;
}

function drawEntityHPBar(entity) {
  const barW = 54;
  const barH = 7;
  const barX = entity.x - barW / 2;
  const barY = entity.y - entity.radius - 20;

  // Фон
  ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
  if (ctx.roundRect) {
    ctx.beginPath();
    ctx.roundRect(barX - 2, barY - 2, barW + 4, barH + 4, 4);
    ctx.fill();
  } else {
    ctx.fillRect(barX - 2, barY - 2, barW + 4, barH + 4);
  }

  // Полоса
  const pct = Math.max(0, entity.hp / entity.maxHp);
  const color =
    pct > 0.5
      ? entity.team === 'blue' ? '#3b8cff' : '#ff4d5e'
      : pct > 0.25
      ? '#f5c542'
      : '#ff4d5e';

  ctx.fillStyle = color;
  if (ctx.roundRect) {
    ctx.beginPath();
    ctx.roundRect(barX, barY, barW * pct, barH, 3);
    ctx.fill();
  } else {
    ctx.fillRect(barX, barY, barW * pct, barH);
  }

  // Блик
  ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
  ctx.fillRect(barX, barY, barW * pct, 2);

  // Имя
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 11px "Segoe UI", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
  ctx.shadowBlur = 4;
  ctx.fillText(entity.name, entity.x, barY - 4);
  ctx.shadowBlur = 0;
  ctx.textBaseline = 'alphabetic';
}

/* ---------- ЭФФЕКТЫ ---------- */
function drawEffects() {
  for (const ef of state.effects) {
    ctx.globalAlpha = ef.alpha;

    if (ef.type === 'superExplosion') {
      ctx.strokeStyle = '#f5c542';
      ctx.lineWidth = 5;
      ctx.shadowColor = '#f5c542';
      ctx.shadowBlur = 40;
      ctx.beginPath();
      ctx.arc(ef.x, ef.y, ef.radius, 0, Math.PI * 2);
      ctx.stroke();

      // Внутренний круг
      ctx.globalAlpha = ef.alpha * 0.4;
      const grad = ctx.createRadialGradient(ef.x, ef.y, 0, ef.x, ef.y, ef.radius);
      grad.addColorStop(0, 'rgba(245, 197, 66, 0.5)');
      grad.addColorStop(1, 'rgba(245, 197, 66, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(ef.x, ef.y, ef.radius, 0, Math.PI * 2);
      ctx.fill();

      ctx.shadowBlur = 0;
    } else if (ef.type === 'deathExplosion') {
      ctx.strokeStyle = '#ff4d5e';
      ctx.lineWidth = 3;
      ctx.shadowColor = '#ff4d5e';
      ctx.shadowBlur = 20;
      ctx.beginPath();
      ctx.arc(ef.x, ef.y, ef.radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.shadowBlur = 0;
    } else if (ef.type === 'respawnPulse') {
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 3;
      ctx.shadowColor = '#ffffff';
      ctx.shadowBlur = 20;
      ctx.beginPath();
      ctx.arc(ef.x, ef.y, ef.radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.shadowBlur = 0;
    }
  }
  ctx.globalAlpha = 1;
}

/* ---------- ЦИФРЫ УРОНА ---------- */
function drawDamageNumbers() {
  for (const dn of state.damageNumbers) {
    const alpha = dn.life / dn.maxLife;
    ctx.globalAlpha = alpha;

    // Масштаб при появлении
    const scale = dn.life > dn.maxLife * 0.8
      ? 1 + (1 - (dn.maxLife - dn.life) / (dn.maxLife * 0.2)) * 0.5
      : 1;

    ctx.save();
    ctx.translate(dn.x, dn.y);
    ctx.scale(scale, scale);

    ctx.fillStyle = dn.color;
    ctx.font = 'bold 22px "Segoe UI", "Impact", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.9)';
    ctx.lineWidth = 4;
    ctx.strokeText(dn.value, 0, 0);
    ctx.fillText(dn.value, 0, 0);

    ctx.restore();
    ctx.globalAlpha = 1;
  }
}

/* ---------- МИНИ-КАРТА ---------- */
function drawMinimap(w, h) {
  const mapW = 160;
  const mapH = 160;
  const padding = 16;
  const mapX = w - mapW - padding;
  const mapY = h - mapH - padding;

  // Фон
  ctx.fillStyle = 'rgba(10, 15, 30, 0.7)';
  if (ctx.roundRect) {
    ctx.beginPath();
    ctx.roundRect(mapX, mapY, mapW, mapH, 8);
    ctx.fill();
  } else {
    ctx.fillRect(mapX, mapY, mapW, mapH);
  }

  // Обводка
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
  ctx.lineWidth = 1.5;
  if (ctx.roundRect) {
    ctx.beginPath();
    ctx.roundRect(mapX, mapY, mapW, mapH, 8);
    ctx.stroke();
  } else {
    ctx.strokeRect(mapX, mapY, mapW, mapH);
  }

  // Масштаб
  const sx = mapW / CONFIG.MAP_WIDTH;
  const sy = mapH / CONFIG.MAP_HEIGHT;

  // Стены
  ctx.fillStyle = 'rgba(59, 140, 255, 0.2)';
  for (const wall of state.walls) {
    ctx.fillRect(
      mapX + wall.x * sx,
      mapY + wall.y * sy,
      Math.max(1, wall.w * sx),
      Math.max(1, wall.h * sy)
    );
  }

  // Сущности
  for (const entity of state.entities) {
    if (!entity.alive) continue;

    const ex = mapX + entity.x * sx;
    const ey = mapY + entity.y * sy;

    if (entity === state.player) {
      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = '#3b8cff';
      ctx.shadowBlur = 8;
    } else {
      ctx.fillStyle = entity.team === 'blue' ? '#3b8cff' : '#ff4d5e';
      ctx.shadowBlur = 0;
    }

    ctx.beginPath();
    ctx.arc(ex, ey, entity === state.player ? 4 : 3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.shadowBlur = 0;

  // Область камеры
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
  ctx.lineWidth = 1;
  ctx.strokeRect(
    mapX + state.camera.x * sx,
    mapY + state.camera.y * sy,
    canvas._logicalWidth * sx,
    canvas._logicalHeight * sy
  );
}

/* ============================================================
   15. ВВОД (джойстик, кнопки, клавиатура)
   ============================================================ */
const joystickZone = document.getElementById('joystick-zone');
const joystickBase = document.getElementById('joystick-base');
const joystickKnob = document.getElementById('joystick-knob');
const superBtn = document.getElementById('super-button');
const attackBtn = document.getElementById('attack-button');

let joystickTouchId = null;
let joystickCenterX = 0;
let joystickCenterY = 0;

/* ---------- ДЖОЙСТИК ---------- */
function joystickStart(clientX, clientY) {
  const rect = joystickZone.getBoundingClientRect();
  joystickCenterX = clientX - rect.left;
  joystickCenterY = clientY - rect.top;

  const baseSize = joystickBase.offsetWidth || 140;
  joystickBase.style.left = joystickCenterX - baseSize / 2 + 'px';
  joystickBase.style.top = joystickCenterY - baseSize / 2 + 'px';
  joystickBase.style.opacity = '1';

  const knobSize = joystickKnob.offsetWidth || 60;
  joystickKnob.style.left = joystickCenterX - knobSize / 2 + 'px';
  joystickKnob.style.top = joystickCenterY - knobSize / 2 + 'px';
  joystickKnob.style.opacity = '1';
  joystickKnob.style.transform = 'translate(0px, 0px)';

  state.input.joystickActive = true;
  state.input.joystickAngle = 0;
  state.input.joystickIntensity = 0;
}

function joystickMove(clientX, clientY) {
  if (!state.input.joystickActive) return;

  const rect = joystickZone.getBoundingClientRect();
  const dx = (clientX - rect.left) - joystickCenterX;
  const dy = (clientY - rect.top) - joystickCenterY;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const maxDist = 70;
  const clampedDist = Math.min(dist, maxDist);

  if (dist > 0.5) {
    const angle = Math.atan2(dy, dx);
    const intensity = clampedDist / maxDist;

    state.input.joystickAngle = angle;
    state.input.joystickIntensity = intensity;

    // Визуальный сдвиг ручки
    const knobX = Math.cos(angle) * clampedDist;
    const knobY = Math.sin(angle) * clampedDist;
    joystickKnob.style.transform = `translate(${knobX}px, ${knobY}px)`;

    // Автоматический поворот игрока в сторону движения
    if (state.player && state.player.alive) {
      state.player.targetAngle = angle;
    }
  }
}

function joystickEnd() {
  state.input.joystickActive = false;
  state.input.joystickAngle = 0;
  state.input.joystickIntensity = 0;
  joystickBase.style.opacity = '0';
  joystickKnob.style.opacity = '0';
  joystickKnob.style.transform = 'translate(0px, 0px)';
  joystickTouchId = null;
}

// Touch
joystickZone.addEventListener('touchstart', (e) => {
  e.preventDefault();
  const t = e.changedTouches[0];
  joystickTouchId = t.identifier;
  joystickStart(t.clientX, t.clientY);
}, { passive: false });

joystickZone.addEventListener('touchmove', (e) => {
  e.preventDefault();
  for (const t of e.changedTouches) {
    if (t.identifier === joystickTouchId) {
      joystickMove(t.clientX, t.clientY);
      break;
    }
  }
}, { passive: false });

joystickZone.addEventListener('touchend', (e) => {
  for (const t of e.changedTouches) {
    if (t.identifier === joystickTouchId) {
      joystickEnd();
      break;
    }
  }
});

joystickZone.addEventListener('touchcancel', () => {
  joystickEnd();
});

// Mouse
let mouseDownJoystick = false;

joystickZone.addEventListener('mousedown', (e) => {
  e.preventDefault();
  mouseDownJoystick = true;
  joystickStart(e.clientX, e.clientY);
});

window.addEventListener('mousemove', (e) => {
  if (mouseDownJoystick) {
    joystickMove(e.clientX, e.clientY);
  }
});

window.addEventListener('mouseup', () => {
  if (mouseDownJoystick) {
    mouseDownJoystick = false;
    joystickEnd();
  }
});

/* ---------- КНОПКА АТАКИ ---------- */
function doAttack() {
  if (!state.player || !state.player.alive) return;
  if (state.player.attackCooldown > 0) return;
  state.player.shoot(state.player.angle);
  state.player.attackCooldown = CONFIG.ATTACK_COOLDOWN;
}

attackBtn.addEventListener('touchstart', (e) => {
  e.preventDefault();
  doAttack();
}, { passive: false });

attackBtn.addEventListener('mousedown', (e) => {
  e.preventDefault();
  doAttack();
});

/* ---------- КНОПКА СУПЕР ---------- */
function doSuper() {
  if (!state.player || !state.player.alive) return;
  if (!state.player.superReady) return;
  state.player.useSuper();
}

superBtn.addEventListener('touchstart', (e) => {
  e.preventDefault();
  doSuper();
}, { passive: false });

superBtn.addEventListener('mousedown', (e) => {
  e.preventDefault();
  doSuper();
});

/* ---------- КЛАВИАТУРА ---------- */
window.addEventListener('keydown', (e) => {
  const key = e.key.toLowerCase();
  state.input.keys[key] = true;

  if (key === ' ' || key === 'spacebar') {
    e.preventDefault();
    doAttack();
  }
  if (key === 'q' || key === 'й') {
    doSuper();
  }
  if (key === 'r' || key === 'к') {
    if (state.gameOver) restartGame();
  }
});

window.addEventListener('keyup', (e) => {
  state.input.keys[e.key.toLowerCase()] = false;
});

/* ---------- КНОПКА РЕСТАРТА ---------- */
document.getElementById('restart-button').addEventListener('click', restartGame);

/* ============================================================
   16. КОНЕЦ ИГРЫ
   ============================================================ */
function endGame() {
  if (state.gameOver) return;
  state.gameOver = true;
  state.running = false;

  if (state.scoreBlue > state.scoreRed) {
    state.winner = 'blue';
  } else if (state.scoreRed > state.scoreBlue) {
    state.winner = 'red';
  } else {
    state.winner = 'draw';
  }

  const overlay = document.getElementById('game-over-overlay');
  const title = document.getElementById('game-over-title');
  const subtitle = document.getElementById('game-over-subtitle');

  if (state.winner === 'blue') {
    title.textContent = 'ПОБЕДА';
    title.style.color = '#3b8cff';
    title.style.textShadow = '0 0 60px rgba(59, 140, 255, 0.53), 0 0 120px rgba(59, 140, 255, 0.27)';
    subtitle.textContent = `Счёт ${state.scoreBlue} : ${state.scoreRed} — синяя команда доминирует!`;
  } else if (state.winner === 'red') {
    title.textContent = 'ПОРАЖЕНИЕ';
    title.style.color = '#ff4d5e';
    title.style.textShadow = '0 0 60px rgba(255, 77, 94, 0.53), 0 0 120px rgba(255, 77, 94, 0.27)';
    subtitle.textContent = `Счёт ${state.scoreBlue} : ${state.scoreRed} — красная команда победила...`;
  } else {
    title.textContent = 'НИЧЬЯ';
    title.style.color = '#f5c542';
    title.style.textShadow = '0 0 60px rgba(245, 197, 66, 0.53), 0 0 120px rgba(245, 197, 66, 0.27)';
    subtitle.textContent = `Счёт ${state.scoreBlue} : ${state.scoreRed} — равная битва!`;
  }

  overlay.classList.add('visible');

  // Вибрация
  if (navigator.vibrate) {
    navigator.vibrate([100, 50, 100, 50, 200]);
  }

  // Логирование статистики
  console.log('📊 Финальная статистика:');
  console.log('  Убийств:', state.stats.totalKills);
  console.log('  Смертей:', state.stats.totalDeaths);
  console.log('  Урона нанесено:', Math.round(state.stats.damageDealt));
  console.log('  Урона получено:', Math.round(state.stats.damageTaken));
  console.log('  Супер использован:', state.stats.superUsed);
  console.log('  Выстрелов:', state.stats.shotsFired);
}

/* ============================================================
   17. ПЕРЕЗАПУСК
   ============================================================ */
function restartGame() {
  // Сброс состояния
  state.running = true;
  state.paused = false;
  state.gameOver = false;
  state.winner = null;
  state.timer = CONFIG.MATCH_DURATION;
  state.scoreBlue = 0;
  state.scoreRed = 0;
  state.frame = 0;
  state.projectiles = [];
  state.particles = [];
  state.damageNumbers = [];
  state.effects = [];
  state.camera = { x: 0, y: 0, shake: 0, targetShake: 0 };
  state.stats = {
    totalKills: 0,
    totalDeaths: 0,
    damageDealt: 0,
    damageTaken: 0,
    superUsed: 0,
    shotsFired: 0,
  };

  // Сброс UI
  const overlay = document.getElementById('game-over-overlay');
  overlay.classList.remove('visible');

  const feed = document.getElementById('kill-feed');
  feed.innerHTML = '';

  if (timerDisplay) {
    timerDisplay.classList.remove('warning');
  }
  updateTimerDisplay();

  // Счёт
  if (scoreDisplayBlue) scoreDisplayBlue.textContent = '0';
  if (scoreDisplayRed) scoreDisplayRed.textContent = '0';

  // Сущности
  generateMap();
  createEntities();

  // Джойстик
  joystickEnd();

  // Камера
  if (state.player) {
    state.camera.x = state.player.x - (canvas._logicalWidth || canvas.width) / 2;
    state.camera.y = state.player.y - (canvas._logicalHeight || canvas.height) / 2;
    state.camera.x = Utils.clamp(state.camera.x, 0, CONFIG.MAP_WIDTH - (canvas._logicalWidth || canvas.width));
    state.camera.y = Utils.clamp(state.camera.y, 0, CONFIG.MAP_HEIGHT - (canvas._logicalHeight || canvas.height));
  }
}

/* ============================================================
   18. ИНИЦИАЛИЗАЦИЯ
   ============================================================ */
function init() {
  cacheUIDom();
  resizeCanvas();
  generateMap();
  createEntities();
  updateTimerDisplay();

  // Стартовая позиция камеры
  if (state.player) {
    state.camera.x = state.player.x - (canvas._logicalWidth || canvas.width) / 2;
    state.camera.y = state.player.y - (canvas._logicalHeight || canvas.height) / 2;
  }

  console.log('%c⚔️ BRAWL STARS КЛОН ⚔️', 'font-size: 24px; font-weight: bold; color: #f5c542; text-shadow: 0 0 20px #f5c542;');
  console.log('%cУправление:', 'font-size: 14px; color: #3b8cff; font-weight: bold;');
  console.log('  🎮 Джойстик — движение');
  console.log('  ⚔️ Кнопка атаки / Space — выстрел');
  console.log('  💥 Кнопка супер / Q — супер-способность');
  console.log('  ⌨️ WASD / стрелки — альтернативное движение');
  console.log('  🔄 R — перезапуск');
}

/* ============================================================
   19. ИГРОВОЙ ЦИКЛ
   ============================================================ */
let lastTime = performance.now();
let accumulator = 0;

function gameLoop(currentTime) {
  const deltaMs = currentTime - lastTime;
  lastTime = currentTime;

  // Ограничиваем dt при лагах (защита от прыжков)
  const dt = Math.min(deltaMs / CONFIG.FRAME_TIME, 3);

  if (state.running && !state.gameOver) {
    updateGame(dt);
  }

  render();

  requestAnimationFrame(gameLoop);
}

/* ============================================================
   20. ЗАПУСК
   ============================================================ */
init();
requestAnimationFrame(gameLoop);

/* ============================================================
   21. ОБРАБОТКА ПОТЕРИ ФОКУСА
   ============================================================ */
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    state.paused = true;
  } else {
    state.paused = false;
    lastTime = performance.now(); // избегаем прыжка времени
  }
});

/* ============================================================
   22. ПРЕДОТВРАЩЕНИЕ КОНТЕКСТНОГО МЕНЮ
   ============================================================ */
document.addEventListener('contextmenu', (e) => {
  e.preventDefault();
});

/* ============================================================
   23. ПРЕДОТВРАЩЕНИЕ МАСШТАБИРОВАНИЯ
   ============================================================ */
document.addEventListener('gesturestart', (e) => e.preventDefault());
document.addEventListener('gesturechange', (e) => e.preventDefault());
document.addEventListener('gestureend', (e) => e.preventDefault());

let lastTouchEnd = 0;
document.addEventListener('touchend', (e) => {
  const now = Date.now();
  if (now - lastTouchEnd <= 300) {
    e.preventDefault();
  }
  lastTouchEnd = now;
}, { passive: false });

/* ============================================================
   24. ЭКСПОРТ ДЛЯ ОТЛАДКИ (опционально)
   ============================================================ */
window.__brawlClone = {
  state,
  CONFIG,
  Utils,
  restartGame,
  endGame,
};

/* ============================================================
   25. КОНЕЦ
   ============================================================ */
console.log('%c✅ Игра готова!', 'font-size: 16px; color: #4cd964; font-weight: bold;');