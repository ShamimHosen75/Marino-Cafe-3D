import '@fontsource/jost/400.css';
import '@fontsource/jost/500.css';
import '@fontsource/bodoni-moda/600.css';
import '@fontsource/playfair-display/400-italic.css';
import './style.css';

import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import { createScene, range, BEATS } from './three/scene.js';

const photoUrls = import.meta.glob('./assets/img/*.webp', { eager: true, import: 'default' });
const photo = (name) => photoUrls[`./assets/img/${name}.webp`];

gsap.registerPlugin(ScrollTrigger);

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const ease = (t) => 1 - Math.pow(1 - t, 3);

/* ------------------------------------------------------------------ */
/* Smooth scroll                                                       */
/* ------------------------------------------------------------------ */

const lenis = new Lenis({ lerp: 0.085, wheelMultiplier: 0.9, smoothWheel: !reduceMotion });
lenis.on('scroll', ScrollTrigger.update);
gsap.ticker.add((t) => lenis.raf(t * 1000));
gsap.ticker.lagSmoothing(0);
lenis.stop();

let progress = 0;
ScrollTrigger.create({
  trigger: '.story',
  start: 'top top',
  end: 'bottom bottom',
  onUpdate: (self) => (progress = self.progress),
});

/* ------------------------------------------------------------------ */
/* WebGL                                                               */
/* ------------------------------------------------------------------ */

const canvas = $('#webgl');
const scene = createScene(canvas);
window.addEventListener('resize', () => {
  scene.resize();
  ScrollTrigger.refresh();
});

/* ------------------------------------------------------------------ */
/* Intro (on load)                                                     */
/* ------------------------------------------------------------------ */

const intro = { v: 0 };
const heroIntro = { v: 0 };

function playIntro() {
  document.body.classList.remove('is-loading');
  const tl = gsap.timeline({
    defaults: { ease: 'power3.out' },
    onComplete: () => lenis.start(),
  });
  if (reduceMotion) {
    intro.v = 1;
    tl.progress(1);
    return;
  }
  tl.from('.nav', { opacity: 0, y: -12, duration: 0.8 })
    .from('.eyebrow', { opacity: 0, y: 14, duration: 0.7 }, 0.25)
    .from('.hero__rail-line', { scaleY: 0, duration: 1.0, stagger: 0.12, ease: 'power2.inOut' }, 0.3)
    .from('.hero__rail span:not(.hero__rail-line)', { opacity: 0, duration: 0.6 }, 0.5)
    .fromTo('.hero__title .line > span', { yPercent: 105 }, { yPercent: 0, duration: 1.0, stagger: 0.12, ease: 'power4.out' }, 0.35)
    .to(heroIntro, { v: 1, duration: 1.3, ease: 'power2.out' }, 0.3)
    .to(intro, { v: 1, duration: 1.6, ease: 'power3.out' }, 0.3)
    .from('.hero__lede', { opacity: 0, y: 16, filter: 'blur(6px)', duration: 0.8 }, 0.85)
    .from('.hero .pill', { opacity: 0, y: 16, filter: 'blur(6px)', duration: 0.8 }, 0.98)
    .from(['.dots', '.pager'], { opacity: 0, duration: 0.8 }, 1.05);
}

/* ------------------------------------------------------------------ */
/* Scroll-driven DOM                                                   */
/* ------------------------------------------------------------------ */

const hero = $('.hero');
const nav = $('.nav');
const navLinks = $('.nav__links');
const navTitle = $('.nav__title');
const navNum = $('.nav__title-num');
const navSub = $('.nav__title-sub');
const searchBtn = $('.search-btn');
const balletLines = $$('.ballet__title .line > span');
const balletTitle = $('.ballet__title');
const finaleLine = $('.finale__title .line > span');
const finaleTitle = $('.finale__title');
const cta = $('.finale__cta');
const dots = $$('.dots i');
const leaders = $('#leaders');
const labels = $$('.label').map((el) => {
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('pathLength', '1');
  path.style.strokeDasharray = '1';
  path.style.strokeDashoffset = '1';
  leaders.appendChild(path);
  return { el, path, side: el.dataset.side, target: el.dataset.target };
});

/* Photo cut-outs ---------------------------------------------------- */

const heroPhoto = $('.photo-hero');
heroPhoto.src = photo('hero-twirl');
const plateWrap = $('.photo-plate');
$('img', plateWrap).src = photo('plate');
const layers = { front: $('.photos--front'), back: $('.photos--back') };

/**
 * Which photo stands in for each 3D ingredient (in creation order per kind).
 * w = width in the ingredient's local units, rot = base rotation (deg), flip = mirror.
 */
const SPRITES = {
  shrimp: [
    null, // the top shrimp sits out; three identical prawn stacks read as copy-paste
    { src: 'prawns', w: 0.72, rot: 12, flip: true },
    { src: 'prawns', w: 0.56, rot: -28 },
  ],
  lemon: [{ src: 'lemon', w: 0.72, rot: -18 }],
  chili: [
    { src: 'chili-2', w: 0.62, rot: -10 },
    { src: 'chili', w: 0.48, rot: 35 },
    { src: 'chili-2', w: 0.5, rot: 140, flip: true },
  ],
  tomato: [
    { src: 'tomato', w: 0.34, rot: 0 },
    { src: 'tomato', w: 0.3, rot: 40 },
    { src: 'tomato', w: 0.28, rot: -30 },
  ],
  garlic: [
    { src: 'garlic', w: 0.42, rot: 10 },
    { src: 'garlic', w: 0.3, rot: -25 },
  ],
  basil: [
    { src: 'basil', w: 0.55, rot: -20 },
    { src: 'basil-2', w: 0.34, rot: 25 },
  ],
  parmesan: [{ src: 'parmesan', w: 0.5, rot: -12 }],
};
const SPRITE_PX = 200; // base CSS width; each frame scales from this

const kindCount = {};
const sprites = scene.screenSprites().map((sp) => {
  const n = (kindCount[sp.kind] = (kindCount[sp.kind] ?? -1) + 1);
  const cfg = SPRITES[sp.kind]?.[n];
  if (!cfg) return null;
  const img = new Image();
  img.src = photo(cfg.src);
  img.alt = '';
  img.decoding = 'async';
  img.className = 'sprite';
  img.style.width = `${SPRITE_PX}px`;
  layers.front.appendChild(img);
  return { img, cfg, front: true };
});

function updatePhotos(p, time) {
  // 01 · hero forkful: lifts, swells and dissolves into the 3D spiral
  const heroGo = ease(range(p, 0.015, 0.09));
  const bob = Math.sin(time * 0.9) * 6 * (1 - heroGo);
  const blur = (1 - heroIntro.v) * 14 + heroGo * 8;
  css(heroPhoto, {
    opacity: heroIntro.v * (1 - heroGo),
    visibility: heroGo >= 1 ? 'hidden' : '',
    filter: blur > 0.05 ? `blur(${blur}px)` : '',
    transform: `translate3d(0, calc(-50% + ${bob - heroGo * 120 + (1 - heroIntro.v) * 30}px), 0) rotate(${heroGo * -14}deg) scale(${1 + heroGo * 0.35})`,
  });

  // The 3D spiral only lives between the hero and the plate
  const glIn = range(p, 0.06, 0.13);
  const glOut = range(p, 0.64, 0.71);
  canvas.style.opacity = Math.min(glIn, 1 - glOut);

  // 02 · ingredient cut-outs ride the 3D choreography
  const alpha = ease(range(p, 0.1, 0.2)) * (1 - range(p, 0.63, 0.7));
  const poses = scene.screenSprites();
  sprites.forEach((s, i) => {
    if (!s) return;
    const sp = poses[i];
    if (alpha <= 0.001 || sp.px <= 0.01) {
      s.img.style.opacity = 0;
      return;
    }
    if (sp.front !== s.front) {
      s.front = sp.front;
      (s.front ? layers.front : layers.back).appendChild(s.img);
    }
    const k = (s.cfg.w * sp.px) / SPRITE_PX;
    const rot = s.cfg.rot + ((sp.rot * 180) / Math.PI) * 0.35 + Math.sin(time * 0.6 + sp.seed * 9) * 4;
    s.img.style.opacity = alpha;
    s.img.style.transform = `translate3d(${sp.x}px, ${sp.y}px, 0) translate(-50%, -50%) rotate(${rot}deg) scale(${s.cfg.flip ? -k : k}, ${k})`;
  });

  // 03 · the plated dish rises in as the spiral collapses
  const plateIn = ease(range(p, 0.65, 0.8));
  plateWrap.style.opacity = plateIn;
  plateWrap.style.transform = `translate(-50%, -50%) translateY(${(1 - plateIn) * 45}vh) rotate(${(1 - plateIn) * -50 + Math.sin(time * 0.25) * 2}deg) scale(${0.8 + plateIn * 0.2})`;
}

function css(el, props) {
  Object.assign(el.style, props);
}
const pt = { x: 0, y: 0 };
let lastTheme = '';
let lastDot = -1;

function updateDom(p) {
  // 01 → 02: rust panel scrolls away revealing the cream stage
  const heroOut = range(p, ...BEATS.heroOut);
  hero.style.transform = `translate3d(0, ${-heroOut * 100}%, 0)`;

  // nav theme flips once the rust panel has cleared the header
  const dark = heroOut > 0.9;
  const theme = dark ? 'light' : 'dark';
  if (theme !== lastTheme) {
    lastTheme = theme;
    nav.dataset.theme = theme;
    document.documentElement.style.setProperty('--nav-fg', dark ? 'var(--ink)' : 'var(--cream-light)');
    document.querySelector('meta[name="theme-color"]').content = dark ? '#f0e4d1' : '#a0411b';
  }

  const titleIn = ease(range(p, 0.12, 0.2));
  css(navLinks, { opacity: 1 - titleIn, transform: `translateY(${-titleIn * 8}px)`, pointerEvents: titleIn > 0.5 ? 'none' : '' });
  css(navTitle, { opacity: titleIn, transform: `translateY(${(1 - titleIn) * 8}px)` });
  css(searchBtn, { opacity: titleIn, transform: `scale(${0.6 + titleIn * 0.4})`, pointerEvents: titleIn > 0.5 ? 'auto' : 'none' });

  // 02 · "A little bit of everything."
  balletLines.forEach((span, i) => {
    const t = ease(range(p, 0.13 + i * 0.025, 0.22 + i * 0.025));
    span.style.transform = `translateY(${(1 - t) * 105}%)`;
  });
  const balletOut = range(p, 0.55, 0.63);
  css(balletTitle, { opacity: 1 - balletOut, filter: balletOut > 0 ? `blur(${balletOut * 6}px)` : '' });

  // Labels + leader lines
  const labelOut = range(p, 0.54, 0.6);
  labels.forEach((l, i) => {
    const t = ease(range(p, 0.28 + i * 0.018, 0.36 + i * 0.018)) * (1 - labelOut);
    l.el.style.opacity = t;
    l.el.style.translate = `0 ${(1 - t) * 10}px`;
    if (t <= 0.001 || !scene.project(l.target, pt)) {
      l.path.style.strokeDashoffset = '1';
      return;
    }
    const r = l.el.getBoundingClientRect();
    const y = r.bottom;
    const [x0, x1] = l.side === 'left' ? [r.left, r.right] : [r.right, r.left];
    // stop a little short of the ingredient
    const dx = pt.x - x1;
    const dy = pt.y - y;
    const len = Math.hypot(dx, dy) || 1;
    const gap = Math.min(18, len * 0.3);
    const ex = pt.x - (dx / len) * gap;
    const ey = pt.y - (dy / len) * gap;
    l.path.setAttribute('d', `M${x0},${y} L${x1},${y} L${ex},${ey}`);
    l.path.style.strokeDashoffset = `${1 - t}`;
  });

  // 03 · "Your table is waiting."
  const finIn = ease(range(p, 0.62, 0.72));
  finaleLine.style.transform = `translateY(${(1 - finIn) * 105}%)`;
  finaleTitle.style.opacity = 0.35 + finIn * 0.65;
  const sub = ease(range(p, 0.7, 0.78));
  css(navNum, { opacity: sub, transform: `translateY(${(1 - sub) * 6}px)` });
  css(navSub, { opacity: sub, transform: `translateY(${(1 - sub) * 6}px)` });
  const ctaIn = ease(range(p, 0.82, 0.9));
  css(cta, { opacity: ctaIn, transform: `translate(-50%, ${(1 - ctaIn) * 16}px)`, filter: ctaIn < 1 ? `blur(${(1 - ctaIn) * 6}px)` : '' });

  // side dots
  const idx = p < 0.1 ? 0 : p < 0.62 ? 1 : 2;
  if (idx !== lastDot) {
    lastDot = idx;
    dots.forEach((d, i) => d.classList.toggle('is-active', i === idx));
  }
}

/* ------------------------------------------------------------------ */
/* Loop                                                                */
/* ------------------------------------------------------------------ */

let smooth = 0;
gsap.ticker.add((time) => {
  smooth += (progress - smooth) * 0.14;
  if (Math.abs(progress - smooth) < 0.00005) smooth = progress;
  scene.update(smooth, time, intro.v);
  updatePhotos(smooth, time);
  updateDom(smooth);
});

// Expose a hook for screenshot / test tooling.
window.__marino = {
  setProgress(v) {
    const st = ScrollTrigger.getAll()[0];
    const y = st.start + (st.end - st.start) * v;
    lenis.scrollTo(y, { immediate: true, force: true });
    progress = v;
    smooth = v;
  },
  skipIntro() {
    intro.v = 1;
    heroIntro.v = 1;
  },
};

document.fonts.ready.then(() => {
  ScrollTrigger.refresh();
  requestAnimationFrame(playIntro);
});
