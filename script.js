/* =========================================================
   能登・みそぎ 復興学習プログラム — 動きの仕組み（2026-09-18 刷新）
   方針
   - スクロールに連動する動きは「1フレームに1回だけ」まとめて計算する（rAFループは動いている間だけ回す）
   - 要素の位置はスクロールのたびに測らない。読み込み・リサイズ・画像の読込で測り直し、その値を使う
   - 動かすのは transform と opacity と CSS変数だけ（レイアウトを起こさない）
   - 「動きを減らす」設定なら、スクロール連動も開きの演出も止めて、中身を全部見せる
   ========================================================= */
(() => {
  'use strict';

  const root = document.documentElement;
  const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  let reduceMotion = motionQuery.matches;

  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];
  const clamp = (v, min = 0, max = 1) => Math.min(Math.max(v, min), max);

  /* ---------- 位置の控え（スクロールのたびに測らない） ---------- */
  const scenes = [];   // { el, top, height, update(state) }
  let vh = window.innerHeight;
  let docH = root.scrollHeight;

  const measure = () => {
    vh = window.innerHeight;
    docH = root.scrollHeight;
    const y = window.scrollY;
    for (const s of scenes) {
      const r = s.el.getBoundingClientRect();
      s.top = r.top + y;
      s.height = r.height;
    }
    requestTick(true);
  };

  /* ---------- 1フレームに1回だけ回るループ ---------- */
  let ticking = false;
  let lastY = window.scrollY;
  let force = false;

  const requestTick = (forceUpdate = false) => {
    force = force || forceUpdate;
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(frame);
    }
  };

  const frame = () => {
    ticking = false;
    const y = window.scrollY;
    const dy = y - lastY;
    const state = { y, dy, vh };
    if (dy !== 0 || force) {
      for (const s of scenes) {
        // 画面から遠い場面は計算しない
        const near = y + vh > s.top - vh * 0.5 && y < s.top + s.height + vh * 0.5;
        if (near || force) s.update(state, s);
      }
      header(state);
      root.style.setProperty('--wave-x', `${(y * 0.18).toFixed(1)}px`);
      root.style.setProperty('--read', clamp(y / Math.max(docH - vh, 1)).toFixed(4));
    }
    lastY = y;
    force = false;
  };

  const addScene = (el, update) => {
    if (!el) return;
    scenes.push({ el, top: 0, height: 0, update });
  };

  /* 要素が画面のどこにいるか：0＝下端から入った瞬間、1＝上端から出た瞬間 */
  const passage = (s, y) => clamp((y + vh - s.top) / (s.height + vh));

  /* ---------- ヘッダー：読み進める間は隠れ、上へ戻ると出る ---------- */
  const headerEl = $('.site-header');
  const mobileMenu = $('.mobile-menu');
  const menuButton = $('.menu-button');
  const hero = $('.hero');

  const header = ({ y, dy }) => {
    headerEl.classList.toggle('is-solid', y > 16);
    if (Math.abs(dy) < 4) return;
    const pastHero = y > (hero ? hero.offsetHeight * 0.6 : vh * 0.6);
    const menuOpen = mobileMenu.classList.contains('open');
    headerEl.classList.toggle('is-hidden', dy > 0 && pastHero && !menuOpen);
  };

  /* ---------- メニュー：開いている間は本文を操作不可にし、焦点を中へ ---------- */
  const menuLinks = $$('a', mobileMenu);
  menuLinks.forEach((a, i) => a.style.setProperty('--i', i));
  const mainAndFooter = [$('main'), $('.site-footer')];

  const menuNav = $('nav', mobileMenu);
  const setMenu = (open, { returnFocus = true, fromKeyboard = false } = {}) => {
    document.body.classList.toggle('menu-open', open);
    mobileMenu.classList.toggle('open', open);
    mobileMenu.setAttribute('aria-hidden', String(!open));
    menuButton.setAttribute('aria-expanded', String(open));
    $('.sr-only', menuButton).textContent = open ? 'メニューを閉じる' : 'メニューを開く';
    mainAndFooter.forEach((el) => el && (el.inert = open));
    if (open) {
      headerEl.classList.remove('is-hidden');
      // キーボードで開いたら最初の項目へ、指やマウスなら枠を出さずにメニュー自体へ焦点を移す
      const target = fromKeyboard ? menuLinks[0] : menuNav;
      setTimeout(() => target?.focus({ preventScroll: true }), reduceMotion ? 0 : 350);
    } else if (returnFocus) {
      menuButton.focus({ preventScroll: true });
    }
  };
  menuButton.addEventListener('click', (e) => setMenu(!mobileMenu.classList.contains('open'), { fromKeyboard: e.detail === 0 }));
  menuLinks.forEach((a) => a.addEventListener('click', () => setMenu(false, { returnFocus: false })));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && mobileMenu.classList.contains('open')) setMenu(false);
  });

  /* ---------- ① 開き：写真が輪で開いてから見出しが上がる ---------- */
  const ready = () => root.classList.add('is-ready');
  if (reduceMotion) ready();
  else {
    const heroImg = $('.hero-image');
    const go = () => requestAnimationFrame(() => requestAnimationFrame(ready));
    if (heroImg?.complete) go();
    else heroImg?.addEventListener('load', go, { once: true });
    setTimeout(ready, 1600); // 写真が遅くても待たせすぎない
  }

  /* ファーストビューを離れるほど、写真は沈み、文字は先に上がって消える */
  addScene(hero, ({ y }, s) => {
    if (reduceMotion) return;
    const p = clamp(y / s.height);
    hero.style.setProperty('--hp', p.toFixed(4));
  });

  /* ---------- 出てくる動き：同じ段の要素は少しずつ遅らせる ---------- */
  const revealEls = $$('.reveal');
  const revealObserver = new IntersectionObserver((entries) => {
    const entering = entries.filter((e) => e.isIntersecting);
    entering
      .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top || a.boundingClientRect.left - b.boundingClientRect.left)
      .forEach((e, i) => {
        if (!e.target.style.getPropertyValue('--d')) e.target.style.setProperty('--d', `${Math.min(i * 0.08, 0.32)}s`);
        e.target.classList.add('is-in');
        revealObserver.unobserve(e.target);
      });
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.12 });

  /* ---------- ② 見出しの丸：画面を進むほど膨らみ、上まで来たら一度だけ波紋 ---------- */
  $$('.ring-heading').forEach((h) => {
    addScene(h, ({ y }, s) => {
      const p = clamp((y + vh - s.top) / (vh * 0.72));
      h.style.setProperty('--ring', (0.72 + p * 0.38).toFixed(3));
      if (p >= 0.88 && !h.classList.contains('is-rippled')) h.classList.add('is-rippled');
      else if (p < 0.5) h.classList.remove('is-rippled');
    });
  });

  /* 概要の背後の輪 */
  const overview = $('.overview');
  addScene(overview, ({ y }, s) => {
    overview.style.setProperty('--op', passage(s, y).toFixed(4));
  });

  /* ---------- 写真の奥行き：額縁の中で写真だけ少し遅れて動く ---------- */
  $$('[data-parallax]').forEach((img) => {
    const frameEl = img.closest('.frame') || img.parentElement;
    addScene(frameEl, ({ y }, s) => {
      const center = s.top + s.height / 2;
      const pp = clamp((y + vh / 2 - center) / (vh / 2 + s.height / 2), -1, 1);
      img.style.setProperty('--pp', pp.toFixed(4));
    });
  });

  /* ---------- ③ 当日の流れ：線が伸び、通り過ぎた点に輪が立つ ---------- */
  const tlWrap = $('.timeline-wrap');
  const tlTrack = $('.timeline-track');
  const tlItems = $$('.timeline-item');
  const dotOffsets = [];
  const track = { top: 0, height: 1 };
  const measureDots = () => {
    const y = window.scrollY;
    const tr = tlTrack.getBoundingClientRect();
    track.top = tr.top + y;
    track.height = Math.max(tr.height, 1);
    tlItems.forEach((item, i) => {
      const dot = $('.timeline-time span', item).getBoundingClientRect();
      dotOffsets[i] = dot.top + y + dot.height / 2;
    });
  };
  addScene(tlWrap, ({ y }) => {
    const line = y + vh * 0.62; // 画面の6割の高さを「いま読んでいる位置」とみなす
    tlWrap.style.setProperty('--tp', clamp((line - track.top) / track.height).toFixed(4));
    tlItems.forEach((item, i) => item.classList.toggle('is-passed', line >= dotOffsets[i]));
  });

  /* 申し込み枠の背後の輪 */
  const applyBox = $('.apply-box');
  addScene(applyBox, ({ y }, s) => applyBox.style.setProperty('--ap', passage(s, y).toFixed(4)));

  /* ---------- ボタン：輪がカーソルの位置から広がる ---------- */
  $$('.button-primary').forEach((btn) => {
    btn.addEventListener('pointerenter', (e) => {
      const r = btn.getBoundingClientRect();
      btn.style.setProperty('--mx', `${e.clientX - r.left}px`);
      btn.style.setProperty('--my', `${e.clientY - r.top}px`);
    });
  });

  /* ---------- 開閉：高さを伸ばしながら開き、縮めながら閉じる ---------- */
  $$('details.fold').forEach((details) => {
    const summary = $('summary', details);
    const body = $('.fold-body', details);
    let anim = null;
    summary.addEventListener('click', (e) => {
      if (reduceMotion || !body.animate) return; // 標準の開閉に任せる
      e.preventDefault();
      anim?.cancel();
      const opening = !details.open;
      if (opening) details.open = true;
      const full = body.scrollHeight;
      anim = body.animate(
        [{ height: `${opening ? 0 : full}px`, opacity: opening ? 0 : 1 },
         { height: `${opening ? full : 0}px`, opacity: opening ? 1 : 0 }],
        { duration: opening ? 520 : 380, easing: 'cubic-bezier(.16,1,.3,1)' }
      );
      anim.onfinish = () => {
        if (!opening) details.open = false;
        anim = null;
        measure(); // 高さが変わったので位置を測り直す
      };
    });
  });

  /* ---------- 風景：ネイティブの横スクロールに、ドラッグ・矢印・進み具合を足す ---------- */
  const carousel = $('.carousel');
  if (carousel) {
    const rail = $('.carousel-rail', carousel);
    const slides = $$('.carousel-slide', carousel);
    const status = $('.carousel-status span', carousel);
    const bar = $('.carousel-bar', carousel);
    const prev = $('.carousel-prev', carousel);
    const next = $('.carousel-next', carousel);
    let centers = [];
    let current = 0;
    let railTick = false;

    const measureSlides = () => {
      centers = slides.map((sl) => sl.offsetLeft + sl.offsetWidth / 2);
      paintRail();
    };
    const paintRail = () => {
      railTick = false;
      const mid = rail.scrollLeft + rail.clientWidth / 2;
      const step = slides[0].offsetWidth || 1;
      let best = 0;
      slides.forEach((sl, i) => {
        const dist = Math.abs(centers[i] - mid) / step;
        if (dist < Math.abs(centers[best] - mid) / step) best = i;
        sl.style.setProperty('--near', reduceMotion ? 1 : clamp(1 - dist).toFixed(3));
      });
      if (best !== current || !status.textContent) {
        current = best;
        status.textContent = String(current + 1).padStart(2, '0');
        slides.forEach((sl, i) => sl.setAttribute('aria-hidden', String(i !== current)));
      }
      const max = rail.scrollWidth - rail.clientWidth;
      bar.style.setProperty('--cp', (0.1 + 0.9 * clamp(rail.scrollLeft / Math.max(max, 1))).toFixed(4));
      prev.disabled = rail.scrollLeft < 4;
      next.disabled = rail.scrollLeft > max - 4;
    };
    const goTo = (i) => {
      const idx = clamp(i, 0, slides.length - 1);
      rail.scrollTo({ left: centers[idx] - rail.clientWidth / 2, behavior: reduceMotion ? 'auto' : 'smooth' });
    };

    rail.addEventListener('scroll', () => {
      if (!railTick) { railTick = true; requestAnimationFrame(paintRail); }
    }, { passive: true });
    prev.addEventListener('click', () => goTo(current - 1));
    next.addEventListener('click', () => goTo(current + 1));
    rail.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft') { e.preventDefault(); goTo(current - 1); }
      if (e.key === 'ArrowRight') { e.preventDefault(); goTo(current + 1); }
    });

    // マウスのドラッグ（指の操作はブラウザ標準のスクロールに任せる）
    let drag = null;
    rail.addEventListener('pointerdown', (e) => {
      if (e.pointerType !== 'mouse' || e.button !== 0) return;
      drag = { x: e.clientX, left: rail.scrollLeft, moved: false, id: e.pointerId };
    });
    rail.addEventListener('pointermove', (e) => {
      if (!drag) return;
      const dx = e.clientX - drag.x;
      if (!drag.moved && Math.abs(dx) > 4) {
        drag.moved = true;
        rail.classList.add('is-dragging');
        rail.setPointerCapture(drag.id);
      }
      if (drag.moved) rail.scrollLeft = drag.left - dx;
    });
    const endDrag = (e) => {
      if (!drag) return;
      const { moved, x } = drag;
      drag = null;
      if (!moved) return;
      rail.classList.remove('is-dragging');
      // 投げた向きに1枚ぶん進める（ほんの少し動かしただけなら近い写真へ戻る）
      const dx = e.clientX - x;
      const threshold = slides[0].offsetWidth * 0.12;
      goTo(Math.abs(dx) > threshold ? current + (dx < 0 ? 1 : -1) : current);
    };
    rail.addEventListener('pointerup', endDrag);
    rail.addEventListener('pointercancel', endDrag);

    window.addEventListener('resize', measureSlides, { passive: true });
    window.addEventListener('load', measureSlides, { once: true });
    measureSlides();
    // 最初は1枚目を中央に
    rail.scrollLeft = centers[0] - rail.clientWidth / 2;
  }

  /* ---------- 現在地に合わせてナビを更新 ---------- */
  const navLinks = $$('.desktop-nav a, .mobile-menu a');
  const sectionObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      navLinks.forEach((link) => link.classList.toggle('active', link.getAttribute('href') === `#${entry.target.id}`));
    });
  }, { rootMargin: '-30% 0px -60%', threshold: 0 });
  $$('main section[id]').forEach((sec) => sectionObserver.observe(sec));

  /* ---------- ページ内リンク：動きを減らす設定なら瞬時に ---------- */
  $$('a[href^="#"]').forEach((a) => {
    a.addEventListener('click', (e) => {
      const id = a.getAttribute('href');
      const target = id.length > 1 && $(id);
      if (!target) return;
      e.preventDefault();
      target.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth' });
      history.replaceState(null, '', id);
    });
  });

  /* ---------- 申し込みフォーム ---------- */
  const FORM_URL = 'https://docs.google.com/forms/d/e/1FAIpQLSePT_gj_bpiwcuTNaAqzemLpXpA3rkp4QWMYu-Povbt7UjYrQ/viewform?usp=publish-editor';
  $$('.form-link').forEach((link) => {
    if (FORM_URL) { link.href = FORM_URL; return; }
    link.removeAttribute('target');
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const msg = $('.form-pending');
      if (msg) { msg.hidden = false; msg.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center' }); }
    });
  });

  /* ---------- 起動 ---------- */
  const applyMotionSetting = () => {
    if (reduceMotion) {
      revealEls.forEach((el) => el.classList.add('is-in'));
      hero?.style.setProperty('--hp', 0);
      ready();
    } else {
      revealEls.forEach((el) => { if (!el.classList.contains('is-in')) revealObserver.observe(el); });
    }
  };
  motionQuery.addEventListener?.('change', (e) => { reduceMotion = e.matches; applyMotionSetting(); requestTick(true); });
  applyMotionSetting();

  window.addEventListener('scroll', () => requestTick(), { passive: true });
  window.addEventListener('resize', () => { measureDots(); measure(); }, { passive: true });
  // 写真やフォントの読み込みで高さが変わったら測り直す
  if ('ResizeObserver' in window) {
    let roTimer;
    new ResizeObserver(() => { clearTimeout(roTimer); roTimer = setTimeout(() => { measureDots(); measure(); }, 100); }).observe(document.body);
  }
  measureDots();
  measure();
})();
