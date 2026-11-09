# Grass Adventure

A dependency-free, top-down pixel-art browser game inspired by a child's dictated adventure.

**[Play Grass Adventure](https://kendaleiv.github.io/grass-adventure/)**

## Play

Open `index.html` in a modern browser, or serve this directory:

```sh
python3 -m http.server 8000
```

Visit `http://localhost:8000`. No install or build is needed.

- **Move:** touch stick, WASD, or arrow keys.
- **Sword:** X or SWORD (hold to keep swinging). You start unarmed: enter the red-roofed house and talk to Mr. Hawthorn.
- **Jump:** Space, JUMP, or tap the game view. Round pads give longer jumps.
- **Talk / read / enter / leave:** E or TALK, near a person, sign, or doorway.
- **Shield:** hold C or SHIELD. Wooden shields break against skeletons; the Frozen Shield does not.
- **Bomb:** B or BOMB. The village shop sells 100 bombs for 100 rupees.
- **Fullscreen:** use ⛶. Browsers without the Fullscreen API can use an added-to-Home-Screen view instead.
- **Pause / guide:** use Ⅱ or ? in the header. Opening a conversation or the mobile map also pauses the game.

Explore Willowfield, its houses, shop, and apple-shooting arcade. Break pots and defeat monsters for rupees. Recover seals in six ordered dungeons: Mossroot Ruins, The Icy Road, Bramble Labyrinth, Sunken Pipes, Ember Ladder, and Stormkeep. Every dungeon has a hidden brass key, guardian, and heart container. The first two grant an Ice Sword and Frozen Shield; the fourth grants swimming fins. Safe bridges and ladders always provide an alternative to dangerous crossings.

The Storm Dino takes twenty sword hits and warns before firing lightning. Jump or shield to avoid it. Defeat allows immediate retry with your equipment and seals preserved; there is no real-world lockout or time limit. Magic clocks in the icy dungeon reduce the displayed adventure time.

**Secret:** a cracked wall southeast of the world hides a shortcut to the final battle. Open it with a bomb, or name your hero **ABC**. You still need your sword and must defeat the boss.

Progress saves locally on this device when equipment or seals are earned, every ten seconds, and when you leave the page. Continue resumes safely in the overworld with full hearts; room enemies, keys, pots, and arcade targets reset on entry. If browser storage is unavailable, the game remains playable without saving. Start a new adventure from the welcome screen, or after defeat/victory.

## Validation

```sh
npm test
```

Uses Node's built-in test runner (Node 18+), without external packages. Tests cover progression through all six dungeons, map reachability, keys, combat, twenty-hit victory, shields, jumping, ice, swimming, shops, arcade prizes, secrets, retry, and validated save data. Browser play should also be checked at mobile, tablet, and desktop sizes.

## Deployment

Like [Porcupine Spikey](https://github.com/kendaleiv/porcupine-spikey), `.github/workflows/deploy.yml` publishes the repository directly to GitHub Pages on pushes to `main` or manual dispatch. Set **Settings → Pages → Source** to **GitHub Actions**. No build step or hosting service is required.

## License

MIT — see [LICENSE](LICENSE). All game artwork is original procedural pixel art drawn in the browser.