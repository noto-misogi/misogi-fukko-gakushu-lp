const header=document.querySelector('.site-header');
const menuButton=document.querySelector('.menu-button');
const mobileMenu=document.querySelector('.mobile-menu');
const reduceMotion=window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// 読み込み時に「広がる輪」を一度だけ見せる
const finishIntro=()=>document.body.classList.add('page-ready');
if(reduceMotion)finishIntro();
else{
  window.addEventListener('load',()=>window.setTimeout(finishIntro,80),{once:true});
  window.setTimeout(finishIntro,1800);
}

const setMenu=(open)=>{
  document.body.classList.toggle('menu-open',open);
  mobileMenu.classList.toggle('open',open);
  mobileMenu.setAttribute('aria-hidden',String(!open));
  menuButton.setAttribute('aria-expanded',String(open));
  menuButton.querySelector('.sr-only').textContent=open?'メニューを閉じる':'メニューを開く';
};
menuButton.addEventListener('click',()=>setMenu(!mobileMenu.classList.contains('open')));
mobileMenu.querySelectorAll('a').forEach(link=>link.addEventListener('click',()=>setMenu(false)));
document.addEventListener('keydown',event=>{if(event.key==='Escape')setMenu(false)});
window.addEventListener('scroll',()=>header.classList.toggle('scrolled',window.scrollY>16),{passive:true});

// ファーストビューを離れるときの控えめな奥行き表現
const hero=document.querySelector('.hero');
const heroImage=document.querySelector('.hero-image');
let heroFrame;
const updateHeroMotion=()=>{
  heroFrame=null;
  if(reduceMotion||!hero)return;
  const progress=Math.min(Math.max(window.scrollY/hero.offsetHeight,0),1);
  heroImage.style.setProperty('--hero-image-x',`${progress*-28}px`);
  heroImage.style.setProperty('--hero-image-y',`${progress*34}px`);
};
window.addEventListener('scroll',()=>{
  if(!heroFrame&&window.scrollY<=hero.offsetHeight)heroFrame=requestAnimationFrame(updateHeroMotion);
},{passive:true});
updateHeroMotion();

const revealObserver=new IntersectionObserver(entries=>entries.forEach(entry=>{
  if(entry.isIntersecting){entry.target.classList.add('visible');revealObserver.unobserve(entry.target)}
}),{threshold:.12});
document.querySelectorAll('.reveal').forEach(element=>{
  if(reduceMotion)element.classList.add('visible');else revealObserver.observe(element);
});

// 見出しの輪を、画面内を進むにつれて静かに広げる
const ringHeadings=[...document.querySelectorAll('.section-heading h2,.gallery-heading h2,.overview h2,.apply h2')];
let ringFrame;
const updateHeadingRings=()=>{
  ringFrame=null;
  if(reduceMotion)return;
  ringHeadings.forEach(heading=>{
    const rect=heading.getBoundingClientRect();
    const progress=Math.min(Math.max((window.innerHeight-rect.top)/(window.innerHeight*.72),0),1);
    heading.style.setProperty('--ring-scale',(0.72+progress*.38).toFixed(3));
    if(progress>=.88)heading.classList.add('ring-expanded');
    else if(progress<.58)heading.classList.remove('ring-expanded');
  });
};
window.addEventListener('scroll',()=>{
  if(!ringFrame)ringFrame=requestAnimationFrame(updateHeadingRings);
},{passive:true});
updateHeadingRings();

// セクションの背景も、下方向へ緩やかに広げる
const waveSections=document.querySelectorAll('.overview,.story,.gallery,.program,.plans,.access');
if(reduceMotion)waveSections.forEach(section=>section.classList.add('wave-visible'));
else{
  const waveObserver=new IntersectionObserver(entries=>entries.forEach(entry=>{
    if(entry.isIntersecting){entry.target.classList.add('wave-visible');waveObserver.unobserve(entry.target)}
  }),{threshold:.08});
  waveSections.forEach(section=>waveObserver.observe(section));
}

// 当日の流れの丸は、スクロールで戻るたびに波紋を再生する
if(!reduceMotion){
  const timelineMotionObserver=new IntersectionObserver(entries=>entries.forEach(entry=>{
    entry.target.classList.toggle('timeline-animate',entry.isIntersecting);
  }),{threshold:.35});
  document.querySelectorAll('.timeline-item').forEach(item=>timelineMotionObserver.observe(item));
}

// 現在位置に合わせてナビゲーションを更新
const navLinks=[...document.querySelectorAll('.desktop-nav a,.mobile-menu a')];
const sectionObserver=new IntersectionObserver(entries=>{
  entries.forEach(entry=>{
    if(!entry.isIntersecting)return;
    navLinks.forEach(link=>link.classList.toggle('active',link.getAttribute('href')===`#${entry.target.id}`));
  });
},{rootMargin:'-30% 0px -60%',threshold:0});
document.querySelectorAll('main section[id]').forEach(section=>sectionObserver.observe(section));

// 写真スライド
const carousel=document.querySelector('.carousel');
if(carousel){
  const track=carousel.querySelector('.carousel-track');
  const viewport=carousel.querySelector('.carousel-viewport');
  const originalSlides=[...carousel.querySelectorAll('.carousel-slide')];
  const beforeSlides=originalSlides.map(slide=>slide.cloneNode(true));
  const afterSlides=originalSlides.map(slide=>slide.cloneNode(true));
  [...beforeSlides,...afterSlides].forEach(slide=>slide.setAttribute('aria-hidden','true'));
  track.prepend(...beforeSlides);
  track.append(...afterSlides);
  const slides=[...track.querySelectorAll('.carousel-slide')];
  const status=carousel.querySelector('.carousel-status span');
  const toggle=carousel.querySelector('.carousel-toggle');
  let index=0;
  let position=originalSlides.length;
  let timer;
  let paused=reduceMotion;
  let pointerStart=null;

  const slideStep=()=>{
    const gap=parseFloat(getComputedStyle(track).gap)||0;
    return slides[0].getBoundingClientRect().width+gap;
  };
  const render=(animate=true)=>{
    if(!animate)track.style.transition='none';
    const slideWidth=slides[0].getBoundingClientRect().width;
    const centerOffset=(viewport.clientWidth-slideWidth)/2;
    track.style.transform=`translate3d(${centerOffset-position*slideStep()}px,0,0)`;
    status.textContent=String(index+1).padStart(2,'0');
    slides.forEach((slide,i)=>slide.setAttribute('aria-hidden',String(i!==position)));
    if(!animate){
      // 同じ写真の複製位置へ無音で移し、巻き戻りを見せない
      track.getBoundingClientRect();
      requestAnimationFrame(()=>{track.style.transition=''});
    }
  };
  const move=(direction)=>{
    index=(index+direction+originalSlides.length)%originalSlides.length;
    position+=direction;
    render();
  };
  const stopTimer=()=>window.clearInterval(timer);
  const startTimer=()=>{
    stopTimer();
    if(!paused&&!document.hidden)timer=window.setInterval(()=>move(1),5000);
  };
  const setPaused=(value)=>{
    paused=value;
    toggle.setAttribute('aria-pressed',String(value));
    toggle.querySelector('.sr-only').textContent=value?'自動再生を開始':'自動再生を停止';
    startTimer();
  };

  carousel.querySelector('.carousel-prev').addEventListener('click',()=>{move(-1);startTimer()});
  carousel.querySelector('.carousel-next').addEventListener('click',()=>{move(1);startTimer()});
  toggle.addEventListener('click',()=>setPaused(!paused));
  carousel.addEventListener('mouseenter',stopTimer);
  carousel.addEventListener('mouseleave',startTimer);
  carousel.addEventListener('focusin',stopTimer);
  carousel.addEventListener('focusout',startTimer);
  carousel.addEventListener('pointerdown',event=>{pointerStart=event.clientX;stopTimer()});
  carousel.addEventListener('pointerup',event=>{
    if(pointerStart!==null&&Math.abs(event.clientX-pointerStart)>45)move(event.clientX<pointerStart?1:-1);
    pointerStart=null;startTimer();
  });
  carousel.addEventListener('keydown',event=>{
    if(event.key==='ArrowLeft'){move(-1);startTimer()}
    if(event.key==='ArrowRight'){move(1);startTimer()}
  });
  track.addEventListener('transitionend',event=>{
    if(event.propertyName!=='transform')return;
    if(position>=originalSlides.length*2){position-=originalSlides.length;render(false)}
    if(position<originalSlides.length){position+=originalSlides.length;render(false)}
  });
  document.addEventListener('visibilitychange',startTimer);
  window.addEventListener('resize',()=>render(false),{passive:true});
  render(false);startTimer();
}

// 外部フォームURLが決まるまで、準備中であることを明示
const FORM_URL='https://docs.google.com/forms/d/e/1FAIpQLSePT_gj_bpiwcuTNaAqzemLpXpA3rkp4QWMYu-Povbt7UjYrQ/viewform?usp=publish-editor';
document.querySelectorAll('.form-link').forEach(link=>{
  if(FORM_URL){link.href=FORM_URL;return}
  link.removeAttribute('target');
  link.addEventListener('click',event=>{
    event.preventDefault();
    const message=document.querySelector('.form-pending');
    if(message){message.hidden=false;message.scrollIntoView({behavior:reduceMotion?'auto':'smooth',block:'center'})}
    else document.querySelector('#apply')?.scrollIntoView({behavior:reduceMotion?'auto':'smooth'});
  });
});
