#!/usr/bin/env node
/**
 * Generates Averna's self-hosted preset avatars into public/avatars/.
 *
 *   node scripts/generate-avatars.mjs
 *
 * Two families, one cohesive visual language (soft gradients, flat shapes,
 * gentle highlights) so the whole gallery looks like a single designed set:
 *   - "Students": 24 illustrated portraits (hair, outfits, glasses, headphones,
 *     hijab…), each on its own harmonised gradient.
 *   - "Aurora": 12 abstract glowing orbs in the Averna neon palette.
 *
 * The output is committed, so the app never depends on a third-party avatar
 * API. Keep the list in lib/avatars.ts in sync with the ids generated here.
 */
import { mkdirSync, writeFileSync, readdirSync, unlinkSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "avatars");

/* ----------------------------------------------------------------- colour */
const hex = (h) => h.replace("#", "").match(/../g).map((x) => parseInt(x, 16));
const toHex = (rgb) => "#" + rgb.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("");
const shade = (h, amt) => toHex(hex(h).map((v) => (amt < 0 ? v * (1 + amt) : v + (255 - v) * amt)));

/* -------------------------------------------------------------- palettes */
const BG = {
  mint: ["#b8f5dc", "#3fd6a0"],
  sky: ["#c4ecff", "#48b6f5"],
  lilac: ["#e4dcff", "#8e6cf5"],
  rose: ["#ffd9e8", "#f0619e"],
  honey: ["#ffecb3", "#f5a524"],
  indigo: ["#d3d9ff", "#5b67f0"],
  teal: ["#b5f3ec", "#17b3a3"],
  coral: ["#ffd6cc", "#f4735a"],
  orchid: ["#f2d9ff", "#b35ee8"],
  ocean: ["#cfe3ff", "#3a7bef"],
  peach: ["#ffe2c7", "#f58f45"],
  lime: ["#e3f9c2", "#7cc63a"],
};

const SKIN = { porcelain: "#fbe3d1", light: "#f6d3b8", warm: "#efc3a0", beige: "#f3cdb0", honey: "#e5b28c" };
const HAIR = {
  black: "#221a1c", espresso: "#3a2821", brown: "#6a4330", chestnut: "#8b4a2b",
  auburn: "#a4502e", blonde: "#dcb36c", ash: "#b9a58c", burgundy: "#5d1f33", plum: "#4b2a5c",
};

/* ------------------------------------------------------------ primitives */
const HEAD = { cx: 128, cy: 116, rx: 44, ry: 50 };

function background(id, [c1, c2]) {
  return `
  <defs>
    <linearGradient id="bg-${id}" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${c1}"/>
      <stop offset="1" stop-color="${c2}"/>
    </linearGradient>
    <radialGradient id="glow-${id}" cx="0.28" cy="0.22" r="0.6">
      <stop offset="0" stop-color="#ffffff" stop-opacity="0.55"/>
      <stop offset="1" stop-color="#ffffff" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="256" height="256" fill="url(#bg-${id})"/>
  <rect width="256" height="256" fill="url(#glow-${id})"/>
  <circle cx="214" cy="46" r="54" fill="#ffffff" opacity="0.10"/>
  <circle cx="34" cy="226" r="40" fill="#ffffff" opacity="0.08"/>`;
}

function body(p) {
  const c = p.outfit;
  const dark = shade(c, -0.18);
  const skinShadow = shade(p.skin, -0.14);
  let out = `
  <path d="M110 146 L146 146 L146 200 L110 200 Z" fill="${p.skin}"/>
  <path d="M110 150 L146 150 L146 166 C136 174 120 174 110 166 Z" fill="${skinShadow}"/>`;

  if (p.neck === "hoodie") {
    out += `<path d="M84 204 C92 176 164 176 172 204 C156 214 100 214 84 204 Z" fill="${dark}"/>`;
  }
  out += `
  <path d="M26 256 C28 216 68 192 128 192 C188 192 228 216 230 256 Z" fill="${c}"/>
  <path d="M26 256 C28 216 68 192 128 192 C92 200 64 222 58 256 Z" fill="#ffffff" opacity="0.10"/>`;

  switch (p.neck) {
    case "vneck":
      out += `<path d="M110 192 L128 220 L146 192 Z" fill="${p.skin}"/>
  <path d="M108 191 L128 222 L148 191" fill="none" stroke="${dark}" stroke-width="4" stroke-linejoin="round"/>`;
      break;
    case "collar":
      out += `<path d="M112 192 L128 212 L144 192 Z" fill="${p.skin}"/>
  <path d="M110 190 L128 212 L116 226 L98 200 Z" fill="#ffffff"/>
  <path d="M146 190 L128 212 L140 226 L158 200 Z" fill="#ffffff"/>
  <path d="M128 212 L128 256" stroke="${dark}" stroke-width="2" opacity="0.5"/>`;
      break;
    case "turtle":
      out += `<path d="M106 174 C112 168 144 168 150 174 L154 200 C140 208 116 208 102 200 Z" fill="${shade(c, 0.12)}"/>
  <path d="M106 184 C118 190 138 190 150 184 M104 194 C118 200 138 200 152 194" fill="none" stroke="${dark}" stroke-width="2" opacity="0.35"/>`;
      break;
    case "hoodie":
      out += `<path d="M108 192 C114 204 142 204 148 192" fill="none" stroke="${dark}" stroke-width="5" stroke-linecap="round"/>
  <path d="M116 202 L114 230 M140 202 L142 230" stroke="#ffffff" stroke-width="3" stroke-linecap="round" opacity="0.85"/>
  <circle cx="114" cy="232" r="3" fill="#ffffff" opacity="0.85"/><circle cx="142" cy="232" r="3" fill="#ffffff" opacity="0.85"/>`;
      break;
    default: // crew
      out += `<path d="M106 193 C112 206 144 206 150 193" fill="none" stroke="${dark}" stroke-width="5" stroke-linecap="round"/>`;
  }
  if (p.pin) out += `<circle cx="170" cy="222" r="7" fill="#00ff94" stroke="#ffffff" stroke-width="2.5"/>`;
  return out;
}

const HAIR_BACK = {
  long: `M78 116 C72 66 104 54 128 54 C152 54 184 66 178 116 C182 160 186 196 190 228 C168 238 88 238 66 228 C70 196 74 160 78 116 Z`,
  wavy: `M78 116 C72 66 104 54 128 54 C152 54 184 66 178 116 C186 140 176 160 186 182 C196 204 180 218 190 232 C168 242 88 242 66 232 C76 218 60 204 70 182 C80 160 70 140 78 116 Z`,
  bob: `M80 118 C74 70 104 56 128 56 C152 56 182 70 176 118 L180 166 C170 176 158 176 152 168 L104 168 C98 176 86 176 76 166 Z`,
  ponytail: `M166 84 C198 92 208 142 192 188 C188 198 176 196 178 184 C186 148 180 114 160 98 Z`,
  bun: `M128 52 m-22 0 a22 22 0 1 0 44 0 a22 22 0 1 0 -44 0`,
  curlyLong: `M74 118 C66 60 106 48 128 48 C150 48 190 60 182 118 C192 150 186 190 192 214 C166 230 90 230 64 214 C70 190 64 150 74 118 Z`,
};

const HAIR_FRONT = {
  crop: `M84 118 C80 84 100 60 130 60 C160 60 178 82 172 118 C168 104 162 96 156 92 C140 98 116 98 100 92 C94 98 88 106 84 118 Z`,
  sidepart: `M84 116 C80 78 104 58 132 58 C162 58 180 82 172 116 C170 102 166 94 160 88 C146 92 124 86 112 78 C104 88 92 98 84 116 Z`,
  quiff: `M84 116 C80 86 92 66 110 58 C118 44 148 42 162 56 C178 68 178 94 172 116 C168 102 162 94 154 90 C136 94 114 92 100 90 C92 98 86 106 84 116 Z`,
  buzz: `M86 110 C84 82 102 64 128 64 C154 64 172 82 170 110 C164 96 150 88 128 88 C106 88 92 96 86 110 Z`,
  sweep: `M84 118 C80 76 106 58 132 58 C160 58 178 78 172 120 C166 100 152 86 130 84 C114 90 98 102 84 118 Z`,
  curtain: `M84 122 C80 78 104 58 128 58 C152 58 176 78 172 122 C168 100 156 88 136 86 C132 92 130 96 128 102 C126 96 124 92 120 86 C100 88 88 100 84 122 Z`,
  fringe: `M84 114 C82 76 104 60 128 60 C154 60 176 78 172 114 C170 104 168 98 164 96 C140 100 116 100 92 96 C88 100 86 106 84 114 Z`,
  neat: `M84 116 C80 80 102 62 128 62 C154 62 176 80 172 116 C166 98 150 88 128 88 C106 88 90 98 84 116 Z`,
};

function curly(color) {
  let s = `<path d="${HAIR_FRONT.neat}" fill="${color}"/>`;
  for (let a = 190; a <= 350; a += 16) {
    const r = (a * Math.PI) / 180;
    const x = 128 + 46 * Math.cos(r);
    const y = 102 + 40 * Math.sin(r);
    s += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="13" fill="${color}"/>`;
  }
  s += `<circle cx="112" cy="66" r="14" fill="${color}"/><circle cx="144" cy="66" r="14" fill="${color}"/><circle cx="128" cy="60" r="14" fill="${color}"/>`;
  return s;
}

function face(p) {
  const ink = "#2b1d1a";
  const brow = shade(p.hair, -0.1);
  const skinShadow = shade(p.skin, -0.16);
  let s = `
  <ellipse cx="84" cy="122" rx="8" ry="11" fill="${p.skin}"/>
  <ellipse cx="172" cy="122" rx="8" ry="11" fill="${p.skin}"/>
  <ellipse cx="84" cy="122" rx="4" ry="6" fill="${skinShadow}" opacity="0.6"/>
  <ellipse cx="172" cy="122" rx="4" ry="6" fill="${skinShadow}" opacity="0.6"/>
  <ellipse cx="${HEAD.cx}" cy="${HEAD.cy}" rx="${HEAD.rx}" ry="${HEAD.ry}" fill="${p.skin}"/>
  <ellipse cx="146" cy="96" rx="22" ry="16" fill="#ffffff" opacity="0.12"/>`;

  // eyes
  if (p.eyes === "happy") {
    s += `<path d="M103 122 Q110 115 117 122 M139 122 Q146 115 153 122" fill="none" stroke="${ink}" stroke-width="3.4" stroke-linecap="round"/>`;
  } else {
    s += `<ellipse cx="110" cy="121" rx="4.4" ry="5.4" fill="${ink}"/><ellipse cx="146" cy="121" rx="4.4" ry="5.4" fill="${ink}"/>
  <circle cx="111.6" cy="119" r="1.5" fill="#ffffff"/><circle cx="147.6" cy="119" r="1.5" fill="#ffffff"/>`;
    if (p.lashes) s += `<path d="M104 116 L101 113 M152 116 L155 113" stroke="${ink}" stroke-width="2.2" stroke-linecap="round"/>`;
  }
  // brows
  const by = p.eyes === "happy" ? 105 : 107;
  s += `<path d="M101 ${by} Q110 ${by - 5} 119 ${by - 1} M137 ${by - 1} Q146 ${by - 5} 155 ${by}" fill="none" stroke="${brow}" stroke-width="3.4" stroke-linecap="round"/>`;
  // nose
  s += `<path d="M128 126 Q132 134 126 137" fill="none" stroke="${skinShadow}" stroke-width="2.6" stroke-linecap="round"/>`;
  // blush
  s += `<ellipse cx="99" cy="138" rx="8" ry="4.5" fill="#ff8fa3" opacity="0.28"/><ellipse cx="157" cy="138" rx="8" ry="4.5" fill="#ff8fa3" opacity="0.28"/>`;

  // facial hair (under the mouth)
  if (p.beard === "full") {
    s += `<path d="M86 124 C86 162 104 184 128 184 C152 184 170 162 170 124 C166 142 160 150 152 153 C144 146 112 146 104 153 C96 150 90 142 86 124 Z" fill="${p.hair}"/>`;
  } else if (p.beard === "stubble") {
    s += `<path d="M88 128 C90 162 106 180 128 180 C150 180 166 162 168 128 C162 146 154 154 128 156 C102 154 94 146 88 128 Z" fill="${p.hair}" opacity="0.22"/>`;
  }
  // mouth
  const lip = p.beard === "full" ? "#f0b3a8" : "#b5475a";
  if (p.mouth === "grin") {
    s += `<path d="M114 144 Q128 162 142 144 Z" fill="#8c2f45"/><path d="M117 145 L139 145 Q138 149 128 150 Q118 149 117 145 Z" fill="#ffffff"/>`;
  } else if (p.mouth === "soft") {
    s += `<path d="M119 147 Q128 153 137 147" fill="none" stroke="${lip}" stroke-width="3" stroke-linecap="round"/>`;
  } else {
    s += `<path d="M115 145 Q128 157 141 145" fill="none" stroke="${lip}" stroke-width="3.2" stroke-linecap="round"/>`;
  }
  return s;
}

function accessories(p) {
  let s = "";
  if (p.earrings) s += `<circle cx="84" cy="136" r="3.6" fill="#f5c542"/><circle cx="172" cy="136" r="3.6" fill="#f5c542"/>`;
  if (p.glasses) {
    const g = p.glasses === "gold" ? "#c9973b" : "#1f2433";
    s += `<circle cx="110" cy="121" r="13" fill="#ffffff" fill-opacity="0.14" stroke="${g}" stroke-width="3.2"/>
  <circle cx="146" cy="121" r="13" fill="#ffffff" fill-opacity="0.14" stroke="${g}" stroke-width="3.2"/>
  <path d="M123 120 Q128 116 133 120 M97 119 L86 116 M159 119 L170 116" fill="none" stroke="${g}" stroke-width="3" stroke-linecap="round"/>`;
  }
  if (p.headphones) {
    const h = p.headphones;
    s += `<path d="M80 118 C76 58 180 58 176 118" fill="none" stroke="${h}" stroke-width="9" stroke-linecap="round"/>
  <rect x="68" y="104" width="20" height="34" rx="9" fill="${h}"/><rect x="168" y="104" width="20" height="34" rx="9" fill="${h}"/>
  <rect x="72" y="110" width="6" height="22" rx="3" fill="#ffffff" opacity="0.35"/><rect x="178" y="110" width="6" height="22" rx="3" fill="#ffffff" opacity="0.35"/>`;
  }
  if (p.beanie) {
    const b = p.beanie;
    s += `<path d="M80 96 C80 58 104 42 128 42 C152 42 176 58 176 96 Z" fill="${b}"/>
  <rect x="76" y="82" width="104" height="20" rx="10" fill="${shade(b, -0.15)}"/>
  <path d="M92 85 V99 M108 85 V99 M124 85 V99 M140 85 V99 M156 85 V99" stroke="#000000" stroke-opacity="0.12" stroke-width="3"/>
  <path d="M104 56 C114 48 134 46 148 52" fill="none" stroke="#ffffff" stroke-opacity="0.25" stroke-width="5" stroke-linecap="round"/>`;
  }
  return s;
}

function hijab(p) {
  const c = p.hijab;
  const d = shade(c, -0.16);
  return `
  <path fill-rule="evenodd" fill="${c}" d="M128 48 C86 48 68 84 70 126 C72 158 86 180 102 192 C82 200 48 214 34 256 L222 256 C208 214 174 200 154 192 C170 180 184 158 186 126 C188 84 170 48 128 48 Z M128 72 C104 72 90 90 90 118 C90 146 106 166 128 166 C150 166 166 146 166 118 C166 90 152 72 128 72 Z"/>
  <path d="M90 118 C90 146 106 166 128 166 C150 166 166 146 166 118 C166 150 150 176 128 178 C106 176 90 150 90 118 Z" fill="${d}" opacity="0.55"/>
  <path d="M96 64 C110 54 140 52 158 62" fill="none" stroke="#ffffff" stroke-opacity="0.22" stroke-width="6" stroke-linecap="round"/>`;
}

function portrait(id, p) {
  const bg = background(id, BG[p.bg]);
  let s = "";
  if (p.hijab) {
    s += body({ ...p, neck: "crew" });
    s += face(p);
    s += hijab(p);
    s += accessories({ ...p, earrings: false });
  } else {
    if (HAIR_BACK[p.back]) s += `<path d="${HAIR_BACK[p.back]}" fill="${p.back === "ponytail" || p.back === "bun" ? p.hair : shade(p.hair, -0.06)}"/>`;
    s += body(p);
    s += face(p);
    if (p.front === "curly") s += curly(p.hair);
    else if (p.front && !p.beanie) s += `<path d="${HAIR_FRONT[p.front]}" fill="${p.hair}"/>`;
    if (p.front && p.front !== "curly" && !p.beanie) {
      s += `<path d="M104 72 C116 64 136 62 150 68" fill="none" stroke="#ffffff" stroke-opacity="0.18" stroke-width="5" stroke-linecap="round"/>`;
    }
    if (p.beanie) s += `<path d="M84 116 C82 106 84 100 88 98 L94 116 Z M172 116 C174 106 172 100 168 98 L162 116 Z" fill="${p.hair}"/>`;
    s += accessories(p);
  }
  // Scale the character up from the bottom-centre so it fills the frame nicely.
  return svg(`${bg}\n  <g transform="translate(128 256) scale(1.12) translate(-128 -256)">${s}\n  </g>`);
}

/* ----------------------------------------------------------------- aurora */
function aurora(id, a) {
  const [c1, c2, c3] = a.colors;
  return svg(`
  <defs>
    <radialGradient id="base-${id}" cx="0.5" cy="0.4" r="0.8">
      <stop offset="0" stop-color="${a.base[0]}"/><stop offset="1" stop-color="${a.base[1]}"/>
    </radialGradient>
    <filter id="blur-${id}" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="${a.blur ?? 22}"/></filter>
    <radialGradient id="orb-${id}" cx="0.35" cy="0.3" r="0.75">
      <stop offset="0" stop-color="#ffffff" stop-opacity="0.95"/>
      <stop offset="0.25" stop-color="${c1}" stop-opacity="0.95"/>
      <stop offset="0.7" stop-color="${c2}" stop-opacity="0.9"/>
      <stop offset="1" stop-color="${c3}" stop-opacity="0.85"/>
    </radialGradient>
    <linearGradient id="rim-${id}" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#ffffff" stop-opacity="0.7"/><stop offset="1" stop-color="#ffffff" stop-opacity="0"/>
    </linearGradient>
  </defs>
  <rect width="256" height="256" fill="url(#base-${id})"/>
  <g filter="url(#blur-${id})" opacity="0.9">
    <circle cx="${a.b1[0]}" cy="${a.b1[1]}" r="70" fill="${c1}"/>
    <circle cx="${a.b2[0]}" cy="${a.b2[1]}" r="62" fill="${c2}"/>
    <circle cx="${a.b3[0]}" cy="${a.b3[1]}" r="54" fill="${c3}"/>
  </g>
  ${a.shape === "ring"
      ? `<circle cx="128" cy="128" r="58" fill="none" stroke="url(#orb-${id})" stroke-width="26"/>
  <circle cx="128" cy="128" r="71" fill="none" stroke="url(#rim-${id})" stroke-width="1.5"/>`
      : a.shape === "diamond"
        ? `<path d="M128 56 L196 128 L128 200 L60 128 Z" fill="url(#orb-${id})"/>
  <path d="M128 56 L196 128 L128 200 L60 128 Z" fill="none" stroke="url(#rim-${id})" stroke-width="2"/>
  <path d="M128 56 L150 128 L128 200 M60 128 H196" stroke="#ffffff" stroke-opacity="0.18" stroke-width="2" fill="none"/>`
        : `<circle cx="128" cy="128" r="64" fill="url(#orb-${id})"/>
  <circle cx="128" cy="128" r="64" fill="none" stroke="url(#rim-${id})" stroke-width="2"/>
  <ellipse cx="108" cy="102" rx="24" ry="14" fill="#ffffff" opacity="0.35" transform="rotate(-30 108 102)"/>`}
  ${a.sparkle ? `<path d="M190 58 L194 70 L206 74 L194 78 L190 90 L186 78 L174 74 L186 70 Z" fill="#ffffff" opacity="0.85"/>
  <circle cx="66" cy="196" r="3" fill="#ffffff" opacity="0.7"/><circle cx="206" cy="182" r="2" fill="#ffffff" opacity="0.6"/>` : ""}`);
}

function svg(inner) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="256" height="256">${inner}\n</svg>\n`;
}

/* ------------------------------------------------------------------- data */
const S = SKIN, H = HAIR;
const PEOPLE = [
  { bg: "mint", skin: S.light, hair: H.espresso, back: "long", front: "curtain", outfit: "#ffffff", neck: "crew", eyes: "open", mouth: "smile", earrings: true, lashes: true },
  { bg: "sky", skin: S.warm, hair: H.black, front: "quiff", outfit: "#1f2a44", neck: "collar", eyes: "open", mouth: "smile" },
  { bg: "lilac", skin: S.porcelain, hair: H.blonde, back: "bob", front: "fringe", outfit: "#6d4ee0", neck: "turtle", eyes: "open", mouth: "soft", lashes: true },
  { bg: "honey", skin: S.beige, hair: H.brown, front: "sidepart", outfit: "#0f766e", neck: "crew", eyes: "happy", mouth: "grin", glasses: "dark" },
  { bg: "rose", skin: S.light, hair: H.auburn, back: "wavy", front: "sweep", outfit: "#1e293b", neck: "vneck", eyes: "open", mouth: "smile", lashes: true },
  { bg: "teal", skin: S.honey, hair: H.black, front: "curly", outfit: "#f97316", neck: "hoodie", eyes: "open", mouth: "grin", headphones: "#111827" },
  { bg: "indigo", skin: S.light, hair: H.black, hijab: "#2f3b8f", outfit: "#e0e7ff", eyes: "open", mouth: "smile", lashes: true },
  { bg: "coral", skin: S.warm, hair: H.espresso, front: "crop", outfit: "#334155", neck: "crew", eyes: "open", mouth: "smile", beard: "full" },
  { bg: "orchid", skin: S.porcelain, hair: H.plum, back: "bun", front: "neat", outfit: "#ffffff", neck: "vneck", eyes: "happy", mouth: "smile", earrings: true },
  { bg: "ocean", skin: S.beige, hair: H.ash, front: "buzz", outfit: "#0ea5e9", neck: "crew", eyes: "open", mouth: "soft", beard: "stubble" },
  { bg: "peach", skin: S.light, hair: H.chestnut, back: "ponytail", front: "sidepart", outfit: "#16a34a", neck: "hoodie", eyes: "open", mouth: "grin", lashes: true },
  { bg: "lime", skin: S.warm, hair: H.brown, front: "quiff", outfit: "#ffffff", neck: "collar", eyes: "open", mouth: "smile", glasses: "gold" },
  { bg: "sky", skin: S.porcelain, hair: H.black, back: "long", front: "fringe", outfit: "#be185d", neck: "crew", eyes: "open", mouth: "smile", lashes: true, headphones: "#f8fafc" },
  { bg: "mint", skin: S.honey, hair: H.espresso, front: "sweep", outfit: "#1e3a8a", neck: "turtle", eyes: "open", mouth: "soft" },
  { bg: "rose", skin: S.light, hair: H.black, hijab: "#7a2e5a", outfit: "#fce7f3", eyes: "happy", mouth: "smile", glasses: "gold" },
  { bg: "honey", skin: S.beige, hair: H.black, front: "curly", outfit: "#4338ca", neck: "crew", eyes: "open", mouth: "smile", beard: "stubble" },
  { bg: "lilac", skin: S.warm, hair: H.burgundy, back: "curlyLong", front: "curly", outfit: "#f59e0b", neck: "vneck", eyes: "open", mouth: "grin", earrings: true, lashes: true },
  { bg: "teal", skin: S.light, hair: H.blonde, front: "sidepart", outfit: "#0f172a", neck: "hoodie", eyes: "open", mouth: "smile" },
  { bg: "coral", skin: S.porcelain, hair: H.chestnut, back: "bob", front: "curtain", outfit: "#ffffff", neck: "collar", eyes: "open", mouth: "soft", glasses: "dark", lashes: true },
  { bg: "indigo", skin: S.honey, hair: H.black, front: "neat", outfit: "#e11d48", neck: "crew", eyes: "happy", mouth: "grin", beanie: "#facc15" },
  { bg: "orchid", skin: S.light, hair: H.brown, back: "wavy", front: "curtain", outfit: "#0d9488", neck: "turtle", eyes: "open", mouth: "smile", lashes: true, pin: true },
  { bg: "ocean", skin: S.warm, hair: H.espresso, front: "crop", outfit: "#ffffff", neck: "vneck", eyes: "open", mouth: "grin", headphones: "#6d28d9" },
  { bg: "peach", skin: S.beige, hair: H.black, hijab: "#0f766e", outfit: "#ccfbf1", eyes: "open", mouth: "grin", lashes: true },
  { bg: "lime", skin: S.porcelain, hair: H.ash, front: "quiff", outfit: "#7c3aed", neck: "crew", eyes: "open", mouth: "smile", beard: "full", glasses: "dark", pin: true },
];

const AURORA = [
  { base: ["#0b1a2e", "#040811"], colors: ["#00ff94", "#00e5ff", "#1d4ed8"], b1: [70, 80], b2: [190, 110], b3: [120, 210], sparkle: true },
  { base: ["#1a0b2e", "#07040f"], colors: ["#ff3dbb", "#b14eff", "#4338ca"], b1: [80, 190], b2: [190, 70], b3: [60, 60] },
  { base: ["#062220", "#030d0c"], colors: ["#5eead4", "#10b981", "#0e7490"], b1: [190, 190], b2: [60, 90], b3: [180, 60], shape: "ring" },
  { base: ["#2a1606", "#0d0703"], colors: ["#fde68a", "#f59e0b", "#e11d48"], b1: [60, 60], b2: [200, 200], b3: [200, 60], sparkle: true },
  { base: ["#0a1030", "#04060f"], colors: ["#a5b4fc", "#6366f1", "#00e5ff"], b1: [196, 72], b2: [70, 196], b3: [128, 40], shape: "diamond" },
  { base: ["#2a0a1c", "#0e030a"], colors: ["#fbcfe8", "#f472b6", "#7c3aed"], b1: [128, 60], b2: [60, 180], b3: [200, 180] },
  { base: ["#081a10", "#030a06"], colors: ["#d9f99d", "#00ff94", "#0891b2"], b1: [60, 200], b2: [200, 60], b3: [128, 128], shape: "ring", sparkle: true },
  { base: ["#1a1030", "#06040f"], colors: ["#e9d5ff", "#c084fc", "#ff3dbb"], b1: [200, 200], b2: [60, 70], b3: [190, 80], shape: "diamond" },
  { base: ["#051a2a", "#02080e"], colors: ["#bae6fd", "#38bdf8", "#00ff94"], b1: [60, 128], b2: [196, 128], b3: [128, 210] },
  { base: ["#2a0f0a", "#0d0503"], colors: ["#fed7aa", "#fb7185", "#b14eff"], b1: [196, 196], b2: [60, 60], b3: [60, 196], shape: "ring" },
  { base: ["#0c1424", "#03060c"], colors: ["#f8fafc", "#94a3b8", "#00e5ff"], b1: [80, 70], b2: [190, 190], b3: [196, 70], sparkle: true },
  { base: ["#10240a", "#050c03"], colors: ["#fef08a", "#a3e635", "#00e5ff"], b1: [190, 70], b2: [70, 190], b3: [128, 128], shape: "diamond", sparkle: true },
];

/* ------------------------------------------------------------------- main */
mkdirSync(OUT, { recursive: true });
for (const f of readdirSync(OUT)) if (f.endsWith(".svg")) unlinkSync(join(OUT, f));

const pad = (n) => String(n).padStart(2, "0");
PEOPLE.forEach((p, i) => writeFileSync(join(OUT, `student-${pad(i + 1)}.svg`), portrait(`s${i + 1}`, p)));
AURORA.forEach((a, i) => writeFileSync(join(OUT, `aurora-${pad(i + 1)}.svg`), aurora(`a${i + 1}`, a)));

console.log(`Wrote ${PEOPLE.length} student + ${AURORA.length} aurora avatars to ${OUT}`);
