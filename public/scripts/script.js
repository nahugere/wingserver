(function () {
  'use strict';

  var prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var hero = document.getElementById('hero');
  if (hero) {
    var canvas = document.createElement('canvas');
    canvas.className = 'ascii-bg';
    canvas.setAttribute('aria-hidden', 'true');
    hero.insertBefore(canvas, hero.firstChild);

    var ctx = canvas.getContext('2d');
    var CHARS = '@%#*+=-:. ';
    var CHAR_LEN = CHARS.length - 1;
    var MONO = "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
    var FONT_SIZE = 14;
    var CHAR_W = FONT_SIZE * 0.62;
    var cols = 0;
    var rows = 0;
    var cssW = 0;
    var cssH = 0;
    var mouseX = -10000;
    var mouseY = -10000;

    var RIPPLE_DURATION = 1100;
    var ripples = [];

    var STYLE_BUCKETS = 12;
    var styleCache = [];
    for (var si = 0; si <= STYLE_BUCKETS; si++) {
      var alpha = (0.22 + (si / STYLE_BUCKETS) * 0.78).toFixed(3);
      styleCache.push('rgba(245, 245, 245, ' + alpha + ')');
    }

    function resize() {
      var dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      cssW = hero.clientWidth;
      cssH = hero.clientHeight;
      canvas.width = Math.max(1, Math.round(cssW * dpr));
      canvas.height = Math.max(1, Math.round(cssH * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      cols = Math.ceil(cssW / CHAR_W);
      rows = Math.ceil(cssH / FONT_SIZE);
      ctx.font = FONT_SIZE + 'px ' + MONO;
      ctx.textBaseline = 'top';
    }

    function hash3(px, py, pz) {
      var n = (px * 374761393 + py * 668265263 + pz * 2147483647) | 0;
      n = (n ^ (n >> 13)) | 0;
      n = (n * 1274126177) | 0;
      n = (n ^ (n >> 16)) | 0;
      return (n & 0x7fffffff) / 0x7fffffff;
    }

    function fade(t) {
      return t * t * (3 - 2 * t);
    }

    function valueNoise2(px, py) {
      var xi = px | 0;
      var yi = py | 0;
      var xf = px - xi;
      var yf = py - yi;
      var u = fade(xf);
      var v = fade(yf);
      var c00 = hash3(xi, yi, 0);
      var c10 = hash3(xi + 1, yi, 0);
      var c01 = hash3(xi, yi + 1, 0);
      var c11 = hash3(xi + 1, yi + 1, 0);
      var x0 = c00 + u * (c10 - c00);
      var x1 = c01 + u * (c11 - c01);
      return x0 + v * (x1 - x0);
    }

    function rippleAt(now, x, y) {
      var total = 0;
      for (var i = 0; i < ripples.length; i++) {
        var rp = ripples[i];
        var age = now - rp.t0;
        if (age > RIPPLE_DURATION) {
          ripples.splice(i, 1);
          i--;
          continue;
        }
        var progress = age / RIPPLE_DURATION;
        var eased = 1 - (1 - progress) * (1 - progress);
        var dx = x - rp.x;
        var dy = y - rp.y;
        var dist = Math.sqrt(dx * dx + dy * dy);
        var ringDist = Math.abs(dist - rp.radius * eased);
        var ringWidth = rp.ringWidth * (1 - progress * 0.6);
        total += Math.exp(-(ringDist * ringDist) / (ringWidth * ringWidth)) * (1 - progress);
      }
      return total;
    }

    function renderNoise(now) {
      ctx.clearRect(0, 0, cssW, cssH);
      var t = now / 1000;
      for (var r = 0; r < rows; r++) {
        var y = r * FONT_SIZE;
        for (var c = 0; c < cols; c++) {
          var x = c * CHAR_W;
          var n1 = valueNoise2(x * 0.007 + t * 0.16, y * 0.007);
          var n2 = valueNoise2(x * 0.021 + t * 0.11 + 31.4, y * 0.021 + 7.7);
          var v = n1 * 0.62 + n2 * 0.38;
          v += rippleAt(now, x, y);
          var dx = x - mouseX;
          var dy = y - mouseY;
          var dist = Math.sqrt(dx * dx + dy * dy);
          if (dist > 0) {
            v += Math.sin(dist * 0.045 - t * 3) * Math.exp(-dist / 120) * 0.5;
          }
          if (v < 0) { v = 0; } else if (v > 1) { v = 1; }
          var ch = CHARS[(v * CHAR_LEN) | 0];
          if (ch !== ' ') {
            ctx.fillStyle = styleCache[(Math.abs(v - 0.5) * 2 * STYLE_BUCKETS) | 0];
            ctx.fillText(ch, x, y);
          }
        }
      }
    }

    function frame(now) {
      renderNoise(now);
      if (!prefersReducedMotion) {
        requestAnimationFrame(frame);
      }
    }

    function onMouse(e) {
      var rect = hero.getBoundingClientRect();
      mouseX = e.clientX - rect.left;
      mouseY = e.clientY - rect.top;
    }

    function onLeave() {
      mouseX = -10000;
      mouseY = -10000;
    }

    function onClick(e) {
      var rect = hero.getBoundingClientRect();
      if (ripples.length >= 8) {
        ripples.shift();
      }
      ripples.push({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
        t0: performance.now(),
        radius: 150 + Math.random() * 220,
        ringWidth: 70
      });
    }

    resize();
    window.addEventListener('resize', resize);
    hero.addEventListener('mousemove', onMouse);
    hero.addEventListener('mouseleave', onLeave);
    hero.addEventListener('click', onClick);
    requestAnimationFrame(frame);
  }

  var copyBtn = document.querySelector('.copy-btn');
  if (copyBtn) {
    var commandBox = copyBtn.closest('.command-box');
    var command = commandBox ? commandBox.querySelector('code').textContent.trim() : '';

    function flashSuccess() {
      copyBtn.classList.add('copied');
      copyBtn.setAttribute('aria-label', 'Copied');
      setTimeout(function () {
        copyBtn.classList.remove('copied');
        copyBtn.setAttribute('aria-label', 'Copy command');
      }, 1500);
    }

    function fallbackCopy(text) {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.top = '0';
      ta.style.left = '0';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      try {
        if (document.execCommand('copy')) {
          flashSuccess();
        }
      } catch (err) {
        /* noop */
      }
      document.body.removeChild(ta);
    }

    function doCopy() {
      if (command === '') {
        return;
      }
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(command).then(flashSuccess).catch(function () {
          fallbackCopy(command);
        });
      } else {
        fallbackCopy(command);
      }
    }

    copyBtn.addEventListener('click', doCopy);
    copyBtn.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        doCopy();
      }
    });
  }

  var navbar = document.querySelector('.navbar');

  function updateNavbar() {
    if (window.scrollY > 10) {
      navbar.classList.add('scrolled');
    } else {
      navbar.classList.remove('scrolled');
    }
  }

  window.addEventListener('scroll', updateNavbar, { passive: true });
  updateNavbar();

  /* ------------------------------------------------------------
     Smooth scrolling for anchor links (accounts for fixed navbar)
     ------------------------------------------------------------ */
  var navHeight = navbar ? navbar.offsetHeight : 72;
  var links = document.querySelectorAll('a[href^="#"]');

  Array.prototype.forEach.call(links, function (link) {
    link.addEventListener('click', function (e) {
      var id = link.getAttribute('href');
      if (id.length < 2) {
        return;
      }
      var target = document.querySelector(id);
      if (!target) {
        return;
      }
      e.preventDefault();
      var top = target.getBoundingClientRect().top + window.pageYOffset - navHeight - 16;
      window.scrollTo({
        top: Math.max(top, 0),
        behavior: prefersReducedMotion ? 'auto' : 'smooth'
      });
    });
  });

  /* ------------------------------------------------------------
     Entrance animation — reveal content after hero bg starts
     ------------------------------------------------------------ */
  var heroRevealEls = [
    navbar,
    document.querySelector('.hero-grid'),
    document.querySelector('.scroll-indicator')
  ];

  function revealHero() {
    for (var i = 0; i < heroRevealEls.length; i++) {
      if (heroRevealEls[i]) {
        heroRevealEls[i].classList.add('revealed');
      }
    }
  }

  if (prefersReducedMotion) {
    revealHero();
  } else {
    setTimeout(revealHero, 150);
  }

  /* Scroll-triggered reveal for below-fold sections */
  var scrollRevealEls = document.querySelectorAll('.how, .footer');
  if ('IntersectionObserver' in window && !prefersReducedMotion) {
    var revealObserver = new IntersectionObserver(function (entries) {
      for (var i = 0; i < entries.length; i++) {
        if (entries[i].isIntersecting) {
          entries[i].target.classList.add('revealed');
          revealObserver.unobserve(entries[i].target);
        }
      }
    }, { threshold: 0.12 });
    for (var ri = 0; ri < scrollRevealEls.length; ri++) {
      revealObserver.observe(scrollRevealEls[ri]);
    }
  } else {
    for (var si = 0; si < scrollRevealEls.length; si++) {
      scrollRevealEls[si].classList.add('revealed');
    }
  }
})();
