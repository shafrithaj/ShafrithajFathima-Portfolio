/* ============================================================
   SHAFRITHAJ FATHIMA — PORTFOLIO SCRIPTS
   ============================================================ */

document.addEventListener('DOMContentLoaded', () => {

  /* ===== SCROLL REVEAL ===== */
  const revealEls = document.querySelectorAll('.reveal');
  const io = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.classList.add('on');
        io.unobserve(e.target);
      }
    });
  }, { threshold: 0.07 });
  revealEls.forEach(el => io.observe(el));

  /* ===== NAV SCROLL EFFECT ===== */
  const nav = document.querySelector('nav');
  window.addEventListener('scroll', () => {
    if (window.scrollY > 60) {
      nav.style.borderBottomColor = 'rgba(201,169,110,0.22)';
    } else {
      nav.style.borderBottomColor = 'rgba(201,169,110,0.25)';
    }
  });

  /* ===== SMOOTH NAV LINK ACTIVE STATE ===== */
  const sections = document.querySelectorAll('section[id], div[id]');
  const navLinks = document.querySelectorAll('.nav-links a');
  const onScroll = () => {
    let cur = '';
    sections.forEach(s => {
      if (window.scrollY >= s.offsetTop - 120) cur = s.id;
    });
    navLinks.forEach(a => {
      const href = a.getAttribute('href');
      a.style.color = href === '#' + cur ? 'var(--gold)' : '';
    });
  };
  window.addEventListener('scroll', onScroll, { passive: true });

});
