// ESG Officials — shared site behaviour
document.addEventListener('DOMContentLoaded', () => {

  /* ---- mobile nav toggle ---- */
  const toggle = document.querySelector('.nav-toggle');
  const links = document.querySelector('.nav-links');
  if (toggle && links) {
    toggle.addEventListener('click', () => {
      const open = links.classList.toggle('is-open');
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    links.querySelectorAll('a').forEach(a => {
      a.addEventListener('click', () => links.classList.remove('is-open'));
    });
  }

  /* ---- scroll reveal ---- */
  const revealEls = document.querySelectorAll('.reveal, .case-file');
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.15, rootMargin: '0px 0px -40px 0px' });
    revealEls.forEach(el => io.observe(el));
  } else {
    revealEls.forEach(el => el.classList.add('is-visible'));
  }

  /* ---- FAQ accordion ---- */
  document.querySelectorAll('.faq-item').forEach(item => {
    const q = item.querySelector('.faq-q');
    const a = item.querySelector('.faq-a');
    if (!q || !a) return;
    q.addEventListener('click', () => {
      const isOpen = item.classList.contains('is-open');
      item.closest('.faq-list').querySelectorAll('.faq-item').forEach(other => {
        other.classList.remove('is-open');
        other.querySelector('.faq-a').style.maxHeight = null;
      });
      if (!isOpen) {
        item.classList.add('is-open');
        a.style.maxHeight = a.scrollHeight + 'px';
      }
    });
  });

  /* ---- footer year ---- */
  document.querySelectorAll('[data-year]').forEach(el => {
    el.textContent = new Date().getFullYear();
  });

  /* ---- contact form: submits to ESG Officials backend ---- */
  const ESG_API = window.ESG_API_URL || 'http://localhost:5000/api';

  const form = document.querySelector('#consultation-form');
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const status = form.querySelector('.form-status');
      const submitBtn = form.querySelector('[type="submit"]');

      const payload = {
        name:     (form.querySelector('[name="name"]')     || form.querySelector('#name'))?.value?.trim()     || '',
        email:    (form.querySelector('[name="email"]')    || form.querySelector('#email'))?.value?.trim()    || '',
        company:  (form.querySelector('[name="company"]')  || form.querySelector('#company'))?.value?.trim()  || '',
        industry: (form.querySelector('[name="industry"]') || form.querySelector('#industry'))?.value?.trim() || '',
        message:  (form.querySelector('[name="message"]')  || form.querySelector('#message'))?.value?.trim()  || '',
      };

      if (!payload.name || !payload.email || !payload.message) {
        if (status) status.textContent = 'Please fill in your name, email, and message.';
        return;
      }

      if (status) status.textContent = 'Sending…';
      if (submitBtn) submitBtn.disabled = true;

      try {
        const res = await fetch(`${ESG_API}/contact`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (res.ok) {
          if (status) status.textContent = data.message || 'Thank you — we will be in touch soon.';
          form.reset();
        } else {
          if (status) status.textContent = data.message || 'Something went wrong. Please try again.';
        }
      } catch {
        if (status) status.textContent = 'Network error — please check your connection and try again.';
      } finally {
        if (submitBtn) submitBtn.disabled = false;
      }
    });
  }
});
