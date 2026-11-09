const test = require('node:test');
const assert = require('node:assert/strict');
const { Game, DUNGEONS, TILE, point } = require('../engine.js');

function step(game, seconds, input = {}) {
  for (let i = 0; i < Math.ceil(seconds / .02); i++) game.tick(.02, input);
}
function standBy(game, object) {
  Object.assign(game.player, { x: object.x, y: object.y + 30, facing: { x: 0, y: -1 }, cooldown: 0 });
}

test('hero starts unarmed and earns a sword and rupees by talking indoors', () => {
  const g = new Game();
  assert.equal(g.player.sword, false);
  assert.equal(g.enterDungeon(1), false);
  standBy(g, g.objects.find(o => o.destination === 'elder'));
  g.interact();
  assert.equal(g.room, 'elder');
  standBy(g, g.objects.find(o => o.type === 'npc'));
  g.interact();
  assert.equal(g.player.sword, true);
  assert.equal(g.player.rupees, 20);
  g.interact();
  assert.equal(g.player.rupees, 20, 'sword gift is not repeatable');
});

test('world layout is deterministic and movement collides with walls', () => {
  const a = new Game(), b = new Game();
  assert.deepEqual(a.tiles, b.tiles);
  assert.deepEqual(a.objects, b.objects);
  assert.ok(a.width * TILE > 1500);
  Object.assign(a.player, point(1, 3));
  step(a, 2, { x: -1 });
  assert.ok(a.player.x >= TILE + 7);
  assert.equal(a.player.hp, 3);
});

test('diagonal movement is normalized and oversized frame deltas are capped', () => {
  const a = new Game(), b = new Game();
  Object.assign(a.player, point(10, 31));
  Object.assign(b.player, point(10, 31));
  step(a, .1, { x: 1 });
  step(b, .1, { x: 1, y: 1 });
  const origin = point(10, 31);
  assert.ok(Math.abs(Math.hypot(a.player.x - origin.x, a.player.y - origin.y) - Math.hypot(b.player.x - origin.x, b.player.y - origin.y)) < .01);
  a.tick(100);
  assert.ok(a.elapsed < .2);
});

test('dungeon progression, keys, guardians and heart rewards make all six winnable', () => {
  const g = new Game();
  g.player.sword = true;
  assert.equal(g.enterDungeon(2), false);
  for (let id = 1; id <= 6; id++) {
    assert.equal(g.enterDungeon(id), true);
    const gate = g.objects.find(o => o.type === 'gate');
    assert.equal(g.solid(gate.x, gate.y), true);
    const pot = g.objects.find(o => o.key);
    standBy(g, pot);
    g.attack();
    assert.equal(g.key, true);
    assert.equal(g.solid(gate.x, gate.y), false);
    const boss = g.enemies.find(e => e.boss);
    const hits = boss.hp;
    assert.equal(id === 6 ? hits : hits > 0, id === 6 ? 20 : true);
    standBy(g, boss);
    for (let i = 0; i < hits; i++) { g.player.cooldown = 0; g.attack(); }
    assert.ok(boss.hp <= 0);
    const seal = g.objects.find(o => o.type === 'seal');
    Object.assign(g.player, { x: seal.x, y: seal.y });
    g.tick(.02);
    assert.ok(g.completed.includes(id));
    assert.equal(g.player.maxHp, 3 + id);
    assert.equal(g.player.hp, g.player.maxHp);
    g.collectSeal(seal);
    assert.equal(g.player.maxHp, 3 + id, 'rewards cannot be collected twice');
  }
  assert.equal(g.mode, 'won');
  assert.equal(g.player.maxHp, 9);
  assert.ok(g.player.iceSword && g.player.frozenShield && g.player.fins);
});

test('ice sword freezes regular enemies, while the boss still takes twenty swings', () => {
  const g = new Game();
  g.player.sword = g.player.iceSword = true;
  g.enterDungeon(6, true);
  const enemy = g.enemies.find(e => !e.boss);
  standBy(g, enemy);
  g.attack();
  assert.equal(enemy.frozen, 2);
  const boss = g.enemies.find(e => e.boss);
  standBy(g, boss);
  g.player.cooldown = 0;
  g.attack();
  assert.equal(boss.hp, 19);
  assert.equal(boss.frozen, 0);
  g.attack();
  assert.equal(boss.hp, 19, 'attack cooldown prevents instant multi-hits');
});

test('jumping avoids hazards; bridges and ladders are safe; fins allow swimming', () => {
  const g = new Game();
  g.player.sword = true;
  g.enterDungeon(5, true);
  const safe = point(4, 15);
  g.safe = safe;
  Object.assign(g.player, point(4, 13), { invincible: 0 });
  g.jump();
  g.tick(.02);
  assert.equal(g.player.hp, 3);
  g.player.jump = 0;
  g.tick(.02);
  assert.equal(g.player.hp, 2);
  assert.equal(g.player.y, safe.y);
  Object.assign(g.player, point(7, 13), { invincible: 0 });
  g.tick(.02);
  assert.equal(g.player.hp, 2);
  g.loadWorld();
  g.player.fins = true;
  Object.assign(g.player, point(34, 20), { invincible: 0 });
  g.tick(.02);
  assert.equal(g.player.hp, 2);
});

test('ice momentum persists and clocks are optional with no timeout', () => {
  const g = new Game();
  g.player.sword = true;
  g.enterDungeon(2, true);
  step(g, .4, { x: 1 });
  const vx = g.player.vx;
  g.tick(.02);
  assert.ok(g.player.vx > vx * .8);
  g.elapsed = 100;
  const clock = g.objects.find(o => o.type === 'clock');
  Object.assign(g.player, { x: clock.x, y: clock.y, vx: 0, vy: 0 });
  g.tick(.02);
  assert.ok(g.elapsed < 71);
  assert.equal(g.mode, 'playing');
});

test('wood shield breaks against skeletons but frozen shield blocks lightning', () => {
  const g = new Game();
  const p = g.player;
  p.shield = p.guarding = true;
  p.invincible = 0;
  g.damage(1, 'skeleton');
  assert.equal(p.shield, false);
  p.frozenShield = true;
  p.invincible = 0;
  g.damage(2, 'bolt');
  assert.equal(p.hp, 3);
  assert.equal(p.frozenShield, true);
  p.guarding = false;
  p.invincible = 0;
  g.damage(2, 'bolt');
  assert.equal(p.hp, 1);
});

test('shops charge currency, bombs break pots and reveal a usable secret shortcut', () => {
  const g = new Game();
  g.player.sword = true;
  g.player.rupees = 120;
  assert.equal(g.buy('bombs'), false, 'cannot buy outside the shop');
  g.loadHouse('shop');
  assert.equal(g.buy('shield'), true);
  assert.equal(g.buy('shield'), false);
  assert.equal(g.buy('bombs'), true);
  assert.equal(g.player.rupees, 0);
  assert.equal(g.player.bombs, 100);
  assert.equal(g.buy('potion'), false);
  g.loadWorld();
  const secret = g.objects.find(o => o.type === 'secret');
  standBy(g, secret);
  g.bomb();
  assert.equal(g.secretOpen, true);
  assert.equal(g.player.bombs, 99);
  g.interact();
  assert.equal(g.room, 6);
  assert.equal(g.key, true);
  assert.equal(g.enemies.find(e => e.boss).hp, 20);
});

test('ABC reveals the shortcut without money, but still requires a sword', () => {
  const g = new Game('ABC');
  assert.equal(g.secretOpen, true);
  standBy(g, g.objects.find(o => o.type === 'secret'));
  g.interact();
  assert.equal(g.room, 'world');
  g.player.sword = true;
  g.interact();
  assert.equal(g.room, 6);
});

test('arcade apples hit targets and award a single prize per target', () => {
  const g = new Game();
  g.player.sword = true;
  g.loadHouse('arcade');
  const target = g.objects.find(o => o.type === 'target');
  standBy(g, target);
  for (let i = 0; i < 3; i++) { g.attack(); step(g, .4); }
  assert.equal(target.hits, 3);
  assert.equal(g.player.rupees, 100);
  g.attack();
  step(g, .4);
  assert.equal(g.player.rupees, 100);
});

test('defeat offers immediate retry preserving progress and equipment', () => {
  const g = new Game();
  g.completed = [1, 2];
  g.player.sword = g.player.iceSword = true;
  g.player.maxHp = 5;
  g.player.rupees = 50;
  g.player.invincible = 0;
  g.damage(3);
  assert.equal(g.mode, 'defeated');
  const elapsed = g.elapsed;
  step(g, 10);
  assert.equal(g.elapsed, elapsed);
  g.retry();
  assert.equal(g.mode, 'playing');
  assert.equal(g.player.hp, 5);
  assert.equal(g.player.sword, true);
  assert.equal(g.player.rupees, 50);
  assert.deepEqual(g.completed, [1, 2]);
});

test('save/resume validates stored values and preserves earned items', () => {
  const g = new Game('Leaf');
  g.completed = [1, 2, 4];
  g.player.sword = true;
  g.player.bombs = 100;
  const restored = new Game('ignored', g.save());
  assert.equal(restored.name, 'Leaf');
  assert.equal(restored.player.maxHp, 6);
  assert.ok(restored.player.iceSword && restored.player.frozenShield && restored.player.fins);
  assert.equal(restored.player.bombs, 100);
  const bad = new Game('Safe', { version: 1, name: {}, completed: [1, 1, 9, '2', null], rupees: -100, bombs: Infinity, elapsed: 'wrong', shield: 'yes' });
  assert.deepEqual(bad.completed, [1]);
  assert.equal(bad.player.rupees, 0);
  assert.equal(bad.player.bombs, 0);
  assert.equal(bad.player.shield, false);
  assert.equal(bad.elapsed, 0);
  g.completed.push(6);
  g.mode = 'playing';
  assert.equal(new Game('ignored', g.save()).mode, 'won', 'continued exploration preserves victory');
});

test('lightning has a visible warning before projectiles appear', () => {
  const g = new Game();
  g.player.sword = true;
  g.enterDungeon(6, true);
  const boss = g.enemies.find(e => e.boss);
  boss.cooldown = 0;
  g.tick(.02);
  assert.ok(boss.charge > 0);
  assert.equal(g.projectiles.length, 0);
  step(g, 1.05);
  assert.ok(g.projectiles.length > 0);
  assert.ok(g.player.hp > 0, 'warning gives time to react');
});

test('every dungeon has a traversable route from entry to key and guardian', () => {
  for (let id = 1; id <= DUNGEONS.length; id++) {
    const g = new Game();
    g.player.sword = true;
    g.enterDungeon(id, true);
    g.key = false;
    const key = g.objects.find(o => o.key);
    function reachable(start, destination) {
      const queue = [start], seen = new Set();
      for (let i = 0; i < queue.length; i++) {
        const [x, y] = queue[i], index = `${x},${y}`;
        if (seen.has(index)) continue;
        seen.add(index);
        if (x === destination[0] && y === destination[1]) return true;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const pos = point(x + dx, y + dy);
          if (!g.solid(pos.x, pos.y) && !['water', 'lava', 'bramble'].includes(g.tileAt(pos.x, pos.y))) queue.push([x + dx, y + dy]);
        }
      }
      return false;
    }
    const keyTile = [Math.floor(key.x / TILE), Math.floor(key.y / TILE) + 1];
    assert.equal(reachable([3, 20], keyTile), true, `dungeon ${id} key accessible without damage`);
    g.key = true;
    const boss = g.enemies.find(e => e.boss);
    assert.equal(reachable(keyTile, [Math.floor(boss.x / TILE), Math.floor(boss.y / TILE) + 1]), true, `dungeon ${id} guardian accessible`);
  }
});
