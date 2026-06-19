/* =====================================================================
   CONSOLIDATED ROBUST INC. — SCRIPT
   =====================================================================
   This file controls:
     1. Sticky navbar (style change on scroll)
     2. Mobile hamburger menu
     3. Smooth-scroll & active link highlighting
     4. Scroll reveal animations (Intersection Observer)
     5. Animated number counters
     6. Project category tabs
     7. Contact form (static — no backend; shows confirmation message)
     8. Back-to-top button
     9. Footer year
   ===================================================================== */

(function () {
  'use strict';

  // Take over scroll restoration — prevent the browser from auto-scrolling
  // to a hash anchor or a cached scroll position before our code runs.
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';

  // Scroll restoration: restore position only when returning to the exact page
  // the position was saved from. Otherwise jump to top instantly (bypass
  // scroll-behavior: smooth which would animate the jump and look broken).
  const _savedY    = sessionStorage.getItem('cri_scrollY');
  const _savedPage = sessionStorage.getItem('cri_scrollPage');
  const _isReturn  = _savedY !== null && _savedPage === location.pathname;

  if (_isReturn) {
    sessionStorage.removeItem('cri_scrollY');
    sessionStorage.removeItem('cri_scrollPage');
    document.querySelectorAll('.reveal, .inner-card, .product-card, .inner-app').forEach(el => {
      el.classList.add('is-visible');
    });
    requestAnimationFrame(() => window.scrollTo({ top: parseInt(_savedY, 10), behavior: 'instant' }));
  } else {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }

  // -------- DOM helpers --------
  const $  = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

  // ====================================================================
  // SPLASH SCREEN
  // ====================================================================
  const splash = document.getElementById('splash');
  if (splash) {
    if (!sessionStorage.getItem('cri_splashSeen') && !_isReturn) {
      sessionStorage.setItem('cri_splashSeen', '1');

      const hideSplash = () => {
        splash.classList.add('is-done');
        splash.addEventListener('transitionend', () => splash.remove(), { once: true });
      };

      const splineIframe = document.querySelector('.spline-frame iframe');
      const startTime = Date.now();
      const MIN_MS = 2200;
      const MAX_MS = 5000;

      // iframe load event fires when spline-scene/index.html (and its viewer) are ready
      let splineLoaded = !splineIframe;
      if (splineIframe) {
        splineIframe.addEventListener('load', () => { splineLoaded = true; }, { once: true });
      }

      const checkReady = () => {
        const elapsed = Date.now() - startTime;
        if (elapsed >= MIN_MS && (splineLoaded || elapsed >= MAX_MS)) {
          hideSplash();
        } else {
          setTimeout(checkReady, 200);
        }
      };
      setTimeout(checkReady, MIN_MS);
    } else {
      // Returning visitor or back navigation — remove instantly
      splash.remove();
    }
  }

  // ====================================================================
  // 1. STICKY NAVBAR SHADOW ON SCROLL
  // ====================================================================
  const navbar = $('#navbar');
  const toTop = $('#toTop');
  const onScroll = () => {
    if (window.scrollY > 20) navbar.classList.add('is-scrolled');
    else navbar.classList.remove('is-scrolled');

    // Back-to-top visibility (element only exists on index.html)
    if (toTop) {
      if (window.scrollY > 600) toTop.classList.add('is-visible');
      else toTop.classList.remove('is-visible');
    }
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // ====================================================================
  // 2. MOBILE HAMBURGER MENU
  // ====================================================================
  const navToggle = $('#navToggle');
  const navLinks  = $('#navLinks');

  navToggle.addEventListener('click', () => {
    const isOpen = navLinks.classList.toggle('is-open');
    navToggle.classList.toggle('is-open', isOpen);
    navToggle.setAttribute('aria-expanded', String(isOpen));
  });

  // Close mobile menu after tapping a link
  $$('.nav-link').forEach(link => {
    link.addEventListener('click', () => {
      navLinks.classList.remove('is-open');
      navToggle.classList.remove('is-open');
      navToggle.setAttribute('aria-expanded', 'false');
    });
  });

  // ====================================================================
  // 3. ACTIVE NAV LINK BASED ON SCROLL POSITION
  // ====================================================================
  const sections = $$('section[id]');
  const linksMap = new Map();
  $$('.nav-link').forEach(link => {
    const href = link.getAttribute('href');
    if (href && href.startsWith('#')) linksMap.set(href.slice(1), link);
  });

  const setActiveLink = () => {
    const scrollPos = window.scrollY + 120;
    let current = '';
    sections.forEach(sec => {
      if (sec.offsetTop <= scrollPos) current = sec.id;
    });
    linksMap.forEach((link, id) => {
      link.classList.toggle('active', id === current);
    });
  };
  window.addEventListener('scroll', setActiveLink, { passive: true });
  setActiveLink();

  // ====================================================================
  // 4. SCROLL REVEAL ANIMATIONS (Intersection Observer)
  // ====================================================================
  const reveals = $$('.reveal, .inner-card, .product-card, .inner-app');
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          io.unobserve(entry.target); // animate once
        }
      });
    }, { threshold: 0.10, rootMargin: '0px 0px -30px 0px' });

    reveals.forEach(el => io.observe(el));
  } else {
    // Fallback for old browsers
    reveals.forEach(el => el.classList.add('is-visible'));
  }

  // ====================================================================
  // 5. ANIMATED NUMBER COUNTERS
  // ====================================================================
  const counters = $$('.counter');
  const startCounter = (el) => {
    const target = parseInt(el.dataset.target, 10) || 0;
    const duration = 1600; // ms
    const startTime = performance.now();

    const step = (now) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // easeOutCubic for a nice settle
      const eased = 1 - Math.pow(1 - progress, 3);
      el.textContent = Math.floor(eased * target).toLocaleString();
      if (progress < 1) requestAnimationFrame(step);
      else el.textContent = target.toLocaleString();
    };
    requestAnimationFrame(step);
  };

  if ('IntersectionObserver' in window && counters.length) {
    const counterIO = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          startCounter(entry.target);
          counterIO.unobserve(entry.target);
        }
      });
    }, { threshold: 0.5 });
    counters.forEach(c => counterIO.observe(c));
  } else {
    counters.forEach(startCounter);
  }

  // ====================================================================
  // 6. PROJECT CATEGORY TABS
  // ====================================================================
  const tabs = $$('.proj-tab');
  const panels = $$('.proj-panel');

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const target = tab.dataset.tab;

      tabs.forEach(t => t.classList.toggle('is-active', t === tab));
      panels.forEach(p => {
        p.classList.toggle('is-active', p.dataset.panel === target);
      });

      // Re-trigger reveal for newly visible items
      $$('.reveal', $(`.proj-panel[data-panel="${target}"]`)).forEach(el => {
        el.classList.add('is-visible');
      });
    });
  });

  // ====================================================================
  // 7. CONTACT FORM (static — opens user's mail client)
  // ====================================================================
  const form = $('#contactForm');
  const status = $('#formStatus');

  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const data = new FormData(form);
      const name    = (data.get('name')    || '').toString().trim();
      const email   = (data.get('email')   || '').toString().trim();
      const message = (data.get('message') || '').toString().trim();

      if (!name || !email || !message) {
        status.textContent = 'Please fill in your name, email, and a brief message.';
        status.className = 'form-status is-error';
        return;
      }

      // Validate reCAPTCHA client-side before submit
      const captchaEl = form.querySelector('.g-recaptcha');
      if (captchaEl) {
        const captchaToken = typeof grecaptcha !== 'undefined' ? grecaptcha.getResponse() : '';
        if (!captchaToken) {
          status.textContent = 'Please complete the "I am not a robot" CAPTCHA.';
          status.className = 'form-status is-error';
          return;
        }
      }

      const btn = form.querySelector('[type="submit"]');
      btn.disabled = true;
      btn.innerHTML = 'Sending… <i class="fa-solid fa-spinner fa-spin"></i>';
      status.textContent = '';
      status.className = 'form-status';

      fetch('contact.php', { method: 'POST', body: data })
        .then(r => r.json())
        .then(res => {
          if (res.ok) {
            status.textContent = res.message || "Your message has been sent. We’ll get back to you shortly!";
            status.className = 'form-status is-success';
            form.reset();
            if (typeof grecaptcha !== 'undefined') grecaptcha.reset();
          } else {
            status.textContent = res.error || 'Something went wrong. Please try again or email us at sales@crobust.com.';
            status.className = 'form-status is-error';
            if (typeof grecaptcha !== 'undefined') grecaptcha.reset();
          }
        })
        .catch(() => {
          status.textContent = 'Network error — please email us directly at sales@crobust.com.';
          status.className = 'form-status is-error';
        })
        .finally(() => {
          btn.disabled = false;
          btn.innerHTML = 'Send Message <i class="fa-solid fa-paper-plane"></i>';
        });
    });
  }

  // ====================================================================
  // 8. BACK TO TOP
  // ====================================================================
  if (toTop) {
    toTop.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  // ====================================================================
  // 9. FOOTER YEAR
  // ====================================================================
  const yearEl = $('#year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  // ====================================================================
  // 10. SAVE SCROLL POSITION BEFORE NAVIGATING TO SUB-PAGES
  // ====================================================================
  $$('a[href]').forEach(link => {
    const href = link.getAttribute('href');
    if (href && !href.startsWith('#') && !href.startsWith('mailto:') && !href.startsWith('tel:') && !/^https?:\/\//.test(href)) {
      link.addEventListener('click', () => {
        sessionStorage.setItem('cri_scrollY', String(window.scrollY));
        sessionStorage.setItem('cri_scrollPage', location.pathname);
      });
    }
  });

  // ====================================================================
  // 11. SPLINE WATERMARK
  // Handled entirely inside spline-scene/index.html via clip-path:
  //   clip-path: inset(0px 0px 60px 0px) crops the bottom 60px where
  //   the Spline watermark appears. No JS needed on the main page.
  // ====================================================================

})();
