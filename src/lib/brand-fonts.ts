export const brandFontStylesheetHref = '/assets/fonts/faces.css';

export function scheduleBrandFonts() {
  const scheduleIdle = () => {
    if (typeof requestIdleCallback === 'function') {
      requestIdleCallback(appendBrandFontStylesheet, { timeout: 2000 });
      return;
    }

    setTimeout(appendBrandFontStylesheet, 1);
  };

  if (document.readyState === 'complete') {
    scheduleIdle();
    return;
  }

  window.addEventListener('load', scheduleIdle, { once: true });
}

function appendBrandFontStylesheet() {
  if (document.querySelector(`link[href="${brandFontStylesheetHref}"]`)) {
    return;
  }

  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = brandFontStylesheetHref;
  document.head.appendChild(link);
}
