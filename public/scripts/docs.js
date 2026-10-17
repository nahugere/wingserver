(function () {
  'use strict';

  var prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ------------------------------------------------------------
     Mobile sidebar toggle
     ------------------------------------------------------------ */
  var menuToggle = document.getElementById('docs-menu-toggle');
  var sidebar = document.getElementById('docs-sidebar');

  if (menuToggle && sidebar) {
    menuToggle.addEventListener('click', function () {
      document.body.classList.toggle('docs-sidebar-open');
    });

    sidebar.addEventListener('click', function (e) {
      if (e.target.closest('a') && document.body.classList.contains('docs-sidebar-open')) {
        document.body.classList.remove('docs-sidebar-open');
      }
    });
  }

  /* ------------------------------------------------------------
     Collapsible nav groups
     ------------------------------------------------------------ */
  var parents = document.querySelectorAll('.docs-nav-parent');
  Array.prototype.forEach.call(parents, function (btn) {
    btn.addEventListener('click', function () {
      var group = btn.closest('.docs-nav-group');
      var collapsed = group.classList.toggle('collapsed');
      btn.setAttribute('aria-expanded', String(!collapsed));
    });
  });

  /* ------------------------------------------------------------
     Search filter
     ------------------------------------------------------------ */
  var searchInput = document.getElementById('docs-search-input');
  if (searchInput) {
    searchInput.addEventListener('input', function () {
      var q = searchInput.value.trim().toLowerCase();
      var searching = q.length > 0;

      var links = document.querySelectorAll('.docs-nav-tree a.docs-nav-item');
      Array.prototype.forEach.call(links, function (link) {
        var match = !searching || link.textContent.toLowerCase().indexOf(q) !== -1;
        link.style.display = match ? '' : 'none';
      });

      var groups = document.querySelectorAll('.docs-nav-group');
      Array.prototype.forEach.call(groups, function (group) {
        var parent = group.querySelector('.docs-nav-parent');
        var children = group.querySelectorAll('.docs-nav-children .docs-nav-item');
        var anyChildVisible = false;
        Array.prototype.forEach.call(children, function (child) {
          if (child.style.display !== 'none') anyChildVisible = true;
        });
        if (searching) {
          group.classList.toggle('collapsed', !anyChildVisible);
          parent.setAttribute('aria-expanded', String(anyChildVisible));
          var parentMatch = parent.textContent.toLowerCase().indexOf(q) !== -1;
          parent.style.display = anyChildVisible || parentMatch ? '' : 'none';
        } else {
          parent.style.display = '';
        }
      });
    });
  }

  /* ------------------------------------------------------------
     Smooth scrolling for in-page anchors
     ------------------------------------------------------------ */
  var navLinks = document.querySelectorAll('.docs-nav-tree a[href^="#"]');
  Array.prototype.forEach.call(navLinks, function (link) {
    link.addEventListener('click', function (e) {
      var id = link.getAttribute('href');
      var target = document.querySelector(id);
      if (!target) return;
      e.preventDefault();
      var top = target.getBoundingClientRect().top + window.pageYOffset - 88;
      window.scrollTo({
        top: Math.max(top, 0),
        behavior: prefersReducedMotion ? 'auto' : 'smooth'
      });
      history.replaceState(null, '', id);
    });
  });

  /* ------------------------------------------------------------
     Scroll-spy
     ------------------------------------------------------------ */
  var sections = document.querySelectorAll('.docs-content section');

  function setActive(id) {
    Array.prototype.forEach.call(navLinks, function (link) {
      var isActive = link.getAttribute('href') === '#' + id;
      link.classList.toggle('active', isActive);
      if (isActive) {
        var group = link.closest('.docs-nav-group');
        if (group) {
          group.classList.remove('collapsed');
          var parent = group.querySelector('.docs-nav-parent');
          if (parent) parent.setAttribute('aria-expanded', 'true');
        }
      }
    });
  }

  function onScroll() {
    var fromTop = window.scrollY + 140;
    var current = sections[0];
    Array.prototype.forEach.call(sections, function (section) {
      if (section.offsetTop <= fromTop) current = section;
    });
    if (!current) return;

    setActive(current.id);
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* ------------------------------------------------------------
     Copy buttons on code blocks
     ------------------------------------------------------------ */
  function flashCopied(btn) {
    btn.classList.add('copied');
    btn.setAttribute('aria-label', 'Copied');
    setTimeout(function () {
      btn.classList.remove('copied');
      btn.setAttribute('aria-label', 'Copy code');
    }, 1500);
  }

  function fallbackCopy(text, btn) {
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
      if (document.execCommand('copy')) flashCopied(btn);
    } catch (err) {
      /* noop */
    }
    document.body.removeChild(ta);
  }

  var copyBtns = document.querySelectorAll('.code-block .copy-btn');
  Array.prototype.forEach.call(copyBtns, function (btn) {
    btn.addEventListener('click', function () {
      var code = btn.closest('.code-block').querySelector('code');
      var text = code.textContent.replace(/^\$\s/, '');
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(function () {
          flashCopied(btn);
        }).catch(function () {
          fallbackCopy(text, btn);
        });
      } else {
        fallbackCopy(text, btn);
      }
    });
  });
})();
