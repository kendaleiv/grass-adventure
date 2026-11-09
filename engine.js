(function (root) {
  'use strict';
  const TILE = 24;
  const DUNGEONS = [
    { name: 'Mossroot Ruins', theme: 'grass', x: 19, y: 14, reward: 'A heart container and the Ice Sword', hint: 'Jump the water channel. Break the pots to find a brass key.' },
    { name: 'The Icy Road', theme: 'ice', x: 43, y: 10, reward: 'A heart container and the Frozen Shield', hint: 'Ice is slippery! The key is beneath the middle pot. Clocks trim your adventure time; there is no time limit.' },
    { name: 'Bramble Labyrinth', theme: 'garden', x: 64, y: 21, reward: 'A heart container', hint: 'Follow the safe garden path to the right. The left brambles sting, but never end your adventure.' },
    { name: 'Sunken Pipes', theme: 'water', x: 53, y: 39, reward: 'A heart container and swimming fins', hint: 'Round jump pads launch you over the water. The long ladder is a safe crossing.' },
    { name: 'Ember Ladder', theme: 'lava', x: 23, y: 43, reward: 'A heart container', hint: 'Take the ladder over the lava, or leap from the round stone pads.' },
    { name: 'Stormkeep', theme: 'castle', x: 66, y: 7, reward: 'The final heart and peace in Willowfield', hint: 'Find the key, then face the Storm Dino. Twenty sword hits! Jump or shield when its lightning charge glows.' }
  ];
  const point = (x, y) => ({ x: (x + .5) * TILE, y: (y + .5) * TILE });
  const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
  const hash = (x, y) => ((x * 374761 + y * 668265) ^ (x * y * 127)) >>> 0;
  const object = (type, x, y, extra = {}) => ({ type, ...point(x, y), ...extra });

  class Game {
    constructor(name = 'Sprout', saved = null) {
      this.name = String(name).trim().slice(0, 16) || 'Sprout';
      this.player = { ...point(10, 31), vx: 0, vy: 0, facing: { x: 0, y: 1 }, hp: 3, maxHp: 3, sword: false, iceSword: false, shield: false, frozenShield: false, fins: false, rupees: 0, bombs: 0, invincible: 0, jump: 0, attack: 0, cooldown: 0, guarding: false };
      this.completed = [];
      this.elapsed = 0;
      this.mode = 'playing';
      this.events = [];
      this.returnPoint = point(10, 31);
      this.secretOpen = this.name.toUpperCase() === 'ABC';
      if (saved && saved.version === 1) this.restore(saved);
      this.loadWorld();
    }

    restore(saved) {
      if (typeof saved.name === 'string') this.name = saved.name.slice(0, 16) || 'Sprout';
      this.completed = [...new Set(Array.isArray(saved.completed) ? saved.completed.filter(n => Number.isInteger(n) && n >= 1 && n <= 6) : [])];
      const p = this.player;
      p.maxHp = 3 + this.completed.length;
      p.hp = p.maxHp;
      for (const key of ['sword', 'shield']) p[key] = saved[key] === true;
      p.sword ||= this.completed.length > 0;
      p.iceSword = this.completed.includes(1);
      p.frozenShield = this.completed.includes(2);
      p.fins = this.completed.includes(4);
      for (const key of ['rupees', 'bombs']) p[key] = Number.isFinite(saved[key]) ? clamp(Math.floor(saved[key]), 0, 9999) : 0;
      this.elapsed = Number.isFinite(saved.elapsed) ? clamp(saved.elapsed, 0, 360000) : 0;
      this.secretOpen = saved.secretOpen === true || this.name.toUpperCase() === 'ABC';
      if (saved.won === true && this.completed.includes(6)) this.mode = 'won';
    }

    save() {
      const p = this.player;
      return { version: 1, name: this.name, completed: this.completed.slice(), sword: p.sword, shield: p.shield, rupees: p.rupees, bombs: p.bombs, elapsed: this.elapsed, secretOpen: this.secretOpen, won: this.completed.includes(6) };
    }

    emit(type, text) { this.events.push({ type, text }); }
    message(text) { this.emit('message', text); }
    grid(w, h, floor) {
      this.width = w;
      this.height = h;
      this.tiles = Array.from({ length: h }, (_, y) => Array.from({ length: w }, (_, x) => x === 0 || y === 0 || x === w - 1 || y === h - 1 ? 'wall' : floor));
      this.objects = [];
      this.enemies = [];
      this.projectiles = [];
      this.effects = [];
      this.roomTime = 0;
    }
    placePlayer(pos) {
      Object.assign(this.player, pos, { vx: 0, vy: 0, jump: 0, guarding: false, invincible: 1.2 });
      this.safe = { ...pos };
    }
    loadWorld() {
      this.room = 'world';
      this.roomName = 'Willowfield';
      this.theme = 'grass';
      this.grid(78, 52, 'grass');
      for (let y = 1; y < 51; y++) for (let x = 1; x < 77; x++) {
        if (x >= 31 && x <= 37 && y >= 18 && y <= 35) this.tiles[y][x] = 'water';
        else if (hash(x, y) % 31 === 0 && x > 15) this.tiles[y][x] = 'tree';
        if ((y >= 30 && y <= 32) || (x >= 9 && x <= 11) || (y >= 13 && y <= 14 && x < 30) || (x >= 43 && x <= 44) || (y >= 39 && y <= 40 && x > 20) || (y >= 7 && y <= 8 && x > 42)) this.tiles[y][x] = 'path';
        if (x >= 31 && x <= 37 && y >= 30 && y <= 32) this.tiles[y][x] = 'bridge';
      }
      this.objects.push(object('house', 8, 27, { label: 'Mr. Hawthorn', destination: 'elder' }), object('house', 14, 28, { label: 'Rupee shop', destination: 'shop' }), object('house', 6, 35, { label: 'Apple arcade', destination: 'arcade' }));
      this.objects.push(object('sign', 11, 28, { text: 'Welcome to Willowfield! Mr. Hawthorn has a sword for you. Visit the red roof to the left. The bridge to the east leads to the dungeons.' }), object('sign', 28, 31, { text: 'Six seals, six hearts. Follow the numbered temples on your map. Mossroot Ruins (1) lies northwest of the village.' }), object('sign', 59, 40, { text: 'A curious wall to the RIGHT hides a shortcut to Stormkeep. Try a bomb. A hero named ABC knows the trick already!' }), object('secret', 60, 40, { label: 'Cracked wall' }));
      DUNGEONS.forEach((d, i) => {
        this.objects.push(object('dungeon', d.x, d.y, { id: i + 1, label: d.name }));
        for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) this.tiles[d.y + dy][d.x + dx] = 'path';
      });
      for (let i = 0; i < 55; i++) {
        const x = 3 + hash(i, 8) % 71, y = 3 + hash(i, 19) % 45;
        if (['grass', 'path'].includes(this.tiles[y][x]) && !this.objects.some(o => distance(o, point(x, y)) < 48)) this.objects.push(object('pot', x, y, { rupees: 8 + i % 3 * 4 }));
      }
      for (const [x, y, type] of [[21, 25, 'slime'], [28, 13, 'skeleton'], [42, 28, 'dino'], [52, 33, 'slime'], [62, 26, 'skeleton'], [21, 38, 'slime'], [48, 14, 'dino']]) this.spawnEnemy(type, x, y, 3);
      this.placePlayer(this.returnPoint);
    }

    loadHouse(kind) {
      this.room = kind;
      this.theme = 'house';
      this.roomName = kind === 'elder' ? "Hawthorn's House" : kind === 'shop' ? 'The Rupee Shop' : 'Apple Arcade';
      this.grid(16, 12, 'wood');
      this.objects.push(object('exit', 8, 10, { label: 'Back outside' }));
      if (kind === 'elder') {
        this.objects.push(object('npc', 8, 4, { label: 'Mr. Hawthorn' }), object('sign', 4, 4, { text: 'Jump: Space or ↟. Swing: X or ⚔. Hold C or ⛨ to shield. Read and enter: E or ✦. Pots hide rupees. The grass ruins hide your first seal.' }));
      } else if (kind === 'shop') {
        this.objects.push(object('npc', 8, 4, { label: 'Mara the shopkeeper' }));
      } else {
        this.objects.push(object('npc', 3, 4, { label: 'Arcade host' }));
        for (let i = 0; i < 3; i++) this.objects.push(object('target', 7 + i * 3, 3, { hits: 0 }));
        this.objects.push(object('sign', 8, 7, { text: 'Apple arcade: swing your sword to shoot an icy apple at the targets! Bop each target three times for 100 rupees. Free entry; prizes once per visit.' }));
      }
      for (const x of [3, 12]) this.objects.push(object('pot', x, 8, { rupees: 12 }));
      this.placePlayer(point(8, 9));
    }

    enterDungeon(id, shortcut = false) {
      if (!this.player.sword) { this.message('Find Mr. Hawthorn first. You need a sword for the dungeons!'); return false; }
      if (!shortcut && id > 1 && !this.completed.includes(id - 1)) { this.message(`Find the seal in ${DUNGEONS[id - 2].name} first.`); return false; }
      const d = DUNGEONS[id - 1];
      if (!d) return false;
      this.room = id;
      this.theme = d.theme;
      this.roomName = d.name;
      this.grid(34, 25, d.theme === 'ice' ? 'ice' : d.theme === 'house' ? 'wood' : 'stone');
      this.key = shortcut;
      this.bossDefeated = this.completed.includes(id);
      for (let y = 2; y < 23; y++) {
        if (![8, 9, 19, 20, 21].includes(y)) this.tiles[y][12] = 'wall';
        if (![11, 12, 20, 21].includes(y)) this.tiles[y][23] = 'wall';
      }
      const hazard = id === 5 ? 'lava' : id === 2 ? 'ice' : id === 3 ? 'bramble' : 'water';
      for (let x = 2; x <= 11; x++) for (let y = 12; y <= 14; y++) this.tiles[y][x] = hazard;
      for (let y = 12; y <= 14; y++) this.tiles[y][7] = id === 5 || id === 4 ? 'ladder' : 'bridge';
      this.tiles[15][4] = 'pad';
      this.tiles[11][4] = 'pad';
      if (id === 3) {
        for (let y = 3; y < 11; y++) this.tiles[y][3] = 'bramble';
        this.objects.push(object('sign', 6, 17, { text: 'The garden path on the RIGHT is safe. The brambles on the left bite! No wrong turn makes you start the whole game over.' }));
      }
      if (id === 4) for (let y = 4; y <= 17; y++) this.tiles[y][19] = y % 4 === 0 ? 'pad' : 'water';
      this.objects.push(object('exit', 3, 22, { label: 'Leave dungeon' }), object('sign', 5, 20, { text: d.hint }), object('gate', 23, 11, { label: 'Brass-key gate' }), object('gate', 23, 12, { label: 'Brass-key gate' }), object('gate', 23, 20, { label: 'Brass-key gate' }), object('gate', 23, 21, { label: 'Brass-key gate' }));
      for (const [x, y] of [[16, 5], [17, 5], [18, 5], [5, 5], [9, 17], [17, 17], [27, 19]]) this.objects.push(object('pot', x, y, { rupees: 15, key: x === 17 && y === 5 }));
      if (id === 2) for (const [x, y] of [[7, 7], [15, 10], [19, 18], [27, 15]]) this.objects.push(object('clock', x, y));
      this.objects.push(object('heart', 10, 7), object('heart', 20, 19));
      this.spawnEnemy('skeleton', 8, 18, 3);
      this.spawnEnemy(id === 3 ? 'slime' : 'skeleton', 17, 11, 3);
      this.spawnEnemy(id >= 5 ? 'dino' : 'slime', 20, 6, 3);
      if (!this.bossDefeated) this.spawnEnemy(id === 6 ? 'boss' : 'octopus', 29, 6, id === 6 ? 20 : 4 + id, true);
      else this.objects.push(object('seal', 29, 6, { collected: true }));
      this.placePlayer(shortcut ? point(28, 10) : point(3, 20));
      this.message(shortcut ? 'Secret found! Straight to the final battle. You can win with your starting sword!' : d.hint);
      return true;
    }

    spawnEnemy(type, x, y, hp, boss = false) {
      this.enemies.push({ type, ...point(x, y), home: point(x, y), hp, maxHp: hp, boss, frozen: 0, hurt: 0, cooldown: boss ? 3 : 2, charge: 0, phase: 0 });
    }
    tileAt(x, y) { return this.tiles[Math.floor(y / TILE)]?.[Math.floor(x / TILE)] || 'wall'; }
    solid(x, y) {
      const tile = this.tileAt(x, y);
      if (tile === 'wall' || tile === 'tree') return true;
      return this.objects.some(o => o.type === 'gate' && !this.key && Math.abs(o.x - x) < 15 && Math.abs(o.y - y) < 15);
    }
    move(entity, dx, dy, radius = 7) {
      const clear = (x, y) => ![[-radius, -radius], [radius, -radius], [-radius, radius], [radius, radius]].some(([a, b]) => this.solid(x + a, y + b));
      if (clear(entity.x + dx, entity.y)) entity.x += dx;
      else if (entity === this.player) entity.vx = 0;
      if (clear(entity.x, entity.y + dy)) entity.y += dy;
      else if (entity === this.player) entity.vy = 0;
    }

    nearObject() {
      return this.objects.filter(o => ['house', 'dungeon', 'sign', 'npc', 'exit', 'secret', 'gate'].includes(o.type) && distance(o, this.player) < 46).sort((a, b) => distance(a, this.player) - distance(b, this.player))[0];
    }
    interact() {
      if (this.mode !== 'playing') return;
      const o = this.nearObject();
      if (!o) { this.message('Move close to a door, sign, or villager, then tap TALK.'); return; }
      if (o.type === 'house') {
        this.returnPoint = { x: o.x, y: o.y + TILE * 2 };
        this.loadHouse(o.destination);
        this.message('Walk up to your new friend and tap TALK.');
      } else if (o.type === 'exit') this.loadWorld();
      else if (o.type === 'dungeon') {
        this.returnPoint = { x: o.x, y: o.y + TILE * 2 };
        this.enterDungeon(o.id);
      } else if (o.type === 'sign') this.emit('dialog', o.text);
      else if (o.type === 'gate') this.message(this.key ? 'The brass key opened every gate. Walk on through!' : 'The key is under the middle pot in the northeast room.');
      else if (o.type === 'secret') {
        if (this.secretOpen) { this.returnPoint = point(60, 42); this.enterDungeon(6, true); }
        else this.message('A cracked wall… a bomb could open it. The name ABC reveals the secret too.');
      } else if (this.room === 'elder') {
        if (!this.player.sword) {
          this.player.sword = true;
          this.player.rupees += 20;
          this.emit('dialog', `Hello, ${this.name}! I'm Mr. Hawthorn. Take this sword and 20 rupees. The first seal is in Mossroot Ruins, northwest of our village. Swing to break pots and bop monsters. Jump over danger. You can do this!`);
          this.emit('save');
        } else this.emit('dialog', 'Six dungeons hide six seals. Each seal adds a heart and heals you! The first gives an Ice Sword, the second a Frozen Shield. You are never too young to be a hero.');
      } else if (this.room === 'shop') this.emit('shop', 'Welcome! Rupees are money, not points. Break pots and defeat monsters to find more. Hold SHIELD to guard; wooden shields break against skeletons. The Frozen Shield never breaks.');
      else this.emit('dialog', 'Welcome to the Apple Arcade! Swing your sword to fire apples. Hit each face three times for a 100-rupee prize. Crying, grumpy, and jolly… all friendly targets!');
    }

    buy(item) {
      const prices = { shield: 20, potion: 10, bombs: 100 };
      if (this.room !== 'shop' || !(item in prices)) return false;
      const p = this.player;
      if (item === 'shield' && (p.shield || p.frozenShield)) { this.message('You already have a shield.'); return false; }
      if (item === 'potion' && p.hp === p.maxHp) { this.message('Your hearts are already full.'); return false; }
      if (p.rupees < prices[item]) { this.message('Not enough rupees yet. Try breaking some pots!'); return false; }
      p.rupees -= prices[item];
      if (item === 'shield') p.shield = true;
      if (item === 'potion') p.hp = p.maxHp;
      if (item === 'bombs') p.bombs = Math.min(9999, p.bombs + 100);
      this.message(item === 'bombs' ? '100 bombs! Tap BOMB to blast nearby monsters, pots, and cracked walls.' : 'All yours. Happy adventuring!');
      this.emit('save');
      return true;
    }

    jump() {
      if (this.mode !== 'playing' || this.player.jump > 0) return;
      this.player.jump = this.tileAt(this.player.x, this.player.y) === 'pad' ? 1.1 : .65;
      this.player.jumpDuration = this.player.jump;
      this.effects.push({ type: 'dust', ...this.player, life: .3 });
    }

    breakPot(o) {
      this.objects = this.objects.filter(v => v !== o);
      this.player.rupees = Math.min(9999, this.player.rupees + o.rupees);
      this.effects.push({ type: 'coins', ...o, life: .7 });
      if (o.key) { this.key = true; this.message('Brass key found! The gates to the final room are open.'); }
      else this.message(`+${o.rupees} rupees!`);
    }

    attack() {
      const p = this.player;
      if (this.mode !== 'playing' || p.cooldown > 0) return;
      if (!p.sword) { this.message('Your sword is waiting at Mr. Hawthorn’s house.'); return; }
      p.attack = .2;
      p.cooldown = .3;
      const inReach = o => distance(o, p) < 54 && ((o.x - p.x) * p.facing.x + (o.y - p.y) * p.facing.y > -12 || distance(o, p) < 25);
      this.objects.filter(o => o.type === 'pot' && inReach(o)).forEach(o => this.breakPot(o));
      this.enemies.filter(e => inReach(e)).forEach(e => this.hitEnemy(e, 1));
      if (this.room === 'arcade') this.projectiles.push({ ...p, type: 'apple', vx: p.facing.x * 230, vy: p.facing.y * 230, life: 2 });
    }

    bomb() {
      const p = this.player;
      if (this.mode !== 'playing' || p.cooldown > 0) return;
      if (!p.bombs) { this.message('Buy 100 bombs for 100 rupees at the village shop.'); return; }
      p.bombs--;
      p.cooldown = .5;
      this.effects.push({ type: 'blast', x: p.x, y: p.y, life: .5 });
      this.objects.filter(o => o.type === 'pot' && distance(o, p) < 100).forEach(o => this.breakPot(o));
      this.enemies.filter(e => distance(e, p) < 100).forEach(e => this.hitEnemy(e, 3));
      if (this.objects.some(o => o.type === 'secret' && distance(o, p) < 100)) { this.secretOpen = true; this.message('A secret doorway! Tap TALK at the cracked wall to skip to the final battle.'); this.emit('save'); }
    }

    hitEnemy(e, damage) {
      if (e.hp <= 0) return;
      e.hp -= damage;
      e.hurt = .18;
      if (this.player.iceSword && !e.boss) e.frozen = 2;
      if (e.hp <= 0) {
        this.player.rupees = Math.min(9999, this.player.rupees + (e.boss ? 50 : 15));
        this.effects.push({ type: 'coins', x: e.x, y: e.y, life: .8 });
        if (e.boss) {
          this.bossDefeated = true;
          this.objects.push(object('seal', Math.floor(e.x / TILE), Math.floor(e.y / TILE)));
          this.message('You did it! Pick up the glowing seal and heart container.');
        }
      }
    }

    damage(amount, source = 'hazard') {
      const p = this.player;
      if (this.mode !== 'playing' || p.invincible > 0 || p.jump > 0) return;
      if (p.guarding && source !== 'hazard' && (p.shield || p.frozenShield)) {
        p.invincible = .4;
        if (source === 'skeleton' && !p.frozenShield) { p.shield = false; this.message('The skeleton broke your wooden shield! Find the Frozen Shield in dungeon 2.'); }
        return;
      }
      p.hp = Math.max(0, p.hp - amount);
      p.invincible = 1.4;
      if (p.hp === 0) { this.mode = 'defeated'; this.emit('defeat', 'The friendly hand spirit brings you back to safety. Your seals and equipment are safe. Take a breath, then try again!'); }
    }

    retry() {
      if (this.mode !== 'defeated') return;
      this.mode = 'playing';
      this.player.hp = this.player.maxHp;
      this.loadWorld();
      this.message('A fresh start, with all your seals and equipment. You’ve got this!');
      this.emit('save');
    }

    collectSeal(o) {
      if (o.collected) return;
      const id = this.room;
      if (!this.completed.includes(id)) {
        this.completed.push(id);
        this.player.maxHp = 3 + this.completed.length;
        this.player.hp = this.player.maxHp;
        this.player.iceSword ||= id === 1;
        this.player.frozenShield ||= id === 2;
        this.player.fins ||= id === 4;
      }
      o.collected = true;
      if (id === 6) { this.mode = 'won'; this.emit('win', `${this.name}, you saved Willowfield! The Storm Dino is now a friendly garden guardian. ${this.completed.length} seals found, ${this.player.maxHp} hearts earned. You can keep exploring to find every secret.`); }
      else this.message(`Seal ${id} recovered! ${DUNGEONS[id - 1].reward}. Return to the overworld using the doorway.`);
      this.emit('save');
    }

    tick(dt, input = {}) {
      if (this.mode !== 'playing') return;
      dt = clamp(Number.isFinite(dt) ? dt : 0, 0, .05);
      this.elapsed += dt;
      this.roomTime += dt;
      const p = this.player;
      for (const k of ['invincible', 'jump', 'attack', 'cooldown']) p[k] = Math.max(0, p[k] - dt);
      p.guarding = !!input.shield && (p.shield || p.frozenShield);
      let ix = clamp(input.x || 0, -1, 1), iy = clamp(input.y || 0, -1, 1);
      const magnitude = Math.hypot(ix, iy);
      if (magnitude > 1) { ix /= magnitude; iy /= magnitude; }
      if (magnitude > .1) p.facing = { x: ix / Math.hypot(ix, iy), y: iy / Math.hypot(ix, iy) };
      const tile = this.tileAt(p.x, p.y);
      const speed = p.guarding ? 65 : p.jump > 0 ? 185 : 112;
      const smooth = tile === 'ice' && p.jump <= 0 ? 2.8 : 22;
      p.vx += (ix * speed - p.vx) * Math.min(1, dt * smooth);
      p.vy += (iy * speed - p.vy) * Math.min(1, dt * smooth);
      this.move(p, p.vx * dt, p.vy * dt);
      const landed = this.tileAt(p.x, p.y);
      const dangerous = landed === 'lava' || landed === 'bramble' || (landed === 'water' && !p.fins);
      if (dangerous && p.jump <= 0) {
        this.damage(1);
        Object.assign(p, this.safe, { vx: 0, vy: 0 });
        this.message(landed === 'water' ? 'Deep water! Use the bridge, ladder, or jump pads. Fins are in dungeon 4.' : 'Ouch! Jump over danger or take the safe crossing.');
      } else if (!dangerous && p.jump <= 0) this.safe = { x: p.x, y: p.y };
      this.objects.slice().forEach(o => {
        if (distance(o, p) > 19) return;
        if (o.type === 'heart' && p.hp < p.maxHp) { p.hp++; this.objects = this.objects.filter(v => v !== o); }
        if (o.type === 'clock') { this.elapsed = Math.max(0, this.elapsed - 30); this.objects = this.objects.filter(v => v !== o); this.message('A magic clock! −30 seconds. There is no time limit.'); }
        if (o.type === 'seal') this.collectSeal(o);
      });
      for (const e of this.enemies) {
        if (e.hp <= 0) continue;
        e.hurt = Math.max(0, e.hurt - dt);
        e.frozen = Math.max(0, e.frozen - dt);
        if (e.frozen > 0) continue;
        const dist = distance(e, p);
        e.phase += dt;
        if (e.type === 'slime' && e.phase % 5 < 1) continue;
        e.cooldown -= dt;
        if (e.charge > 0) {
          e.charge = Math.max(0, e.charge - dt);
          if (e.charge === 0) {
            const angle = Math.atan2(p.y - e.y, p.x - e.x);
            for (const spread of e.boss ? [-.35, 0, .35] : [0]) this.projectiles.push({ type: e.type === 'octopus' ? 'acorn' : 'bolt', x: e.x, y: e.y, vx: Math.cos(angle + spread) * 125, vy: Math.sin(angle + spread) * 125, life: 3, damage: e.type === 'boss' ? 2 : 1 });
            e.cooldown = e.boss ? 3.2 : 3;
          }
        } else if ((e.type === 'dino' || e.boss) && dist < 320 && e.cooldown <= 0) e.charge = 1;
        if (!e.boss && dist < 180 && dist > 20 && e.charge <= 0) this.move(e, (p.x - e.x) / dist * dt * 35, (p.y - e.y) / dist * dt * 35);
        if (dist < (e.boss ? 25 : 19)) this.damage(1, e.type);
      }
      for (const shot of this.projectiles) {
        shot.x += shot.vx * dt;
        shot.y += shot.vy * dt;
        shot.life -= dt;
        if (this.solid(shot.x, shot.y)) shot.life = 0;
        if (shot.type === 'apple') {
          const target = this.objects.find(o => o.type === 'target' && o.hits < 3 && distance(o, shot) < 19);
          if (target && shot.life > 0) {
            target.hits++;
            shot.life = 0;
            if (target.hits === 3) { p.rupees = Math.min(9999, p.rupees + 100); this.message('Bop, bop, bop! A 100-rupee arcade prize!'); }
          }
        } else if (shot.life > 0 && distance(shot, p) < 12) { this.damage(shot.damage, 'bolt'); shot.life = 0; }
      }
      this.projectiles = this.projectiles.filter(s => s.life > 0);
      this.effects.forEach(e => e.life -= dt);
      this.effects = this.effects.filter(e => e.life > 0);
    }
  }
  const api = { Game, TILE, DUNGEONS, point, hash, distance };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.GrassAdventure = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
