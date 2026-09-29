import fs from 'fs';
import path from 'path';
import {fileURLToPath} from 'url';
import subsetFont from 'subset-font';
import glyphmap from '../node_modules/react-native-vector-icons/glyphmaps/MaterialIcons.json' with {type: 'json'};

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const REGISTRY_PATH = path.join(ROOT, 'src/ui/icons/iconRegistry.ts');
const SOURCE_FONT = path.join(
  ROOT,
  'node_modules/react-native-vector-icons/Fonts/MaterialIcons.ttf',
);
const OUTPUT_FONT = path.join(ROOT, 'assets/fonts/MaterialIcons.ttf');

const ICON_ALIASES = {
  add_photo_alternate: 'add-photo-alternate',
  arrow_back: 'arrow-back',
  auto_stories: 'auto-stories',
  bookmark_add: 'bookmark-add',
  chevron_left: 'chevron-left',
  chevron_right: 'chevron-right',
  content_paste: 'content-paste',
  document_scanner: 'document-scanner',
  emoji_events: 'emoji-events',
  fitness_center: 'fitness-center',
  format_quote: 'format-quote',
  heart: 'favorite',
  heart_outline: 'favorite-border',
  history_edu: 'history-edu',
  local_fire_department: 'local-fire-department',
  menu_book: 'menu-book',
  photo_camera: 'photo-camera',
  play_circle: 'play-circle',
  record_voice_over: 'record-voice-over',
  restaurant_menu: 'restaurant-menu',
  tips_and_updates: 'tips-and-updates',
  upload_file: 'upload-file',
  volume_up: 'volume-up',
};

const ICON_FALLBACKS = {
  function: 'functions',
};

function readHandoffIcons() {
  const source = fs.readFileSync(REGISTRY_PATH, 'utf8');
  const block = source.match(/export const HANDOFF_ICONS = \[([\s\S]*?)\] as const/);
  if (!block) {
    throw new Error('Could not parse HANDOFF_ICONS from iconRegistry.ts');
  }
  return [...block[1].matchAll(/'([^']+)'/g)].map(([, name]) => name);
}

function resolveHandoffIconName(name) {
  return ICON_FALLBACKS[name] ?? ICON_ALIASES[name] ?? name.replace(/_/g, '-');
}

function codepointForHandoffIcon(name) {
  const glyph = resolveHandoffIconName(name);
  const codepoint = glyphmap[glyph];
  if (codepoint == null) {
    throw new Error(`Missing glyph "${glyph}" for handoff icon "${name}"`);
  }
  return codepoint;
}

async function main() {
  const icons = readHandoffIcons();
  const codepoints = [...new Set(icons.map(codepointForHandoffIcon))];
  const subsetText = codepoints.map(cp => String.fromCodePoint(cp)).join('');

  fs.mkdirSync(path.dirname(OUTPUT_FONT), {recursive: true});

  const sourceBuffer = fs.readFileSync(SOURCE_FONT);
  const subsetBuffer = await subsetFont(sourceBuffer, subsetText, {targetFormat: 'sfnt'});

  fs.writeFileSync(OUTPUT_FONT, subsetBuffer);

  const beforeKb = Math.round(sourceBuffer.length / 1024);
  const afterKb = Math.round(subsetBuffer.length / 1024);
  console.log(
    `MaterialIcons subset: ${icons.length} icons, ${codepoints.length} glyphs, ${beforeKb}KB -> ${afterKb}KB`,
  );
  console.log(`Wrote ${OUTPUT_FONT}`);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
