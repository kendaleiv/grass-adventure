/* Pixel art is drawn locally: no downloads, fonts, or asset services required. */
(function () {
  'use strict';
  const { Game, TILE, DUNGEONS, hash, distance } = window.GrassAdventure;
  const $ = id => document.getElementById(id);
  const canvas = $('game'), ctx = canvas.getContext('2d');
  const mini = $('minimap'), mc = mini.getContext('2d');
  const storageKey = 'grass-adventure-v1';
  let saved = null, storageAvailable = true;
  try { saved = JSON.parse(localStorage.getItem(storageKey)); } catch { storageAvailable = false; }
  let game = new Game('Sprout');
  let started = false, paused = false, lastTime = 0, saveTime = 0, toastUntil = 0;
  let camera = { x: 0, y: 0 };
  const keys = new Set();
  const touch = { x: 0, y: 0, shield: false, attack: false };
  const palette = {
    grass: ['#74954a', '#6a8944', '#59743c', '#a1b959'],
    ice: ['#9bcaca', '#b6dddd', '#668da3', '#e2f7e5'],
    garden: ['#697d43', '#778d4b', '#465e3a', '#c4ba6a'],
    water: ['#718f86', '#819e93', '#466c66', '#bed3a6'],
    lava: ['#8b7863', '#9b886c', '#4c4946', '#eec087'],
    castle: ['#728184', '#829197', '#485e68', '#b9c5b5'],
    house: ['#b68b55', '#a77d4d', '#634e39', '#edd39a']
  };

  function showToast(text) {
    $('toast').textContent = text;
    $('toast').classList.add('visible');
    toastUntil = performance.now() + 4200;
  }
  function save() {
    if (!started) return;
    try { localStorage.setItem(storageKey, JSON.stringify(game.save())); }
    catch {
      storageAvailable = false;
      document.querySelector('.bottom-note>span').textContent = 'Saving unavailable — keep this tab open';
    }
  }
  function clearInput() {
    keys.clear();
    Object.assign(touch, { x: 0, y: 0, shield: false, attack: false });
    $('stick').style.transform = '';
    document.querySelectorAll('.held').forEach(b => b.classList.remove('held'));
  }
  function dialog(title, text, kind = 'dialog') {
    clearInput();
    $('info-title').textContent = title;
    $('info-kicker').textContent = kind === 'shop' ? 'THE RUPEE SHOP' : kind === 'win' ? 'WILLOWFIELD IS SAFE' : kind === 'defeat' ? 'A HELPING HAND' : 'TALES FROM WILLOWFIELD';
    $('info-content').replaceChildren();
    const p = document.createElement('p');
    p.textContent = text;
    $('info-content').append(p);
    $('shop-actions').hidden = kind !== 'shop';
    $('restart').hidden = kind !== 'defeat' && kind !== 'win';
    $('info-close').textContent = kind === 'defeat' ? 'TRY AGAIN →' : kind === 'win' ? 'KEEP EXPLORING →' : 'BACK TO ADVENTURE →';
    $('info').dataset.kind = kind;
    if (!$('info').open) $('info').showModal();
  }
  function events() {
    while (game.events.length) {
      const e = game.events.shift();
      if (e.type === 'message') showToast(e.text);
      if (e.type === 'save') save();
      if (e.type === 'dialog') dialog('A word from a friend', e.text);
      if (e.type === 'shop') dialog('A little something useful?', e.text, 'shop');
      if (e.type === 'defeat') dialog('Every hero needs a retry.', e.text, 'defeat');
      if (e.type === 'win') { save(); dialog('You did it, adventurer!', e.text, 'win'); }
    }
    updateHUD();
  }
  function active() { return started && !paused && !document.hidden && !$('info').open && !$('welcome').open && !$('journal').classList.contains('open'); }
  function action(fn) {
    if (!active()) return;
    game[fn]();
    events();
  }
  function closeInfo() {
    const kind = $('info').dataset.kind;
    $('info').close();
    if (kind === 'defeat') game.retry();
    if (kind === 'win') game.mode = 'playing';
    clearInput();
    events();
    canvas.focus({ preventScroll: true });
  }
  $('info-close').addEventListener('click', closeInfo);
  $('info').addEventListener('cancel', e => { e.preventDefault(); closeInfo(); });
  $('welcome').addEventListener('cancel', e => e.preventDefault());

  function start(fresh = false) {
    game = new Game($('hero-name').value, fresh ? null : saved);
    started = true;
    paused = false;
    $('pause').textContent = 'Ⅱ';
    $('welcome').close();
    clearInput();
    updateHUD();
    save();
    if (game.mode === 'won') dialog('Welcome back, hero!', 'Willowfield is safe. Your seals and equipment are waiting. Keep exploring!', 'win');
    else showToast(game.player.sword ? `Welcome back, ${game.name}! Your equipment and seals are safe.` : `Welcome, ${game.name}! Visit the red-roofed house to get your sword.`);
    canvas.focus({ preventScroll: true });
  }
  $('start-form').addEventListener('submit', e => { e.preventDefault(); start(); });
  $('fresh-start').addEventListener('click', () => {
    saved = null;
    $('hero-name').disabled = false;
    $('hero-name').value = 'Sprout';
    $('start-button').textContent = "LET'S ADVENTURE →";
    $('fresh-start').hidden = true;
  });
  $('restart').addEventListener('click', () => {
    if (!window.confirm('Start over and clear your seals and equipment?')) return;
    $('info').close();
    saved = null;
    $('hero-name').disabled = false;
    start(true);
  });
  $('help').addEventListener('click', () => {
    if ($('welcome').open) return;
    dialog("The explorer's guide", 'Move with the touch stick, WASD, or arrow keys. Tap TALK (E) beside doors, signs, or people. SWORD (X) swings in the direction you last moved; hold it to keep swinging. JUMP (Space) clears water and lava; round pads give longer jumps. Hold SHIELD (C) to block hits. BOMB (B) blasts nearby objects. Find Mr. Hawthorn in the red-roofed house for your first sword. Dungeons open in order and each seal adds a heart. The map numbers show their locations. There is no time limit, and retry keeps your equipment. Name your hero ABC to reveal the secret final-battle shortcut.');
  });
  $('pause').addEventListener('click', () => {
    if (!started || $('info').open) return;
    paused = !paused;
    clearInput();
    $('pause').textContent = paused ? '▶' : 'Ⅱ';
    $('pause').setAttribute('aria-label', paused ? 'Resume game' : 'Pause game');
    showToast(paused ? 'Paused. Take a little breather.' : 'Adventure on!');
  });
  $('fullscreen').addEventListener('click', async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else if (document.documentElement.requestFullscreen) await document.documentElement.requestFullscreen();
      else showToast('This browser does not offer fullscreen. Add the game to your Home Screen for an app-like view.');
    } catch { showToast('Fullscreen is unavailable here. You can still play in this window.'); }
  });
  document.addEventListener('fullscreenchange', () => {
    $('fullscreen').setAttribute('aria-label', document.fullscreenElement ? 'Exit fullscreen' : 'Toggle fullscreen');
    resize();
  });
  function toggleMap(open) {
    $('journal').classList.toggle('open', open);
    clearInput();
    $('map-toggle').setAttribute('aria-expanded', String(open));
    if (open) $('journal').scrollIntoView({ behavior: 'smooth', block: 'start' });
    else canvas.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
  $('map-toggle').addEventListener('click', () => toggleMap(!$('journal').classList.contains('open')));
  $('map-close').addEventListener('click', () => toggleMap(false));
  document.querySelectorAll('[data-buy]').forEach(button => button.addEventListener('click', () => {
    game.buy(button.dataset.buy);
    events();
    const feedback = document.createElement('p');
    feedback.textContent = $('toast').textContent;
    $('info-content').replaceChildren(feedback);
  }));

  const bindings = { x: 'attack', ' ': 'jump', e: 'interact', b: 'bomb' };
  window.addEventListener('keydown', e => {
    if (!active() || e.ctrlKey || e.metaKey || e.altKey || /INPUT|TEXTAREA/.test(e.target.tagName)) return;
    const key = e.key.toLowerCase();
    if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'w', 'a', 's', 'd', 'c', ...Object.keys(bindings)].includes(key)) e.preventDefault();
    keys.add(key);
    if (bindings[key] && !e.repeat) action(bindings[key]);
  });
  window.addEventListener('keyup', e => keys.delete(e.key.toLowerCase()));
  window.addEventListener('blur', clearInput);
  document.addEventListener('visibilitychange', () => { clearInput(); lastTime = 0; save(); });
  window.addEventListener('pagehide', save);

  let stickPointer = null;
  const joystick = $('joystick');
  function stickMove(e) {
    if (e.pointerId !== stickPointer || !active()) return;
    const r = joystick.getBoundingClientRect();
    let x = e.clientX - r.left - r.width / 2, y = e.clientY - r.top - r.height / 2;
    const length = Math.hypot(x, y), max = r.width * .31;
    if (length > max) { x *= max / length; y *= max / length; }
    touch.x = length < 5 ? 0 : x / max;
    touch.y = length < 5 ? 0 : y / max;
    $('stick').style.transform = `translate(${x}px,${y}px)`;
  }
  joystick.addEventListener('pointerdown', e => {
    if (stickPointer !== null || !active()) return;
    e.preventDefault();
    stickPointer = e.pointerId;
    joystick.setPointerCapture(e.pointerId);
    stickMove(e);
  });
  joystick.addEventListener('pointermove', stickMove);
  function releaseStick(e) {
    if (e.pointerId !== stickPointer) return;
    stickPointer = null;
    touch.x = touch.y = 0;
    $('stick').style.transform = '';
  }
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) joystick.addEventListener(type, releaseStick);
  for (const [id, fn] of [['attack', 'attack'], ['jump', 'jump'], ['interact', 'interact'], ['bomb', 'bomb'], ['shield', null]]) {
    const b = $(id);
    b.addEventListener('pointerdown', e => {
      if (!active()) return;
      e.preventDefault();
      b.setPointerCapture(e.pointerId);
      b.classList.add('held');
      if (id === 'shield' || id === 'attack') touch[id] = true;
      if (fn) action(fn);
    });
    for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) b.addEventListener(type, () => {
      b.classList.remove('held');
      if (id === 'shield' || id === 'attack') touch[id] = false;
    });
    b.addEventListener('click', e => { if (e.detail === 0 && fn) action(fn); });
  }
  canvas.addEventListener('pointerdown', e => { if (active()) { e.preventDefault(); action('jump'); } });

  let hudCache = '';
  function updateHUD() {
    const p = game.player;
    const cache = JSON.stringify([game.room, game.completed, p.hp, p.maxHp, p.rupees, p.bombs, p.sword, p.iceSword, p.shield, p.frozenShield, p.fins, game.key]);
    if (cache === hudCache) return;
    hudCache = cache;
    $('hearts').replaceChildren();
    for (let i = 0; i < p.maxHp; i++) {
      const heart = document.createElement('span');
      heart.textContent = '♥ ';
      if (i >= p.hp) heart.className = 'empty';
      $('hearts').append(heart);
    }
    $('hearts').setAttribute('aria-label', `${p.hp} of ${p.maxHp} hearts`);
    $('rupees').textContent = p.rupees;
    $('location').textContent = game.roomName;
    $('area-label').textContent = `${game.roomName.toUpperCase()} · ${game.room === 'world' ? 'OVERWORLD' : typeof game.room === 'number' ? `DUNGEON ${game.room}` : 'VILLAGE'}`;
    $('bomb-count').textContent = `BOMB · ${p.bombs}`;
    $('seal-count').textContent = `${game.completed.length} / 6 seals`;
    const next = DUNGEONS.findIndex((_, i) => !game.completed.includes(i + 1));
    $('quest-title').textContent = !p.sword ? 'A sword to start' : next < 0 ? 'A world of little secrets' : typeof game.room === 'number' ? game.key ? 'Face the guardian' : 'Find the brass key' : `Seal ${next + 1}: ${DUNGEONS[next].name}`;
    $('quest-text').textContent = !p.sword ? "Visit Mr. Hawthorn in the village's red-roofed house. Every adventure starts with a hello." : typeof game.room === 'number' ? game.key ? 'The gates are open. Defeat the guardian in the northeast chamber, then touch its glowing seal.' : DUNGEONS[game.room - 1].hint : next < 0 ? 'Willowfield is safe! Visit the arcade, explore the houses, and find the curious wall in the southeast.' : `Find entrance ${next + 1} on your map. ${DUNGEONS[next].hint}`;
    if (typeof game.room === 'number' && game.completed.includes(game.room)) {
      $('quest-title').textContent = 'Seal recovered!';
      $('quest-text').textContent = 'The guardian is resting. Return to the doorway in the southwest to keep exploring Willowfield.';
    }
    $('dungeon-list').replaceChildren();
    DUNGEONS.forEach((d, i) => {
      const li = document.createElement('li'), n = document.createElement('span'), title = document.createElement('span'), status = document.createElement('span');
      const done = game.completed.includes(i + 1);
      li.className = done ? 'done' : '';
      n.className = 'number'; n.textContent = done ? '✓' : i + 1;
      title.textContent = d.name;
      status.className = 'seal-status'; status.textContent = done ? 'FOUND' : i === next && p.sword ? 'NEXT' : '·';
      li.append(n, title, status); $('dungeon-list').append(li);
    });
    $('inventory').textContent = [p.iceSword ? '❄ Ice Sword' : p.sword ? '⚔ Hawthorn’s Sword' : null, p.frozenShield ? '❄ Frozen Shield' : p.shield ? '⛨ Wood Shield' : null, p.fins ? '≈ Swimming fins' : null, p.bombs ? `● ${p.bombs} bombs` : null, typeof game.room === 'number' && game.key ? '⚿ Brass key' : null].filter(Boolean).join(' · ') || "A hopeful heart. That's a start.";
  }

  function resize() {
    const r = canvas.getBoundingClientRect();
    const scale = r.width < 600 ? 1.5 : 2;
    canvas.width = Math.round(r.width / scale);
    canvas.height = Math.round(r.height / scale);
    ctx.imageSmoothingEnabled = false;
  }
  new ResizeObserver(resize).observe(canvas);
  window.addEventListener('resize', resize);

  function rect(x, y, w, h, color) {
    ctx.fillStyle = color;
    ctx.fillRect(Math.round(x), Math.round(y), w, h);
  }
  function text(str, x, y, color = '#fff4cf', size = 7, align = 'center') {
    ctx.font = `bold ${size}px monospace`;
    ctx.textAlign = align;
    ctx.fillStyle = '#172a25';
    ctx.fillText(str, Math.round(x) + 1, Math.round(y) + 1);
    ctx.fillStyle = color;
    ctx.fillText(str, Math.round(x), Math.round(y));
  }
  function shadow(x, y, w = 16) { rect(x - w / 2, y + 4, w, 4, '#1b382d55'); }
  function diamond(x, y, color, size = 4) {
    for (let i = -size; i <= size; i++) rect(x - (size - Math.abs(i)), y + i, (size - Math.abs(i)) * 2 + 1, 1, color);
    rect(x - 1, y - size + 2, 2, size - 1, '#f3f9cf');
  }
  function tileArt(tile, x, y, tx, ty) {
    const colors = palette[game.theme], n = hash(tx, ty);
    if (tile === 'grass' || tile === 'tree') {
      rect(x, y, 24, 24, n % 3 === 0 ? '#739349' : '#6b8c45');
      for (let i = 0; i < 3; i++) {
        const a = (n >> (i * 4)) % 20, b = (n >> (i * 5 + 2)) % 20;
        rect(x + a, y + b, 1, 3, '#4d7139'); rect(x + a + 2, y + b - 1, 1, 3, '#90ac55');
      }
      if (n % 17 === 0) { rect(x + 10, y + 12, 1, 4, '#426533'); rect(x + 8, y + 10, 5, 3, n % 2 ? '#efcf86' : '#d6daaf'); rect(x + 10, y + 11, 1, 1, '#a57a4e'); }
    } else if (tile === 'path') {
      rect(x, y, 24, 24, '#bbac76');
      rect(x + n % 19, y + (n >> 4) % 20, 3, 2, '#a39565');
      rect(x + (n >> 8) % 20, y + (n >> 12) % 20, 2, 1, '#d1c48d');
      for (const [dx, dy, bx, by, bw, bh] of [[0, -1, 0, 0, 24, 2], [0, 1, 0, 22, 24, 2], [-1, 0, 0, 0, 2, 24], [1, 0, 22, 0, 2, 24]]) {
        if (game.tiles[ty + dy]?.[tx + dx] === 'grass') rect(x + bx, y + by, bw, bh, '#87a052');
      }
    } else if (tile === 'water' || tile === 'lava') {
      const lava = tile === 'lava';
      rect(x, y, 24, 24, lava ? '#c95333' : '#427f8e');
      const shift = Math.floor(game.roomTime * 3) % 8;
      for (let i = 0; i < 3; i++) {
        rect(x + (n + i * 7 + shift) % 18, y + 3 + i * 7, 6, 1, lava ? '#ffba52' : '#7bb7ae');
        rect(x + (n + i * 7 + shift) % 18 + 2, y + 4 + i * 7, 4, 1, lava ? '#ea873b' : '#589b9e');
      }
    } else if (tile === 'bridge' || tile === 'ladder' || tile === 'wood') {
      rect(x, y, 24, 24, tile === 'ladder' ? '#9c6b3e' : '#a17c4d');
      for (let i = 0; i < 24; i += 6) { rect(x, y + i, 24, 1, '#624c35'); rect(x + 2, y + i + 1, 19, 1, '#c3a572'); }
      if (tile !== 'wood') { rect(x + 1, y, 2, 24, '#675132'); rect(x + 21, y, 2, 24, '#d4bc80'); }
    } else if (tile === 'wall') {
      rect(x, y, 24, 24, colors[2]);
      rect(x + 1, y + 1, 22, 9, colors[0]);
      rect(x + 1, y + 12, 10, 9, colors[0]);
      rect(x + 13, y + 12, 10, 9, colors[1]);
      rect(x + 1, y + 1, 22, 1, colors[3]);
      if (game.theme === 'grass' || game.theme === 'garden') rect(x + n % 14, y, 7, 3, '#57793b');
    } else if (tile === 'bramble') {
      rect(x, y, 24, 24, '#3e583c');
      for (let i = 0; i < 3; i++) { rect(x + 2 + i * 7, y + 3, 3, 18, '#6a7343'); rect(x + i * 7, y + 6 + i * 3, 7, 2, '#b3a35f'); }
    } else if (tile === 'ice') {
      rect(x, y, 24, 24, n % 2 ? '#a2cecf' : '#abd5d4');
      rect(x + 4, y + 6, 11, 1, '#d9ece2'); rect(x + 6, y + 7, 8, 1, '#d9ece2');
      rect(x + 17, y + 17, 5, 1, '#6da8b4');
    } else {
      rect(x, y, 24, 24, n % 2 ? colors[0] : colors[1]);
      rect(x, y + 23, 24, 1, colors[2] + '44');
      rect(x + n % 18 + 2, y + (n >> 4) % 19 + 2, 3, 1, colors[3] + '66');
      if (tile === 'pad') {
        rect(x + 4, y + 7, 16, 12, '#42564c'); rect(x + 6, y + 4, 12, 16, '#42564c');
        rect(x + 6, y + 6, 12, 11, '#d4c89a'); text('↑', x + 12, y + 15, '#4c6957', 12);
      }
    }
  }

  function tree(x, y) {
    shadow(x, y, 23);
    rect(x - 3, y - 10, 6, 19, '#715137'); rect(x - 1, y - 8, 2, 14, '#a07545');
    rect(x - 13, y - 23, 26, 15, '#274d34'); rect(x - 10, y - 31, 20, 10, '#315b37');
    rect(x - 6, y - 36, 12, 10, '#3e693b'); rect(x - 12, y - 22, 24, 6, '#426e3c');
    rect(x - 8, y - 29, 13, 5, '#527f40'); rect(x - 4, y - 34, 6, 3, '#769749');
    rect(x - 10, y - 19, 5, 3, '#648846'); rect(x + 6, y - 15, 4, 2, '#648846');
  }
  function house(o, x, y) {
    const roof = o.destination === 'elder' ? '#b65e44' : o.destination === 'shop' ? '#718fab' : '#ba9453';
    shadow(x, y, 53);
    rect(x - 24, y - 26, 48, 32, '#e2d7a2'); rect(x - 24, y + 3, 48, 5, '#927749');
    rect(x - 25, y - 25, 3, 29, '#a58b54'); rect(x + 22, y - 25, 3, 29, '#a58b54');
    for (let i = 0; i < 5; i++) rect(x - 28 + i * 3, y - 27 - i * 4, 56 - i * 6, 5, roof);
    for (let i = 0; i < 4; i++) rect(x - 25 + i * 3, y - 28 - i * 4, 50 - i * 6, 1, '#db977066');
    rect(x + 13, y - 51, 6, 14, '#8c7356'); rect(x + 12, y - 52, 8, 3, '#b7a47a');
    rect(x - 6, y - 11, 12, 19, '#665137'); rect(x - 4, y - 10, 8, 17, '#967144'); rect(x + 2, y, 2, 2, '#eac57a');
    for (const wx of [-18, 11]) { rect(x + wx, y - 17, 8, 9, '#5c7e7d'); rect(x + wx, y - 18, 8, 2, '#7d6745'); rect(x + wx + 3, y - 17, 1, 9, '#e5d49e'); }
    text(o.destination === 'elder' ? 'HAWTHORN' : o.destination === 'shop' ? 'SHOP' : 'ARCADE', x, y + 18, '#f7e9b6', 6);
  }
  function dungeon(o, x, y) {
    const colors = palette[DUNGEONS[o.id - 1].theme], done = game.completed.includes(o.id);
    shadow(x, y, 44);
    rect(x - 22, y - 28, 44, 36, colors[2]); rect(x - 25, y - 33, 50, 8, colors[0]);
    rect(x - 24, y - 32, 48, 2, colors[3]); rect(x - 19, y - 24, 10, 29, colors[1]); rect(x + 9, y - 24, 10, 29, colors[1]);
    rect(x - 8, y - 19, 16, 26, '#172a27'); rect(x - 5, y - 22, 10, 4, '#172a27');
    rect(x - 13, y + 7, 26, 3, '#b6b392'); rect(x - 16, y + 10, 32, 3, '#8e9274');
    diamond(x, y - 30, done ? '#a3e08a' : '#edc76f', 6);
    text(done ? '✓' : String(o.id), x, y - 28, '#253b2c', 7);
    if (o.id === 6) for (const dx of [-22, 16]) { rect(x + dx, y - 48, 6, 18, '#516973'); rect(x + dx, y - 48, 12, 7, '#b4ba7b'); }
    text(DUNGEONS[o.id - 1].name.toUpperCase(), x, y + 23, '#f3e9c3', 6);
  }
  function hero(x, y, npc = false) {
    const p = game.player, jump = !npc && p.jump > 0 ? Math.sin((1 - p.jump / (p.jumpDuration || .65)) * Math.PI) * 15 : 0;
    shadow(x, y, 14);
    if (!npc && p.invincible > 0 && Math.floor(game.roomTime * 12) % 2 === 0) ctx.globalAlpha = .55;
    y -= jump;
    const step = !npc && Math.hypot(p.vx, p.vy) > 10 ? Math.floor(game.roomTime * 9) % 2 : 0;
    rect(x - 5, y - 3, 4, 7 + step, '#534b36'); rect(x + 1, y - 3, 4, 8 - step, '#534b36');
    rect(x - 6, y + 3 + step, 5, 3, '#775737'); rect(x + 1, y + 4 - step, 6, 3, '#775737');
    rect(x - 7, y - 13, 14, 12, npc ? '#b58453' : '#355f39');
    rect(x - 6, y - 12, 12, 8, npc ? '#cfac6e' : '#73a84c');
    rect(x - 8, y - 10, 3, 6, '#e2b478'); rect(x + 5, y - 10, 3, 6, '#e2b478');
    rect(x - 5, y - 21, 10, 10, '#e7bd83'); rect(x - 7, y - 24, 14, 7, npc ? '#d9dbbd' : '#edc85b');
    rect(x - 5, y - 25, 10, 3, npc ? '#eef0dc' : '#ffdf77');
    rect(x - 6, y - 18, 3, 4, npc ? '#d9dbbd' : '#edc85b');
    if (npc || p.facing.y >= -.3) { rect(x - 2, y - 17, 1, 2, '#263b32'); rect(x + 3, y - 17, 1, 2, '#263b32'); rect(x, y - 13, 3, 1, '#b17754'); }
    rect(x - 6, y - 3, 12, 2, '#927343'); rect(x - 1, y - 3, 3, 2, '#eacb78');
    if (npc) { rect(x - 5, y - 12, 10, 4, '#e3e2ca'); rect(x - 2, y - 8, 4, 3, '#e3e2ca'); }
    if (!npc && p.guarding) {
      rect(x + 5, y - 10, 10, 10, p.frozenShield ? '#8ddbdd' : '#ac8951');
      rect(x + 7, y, 6, 3, p.frozenShield ? '#b6eff0' : '#d8bb77');
      rect(x + 9, y - 8, 2, 8, '#e5e8b9');
    }
    if (!npc && p.attack > 0) {
      const angle = Math.atan2(p.facing.y, p.facing.x);
      ctx.save(); ctx.translate(x, y - 7); ctx.rotate(angle);
      rect(9, -4, 26, 7, p.iceSword ? '#c8faf2' : '#ecedce'); rect(12, -4, 20, 2, '#fff');
      rect(8, -6, 3, 12, '#e9bc5c'); rect(3, -1, 6, 3, '#7b593a');
      ctx.globalAlpha = .45; rect(15, -12, 25, 3, '#edfaca'); rect(21, 9, 17, 2, '#edfaca');
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }
  function enemy(e, x, y) {
    shadow(x, y, e.boss ? 27 : 18);
    if (e.hurt > 0) ctx.globalAlpha = .5;
    if (e.type === 'skeleton') {
      rect(x - 6, y - 21, 12, 12, '#e9e2bd'); rect(x - 4, y - 23, 8, 2, '#f7f1cf');
      rect(x - 4, y - 18, 3, 3, '#38453d'); rect(x + 2, y - 18, 3, 3, '#38453d');
      rect(x - 3, y - 11, 6, 2, '#a4a17f'); rect(x - 5, y - 7, 10, 7, '#ddd8b6');
      rect(x - 3, y - 5, 6, 1, '#747a66'); rect(x - 1, y - 9, 2, 10, '#ddd8b6');
      rect(x - 5, y, 3, 6, '#e2ddbf'); rect(x + 2, y, 3, 6, '#e2ddbf');
      rect(x + 8, y - 14, 2, 17, '#b9c8b9'); rect(x + 6, y - 1, 6, 2, '#927444');
    } else if (e.type === 'slime') {
      if (e.phase % 5 < 1) { rect(x - 9, y - 1, 18, 5, '#385538'); rect(x - 5, y - 2, 10, 3, '#203c32'); ctx.globalAlpha = 1; return; }
      rect(x - 9, y - 8, 18, 12, '#3d6945'); rect(x - 6, y - 13, 12, 5, '#76ad62');
      rect(x - 8, y - 8, 16, 8, '#76ad62'); rect(x - 4, y - 6, 2, 3, '#203c32'); rect(x + 3, y - 6, 2, 3, '#203c32');
      rect(x - 3, y - 11, 4, 2, '#aed57e'); rect(x - 1, y, 3, 1, '#3d6945');
    } else if (e.type === 'octopus') {
      for (let i = -2; i <= 2; i++) rect(x + i * 6 - 2, y - 2, 4, 8 + Math.sin(e.phase * 3 + i) * 2, '#9e839b');
      rect(x - 12, y - 21, 24, 19, '#aa92ab'); rect(x - 8, y - 25, 16, 5, '#c3abbe');
      rect(x - 7, y - 17, 5, 5, '#eee0c7'); rect(x + 3, y - 17, 5, 5, '#eee0c7');
      rect(x - 5, y - 15, 2, 3, '#38404a'); rect(x + 5, y - 15, 2, 3, '#38404a');
      rect(x - 2, y - 7, 5, 2, '#664f73');
    } else {
      const big = e.type === 'boss', scale = big ? 1.5 : 1;
      ctx.save(); ctx.translate(x, y); ctx.scale(scale, scale);
      rect(-10, -22, 19, 25, '#2c3b40'); rect(-13, -15, 26, 14, '#354951'); rect(-7, -27, 15, 9, '#415a5e');
      rect(-8, -4, 14, 8, '#68775b'); rect(-10, 3, 6, 5, '#2c3b40'); rect(5, 3, 7, 5, '#2c3b40');
      rect(-4, -24, 3, 3, '#ecc96f'); rect(4, -24, 3, 3, '#ecc96f');
      rect(-3, -16, 9, 2, '#c5c4a0');
      for (let i = 0; i < 4; i++) { rect(-14 - i * 2, -17 + i * 4, 6, 3, '#b2b885'); rect(-13 - i * 2, -20 + i * 4, 3, 4, '#d6cf95'); }
      rect(11, -6, 10, 4, '#354951'); rect(19, -9, 4, 5, '#354951');
      ctx.restore();
    }
    ctx.globalAlpha = 1;
    if (e.frozen > 0) { ctx.strokeStyle = '#c4f6f0'; ctx.strokeRect(x - 13, y - 26, 26, 34); text('❄', x, y - 30, '#cbfff1', 12); }
    if (e.charge > 0) {
      const blink = Math.floor(e.charge * 8) % 2;
      text('⚡', x, y - (e.type === 'boss' ? 48 : 34), blink ? '#ffde6e' : '#fff6c4', 16);
      ctx.strokeStyle = '#ffd472'; ctx.strokeRect(x - 18, y - 30, 36, 40);
    }
    if (e.boss) {
      rect(x - 24, y - (e.type === 'boss' ? 59 : 40), 48, 5, '#263733');
      rect(x - 23, y - (e.type === 'boss' ? 58 : 39), 46 * Math.max(0, e.hp) / e.maxHp, 3, '#edc36d');
      text(e.type === 'boss' ? `STORM DINO ${e.hp}/20` : 'SEAL GUARDIAN', x, y - (e.type === 'boss' ? 64 : 46), '#f8e6b0', 6);
    }
  }
  function objectArt(o, x, y) {
    if (o.type === 'house') return house(o, x, y);
    if (o.type === 'dungeon') return dungeon(o, x, y);
    if (o.type === 'npc') { hero(x, y, true); text(o.label, x, y - 31, '#ffe6a5', 6); return; }
    shadow(x, y, 14);
    if (o.type === 'pot') {
      rect(x - 5, y - 12, 10, 3, '#d9ab6b'); rect(x - 7, y - 9, 14, 11, '#a67147');
      rect(x - 6, y - 8, 12, 7, '#c68c51'); rect(x - 4, y - 8, 2, 6, '#e5b878');
      rect(x - 5, y + 2, 10, 2, '#866242'); rect(x - 3, y - 12, 6, 2, '#65503c');
    } else if (o.type === 'sign') {
      rect(x - 1, y - 6, 3, 13, '#806140'); rect(x - 9, y - 16, 18, 12, '#695338');
      rect(x - 8, y - 15, 16, 9, '#d0b77c'); rect(x - 5, y - 12, 10, 1, '#8b734a'); rect(x - 4, y - 9, 7, 1, '#8b734a');
    } else if (o.type === 'exit') {
      rect(x - 10, y - 5, 20, 12, '#c8ba89'); rect(x - 8, y - 4, 16, 8, '#695e48'); text('↓ EXIT', x, y + 18, '#efdfab', 6);
    } else if (o.type === 'gate') {
      if (!game.key) { for (let i = -9; i <= 9; i += 6) rect(x + i, y - 20, 2, 30, '#dac48a'); rect(x - 12, y - 12, 24, 3, '#c4a965'); rect(x - 3, y - 8, 7, 7, '#f1d283'); }
    } else if (o.type === 'secret') {
      rect(x - 16, y - 24, 32, 32, '#6e7961'); rect(x - 14, y - 22, 28, 3, '#a2ac7c');
      if (game.secretOpen) { rect(x - 9, y - 18, 18, 26, '#142b29'); diamond(x, y - 5, '#c8e78a', 5); text('SECRET', x, y + 19, '#dded9b', 6); }
      else { rect(x, y - 19, 2, 10, '#394f3c'); rect(x - 4, y - 10, 6, 2, '#394f3c'); rect(x - 4, y - 8, 2, 9, '#394f3c'); }
    } else if (o.type === 'heart') {
      rect(x - 6, y - 9, 5, 6, '#f39886'); rect(x + 1, y - 9, 5, 6, '#f39886'); rect(x - 5, y - 4, 10, 3, '#f39886'); rect(x - 3, y - 1, 6, 2, '#f39886'); rect(x - 1, y + 1, 2, 2, '#f39886');
    } else if (o.type === 'clock') {
      rect(x - 6, y - 13, 12, 14, '#d5c986'); rect(x - 4, y - 11, 8, 9, '#edf0cf'); rect(x, y - 10, 1, 5, '#4f7b72'); rect(x, y - 6, 3, 1, '#4f7b72'); rect(x - 7, y - 15, 4, 3, '#9f9163'); rect(x + 3, y - 15, 4, 3, '#9f9163');
    } else if (o.type === 'seal') {
      const bob = Math.sin(game.roomTime * 3) * 2;
      diamond(x, y - 12 + bob, o.collected ? '#739062' : '#d8ef8e', 9);
      text(o.collected ? '✓' : '♥', x, y - 10 + bob, '#395840', 10);
      if (!o.collected) text('SEAL + HEART', x, y + 16, '#e4f5b2', 6);
    } else if (o.type === 'target') {
      const i = (Math.floor(o.x / TILE) - 7) / 3;
      rect(x - 1, y - 6, 3, 15, '#7c6244');
      rect(x - 10, y - 24, 20, 18, o.hits >= 3 ? '#6eac79' : ['#b7bade', '#d89b86', '#cbaa68'][i]);
      rect(x - 6, y - 20, 3, 3, '#364844'); rect(x + 3, y - 20, 3, 3, '#364844'); rect(x - 3, y - 13, 7, 2, '#364844');
      if (i === 0) { rect(x - 5, y - 16, 2, 5, '#80d1e1'); rect(x + 4, y - 16, 2, 5, '#80d1e1'); }
      if (i === 1) { rect(x - 7, y - 23, 3, 2, '#364844'); rect(x + 4, y - 23, 3, 2, '#364844'); }
      if (i === 2) { rect(x - 11, y - 28, 22, 5, '#bb6254'); rect(x - 12, y - 24, 24, 2, '#f0e6cf'); rect(x - 8, y - 13, 16, 5, '#f0e6cf'); rect(x - 4, y - 8, 8, 3, '#f0e6cf'); }
      text(o.hits >= 3 ? '✓' : `${o.hits}/3`, x, y - 30, '#fae5b0', 7);
    }
  }
  function render() {
    const p = game.player, w = canvas.width, h = canvas.height;
    camera.x = Math.round(game.width * TILE < w ? (game.width * TILE - w) / 2 : Math.max(0, Math.min(game.width * TILE - w, p.x - w / 2)));
    camera.y = Math.round(game.height * TILE < h ? (game.height * TILE - h) / 2 : Math.max(0, Math.min(game.height * TILE - h, p.y - h / 2)));
    rect(0, 0, w, h, '#304a32');
    const x0 = Math.max(0, Math.floor(camera.x / TILE) - 2), y0 = Math.max(0, Math.floor(camera.y / TILE) - 2);
    const x1 = Math.min(game.width, Math.ceil((camera.x + w) / TILE) + 2), y1 = Math.min(game.height, Math.ceil((camera.y + h) / TILE) + 3);
    const trees = [];
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
      tileArt(game.tiles[y][x], x * TILE - camera.x, y * TILE - camera.y, x, y);
      if (game.tiles[y][x] === 'tree') trees.push({ type: 'tree', x: (x + .5) * TILE, y: (y + .5) * TILE });
    }
    if (game.room === 'world') {
      // Village garden and flower beds make the starting area easy to recognize.
      for (const [x, y] of [[5, 28], [6, 28], [16, 27], [17, 27], [5, 32], [6, 32], [12, 34], [13, 34]]) {
        const sx = x * TILE - camera.x, sy = y * TILE - camera.y;
        rect(sx + 3, sy + 3, 18, 16, '#566c3c');
        for (let i = 0; i < 4; i++) { rect(sx + 5 + i % 2 * 9, sy + 5 + Math.floor(i / 2) * 8, 4, 3, i % 2 ? '#e7c175' : '#e6b1a2'); }
      }
    }
    const sprites = [...trees, ...game.objects, ...game.enemies.filter(e => e.hp > 0), { type: 'hero', x: p.x, y: p.y }];
    sprites.sort((a, b) => a.y - b.y);
    for (const s of sprites) {
      const x = s.x - camera.x, y = s.y - camera.y;
      if (x < -60 || y < -30 || x > w + 60 || y > h + 70) continue;
      if (s.type === 'tree') tree(x, y);
      else if (s.type === 'hero') hero(x, y);
      else if ('hp' in s) enemy(s, x, y);
      else objectArt(s, x, y);
    }
    for (const s of game.projectiles) {
      const x = s.x - camera.x, y = s.y - camera.y;
      if (s.type === 'bolt') { rect(x - 3, y - 4, 6, 8, '#f6cd69'); rect(x - 1, y - 6, 2, 12, '#ffefa2'); }
      else { rect(x - 3, y - 3, 6, 6, s.type === 'apple' ? '#e69a77' : '#b9a26c'); rect(x, y - 5, 1, 3, '#729854'); }
    }
    for (const e of game.effects) {
      const x = e.x - camera.x, y = e.y - camera.y;
      if (e.type === 'coins') { diamond(x, y - (1 - e.life) * 24, '#e6c76e', 4); }
      else if (e.type === 'blast') { ctx.strokeStyle = '#f4d483'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, y, (1 - e.life / .5) * 95, 0, Math.PI * 2); ctx.stroke(); ctx.lineWidth = 1; }
      else { rect(x - 10, y + 4, 5, 2, '#c6c995'); rect(x + 7, y + 2, 4, 2, '#c6c995'); }
    }
    if (!started || paused) {
      rect(0, 0, w, h, '#15302444');
      if (paused) text('PAUSED', w / 2, h / 2, '#e7f2bb', 18);
    }
    renderMap();
  }
  function renderMap() {
    const sx = mini.width / 78, sy = mini.height / 52;
    mc.fillStyle = '#42633c'; mc.fillRect(0, 0, mini.width, mini.height);
    for (let y = 1; y < 51; y++) for (let x = 1; x < 77; x++) {
      if (x >= 31 && x <= 37 && y >= 18 && y <= 35) mc.fillStyle = '#568b97';
      else if ((y >= 30 && y <= 32) || (x >= 9 && x <= 11) || (y >= 13 && y <= 14 && x < 30) || (x >= 43 && x <= 44) || (y >= 39 && y <= 40 && x > 20) || (y >= 7 && y <= 8 && x > 42)) mc.fillStyle = '#aeab72';
      else if (hash(x, y) % 31 === 0 && x > 15) mc.fillStyle = '#294b32';
      else continue;
      mc.fillRect(x * sx, y * sy, sx + .2, sy + .2);
    }
    mc.fillStyle = '#e9b786'; mc.fillRect(6 * sx, 27 * sy, 10 * sx, 8 * sy);
    mc.font = 'bold 9px monospace'; mc.textAlign = 'center';
    DUNGEONS.forEach((d, i) => {
      mc.fillStyle = game.completed.includes(i + 1) ? '#d4ef94' : '#233e33'; mc.fillRect(d.x * sx - 6, d.y * sy - 6, 12, 12);
      mc.fillStyle = game.completed.includes(i + 1) ? '#315233' : '#f5d58a'; mc.fillText(game.completed.includes(i + 1) ? '✓' : i + 1, d.x * sx, d.y * sy + 3);
    });
    const pos = game.room === 'world' ? game.player : game.returnPoint;
    mc.fillStyle = '#fef7cf'; mc.fillRect(pos.x / TILE * sx - 2, pos.y / TILE * sy - 2, 5, 5);
    if (game.secretOpen) { mc.fillStyle = '#dbb6dc'; mc.fillRect(60 * sx - 2, 40 * sy - 2, 5, 5); }
  }
  function frame(time) {
    const dt = lastTime ? Math.min((time - lastTime) / 1000, .05) : 0;
    lastTime = time;
    if (active()) {
      const x = touch.x || (Number(keys.has('d') || keys.has('arrowright')) - Number(keys.has('a') || keys.has('arrowleft')));
      const y = touch.y || (Number(keys.has('s') || keys.has('arrowdown')) - Number(keys.has('w') || keys.has('arrowup')));
      game.tick(dt, { x, y, shield: touch.shield || keys.has('c') });
      if (touch.attack || keys.has('x')) game.attack();
      events();
      const near = game.nearObject();
      $('prompt').hidden = !near;
      if (near) $('prompt').textContent = `✦ ${near.label || 'Read sign'} · TALK / E`;
      $('danger').hidden = !game.enemies.some(e => e.hp > 0 && e.charge > 0 && distance(e, game.player) < 200);
      saveTime += dt;
      if (saveTime > 10) { save(); saveTime = 0; }
    } else { $('prompt').hidden = true; $('danger').hidden = true; }
    if (time > toastUntil) $('toast').classList.remove('visible');
    const seconds = Math.floor(game.elapsed);
    $('timer').textContent = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
    render();
    requestAnimationFrame(frame);
  }

  if (saved && saved.version === 1) {
    $('hero-name').value = typeof saved.name === 'string' ? saved.name.slice(0, 16) : 'Sprout';
    $('hero-name').disabled = true;
    $('start-button').textContent = 'CONTINUE ADVENTURE →';
    $('fresh-start').hidden = false;
  }
  if (!storageAvailable) document.querySelector('.bottom-note>span').textContent = 'Saving unavailable — keep this tab open';
  updateHUD();
  resize();
  $('welcome').showModal();
  requestAnimationFrame(frame);
})();
