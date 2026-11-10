# Neon Defense

A cyber/neon pixel-art tower defense game that runs in the browser. Viruses travel along a circuit path toward your server core; build and upgrade towers to stop them. Survive 15 waves to win. All art is hand-made pixel sprites in `js/sprites.js`.

## Play

Open `index.html` in a web browser. No build step or server is needed.

## Towers

| Tower | Cost | What it does |
|---|---|---|
| Laser | $50 | Fast single-target beam. Weak against armored trojans. |
| EMP | $70 | Pulses that hit and slow every virus in range. Ignores armor. |
| Cannon | $100 | Slow shells that deal splash damage. |

Each tower can be upgraded twice. Selling refunds 70% of what you spent.

## Viruses

Bugs are basic, worms are fast, trojans are slow and armored, and every 5th wave brings a boss.

## Controls

| Input | Action |
|---|---|
| Click a tower in the panel, or 1 / 2 / 3 | Choose a tower to build |
| Click an empty tile | Build it |
| Click a built tower | Select it |
| U / S | Upgrade / sell the selected tower |
| Space / N | Start the next wave |
| F | Fast forward |
| P | Pause |
| M | Mute |
| Esc / right-click | Cancel |
