// Copies the game into www/ — the folder Capacitor packs into the native apps
// and GitHub Pages publishes. The game has no bundler: this is a plain copy of
// exactly the files a browser loads, so nothing else (node_modules, ios/,
// android/, supabase/) ever ships.
import { cpSync, rmSync, mkdirSync } from 'node:fs';

const OUT = 'www';
const FILES = ['index.html', 'styles.css', 'src', 'vendor', 'assets/audio', '.nojekyll'];

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT);
for (const f of FILES) cpSync(f, `${OUT}/${f}`, { recursive: true });
console.log(`built ${OUT}/ from ${FILES.join(', ')}`);
