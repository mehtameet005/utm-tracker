// UTM Tracker: v4 – Full Tracking (Page + Click + Report)
(function (window, document) {
  const CONFIG = {
    cookieExpirationDays: 90,
    consentCookieName: 'tracking_consent',
    reportGeneration: 'auto'
  };

  const UTM_PARAMS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'];
  const STORAGE_KEY = 'utm_tracking_data';
  const reportLog = [];

  // ----------- Utility ----------
  function getCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    return parts.length === 2 ? decodeURIComponent(parts.pop().split(';')[0]) : null;
  }

  function setCookie(name, value, days) {
    const expires = new Date(Date.now() + days * 864e5).toUTCString();
    document.cookie = `${name}=${encodeURIComponent(value)}; path=/; expires=${expires}`;
  }

  function getUTMParamsFromURL() {
    const params = new URLSearchParams(window.location.search);
    const result = {};
    UTM_PARAMS.forEach((key) => {
      if (params.has(key)) result[key] = params.get(key);
    });
    return result;
  }

  function storeUTMParams(data) {
    const fullData = { ...data, firstVisit: new Date().toISOString() };
    try {
      const json = JSON.stringify(fullData);
      localStorage.setItem(STORAGE_KEY, json);
      setCookie(STORAGE_KEY, json, CONFIG.cookieExpirationDays);
      console.log('📦 Stored UTM:', fullData);
    } catch (err) {
      console.error('❌ Failed to store UTM data:', err);
    }
  }

  function getStoredUTMData() {
    try {
      const fromLocal = localStorage.getItem(STORAGE_KEY);
      return fromLocal ? JSON.parse(fromLocal) : null;
    } catch {
      return null;
    }
  }

  function restoreUTMFromCookie() {
    const cookieVal = getCookie(STORAGE_KEY);
    if (cookieVal && !getStoredUTMData()) {
      try {
        const parsed = JSON.parse(cookieVal);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
        console.log('♻️ Restored UTM from cookie:', parsed);
      } catch (e) {
        console.warn('⚠️ Failed to restore UTM from cookie:', e);
      }
    }
  }

  function logEvent(type, details = {}) {
    const utm = getStoredUTMData();
    const event = {
      eventType: type,
      timestamp: new Date().toISOString(),
      pageURL: window.location.href,
      pageName: document.title || window.location.pathname,
      utm,
      ...details
    };
    reportLog.push(event);
    console.log(`📌 Event logged: ${type}`, event);
  }

  function generateReport() {
    return {
      totalEvents: reportLog.length,
      utmStored: getStoredUTMData(),
      funnel: reportLog.reduce((acc, e) => {
        acc[e.eventType] = (acc[e.eventType] || 0) + 1;
        return acc;
      }, {}),
      clicks: reportLog.filter(e => e.eventType.includes("click")),
      pagesVisited: reportLog.filter(e => e.eventType === "page_view").map(e => e.pageName)
    };
  }

  // -------- Click + Form Tracking --------
  function attachClickListeners() {
    document.querySelectorAll('a, button, input[type="submit"]').forEach(el => {
      const label = el.innerText || el.value || el.getAttribute('aria-label') || '';
      if (!el.dataset.tracked) {
        el.dataset.tracked = 'true';
        el.addEventListener('click', () => {
          logEvent('element_click', {
            elementText: label,
            elementType: el.tagName.toLowerCase()
          });
        });
      }
    });
  }

  // -------- SPA Navigation Tracking --------
  function patchHistoryEvents() {
    const originalPush = history.pushState;
    history.pushState = function (...args) {
      originalPush.apply(this, args);
      window.dispatchEvent(new Event('pushstate'));
      window.dispatchEvent(new Event('locationchange'));
    };
    window.addEventListener('popstate', () => window.dispatchEvent(new Event('locationchange')));
  }

  // -------- Initialization --------
  window.addEventListener('DOMContentLoaded', () => {
    console.log('🔥 DOMContentLoaded inside tracker');
    document.cookie = `${CONFIG.consentCookieName}=true; path=/; max-age=31536000`;

    const utm = getUTMParamsFromURL();
    const existing = getStoredUTMData();
    console.log('🔍 URL Params:', utm);
    console.log('📦 Existing localStorage UTM:', existing);

    if (Object.keys(utm).length > 0 && !existing) {
      console.log('✅ UTM from URL being stored now');
      storeUTMParams(utm);
    } else if (!existing) {
      restoreUTMFromCookie();
    }

    // 🔁 Always log page_view on each load
    logEvent('page_view');

    if (CONFIG.reportGeneration === 'auto') {
      console.log('📊 Report:', generateReport());
    }

    attachClickListeners();
    patchHistoryEvents();

    // Track future navigations
    window.addEventListener("locationchange", () => {
      logEvent('page_view');
      attachClickListeners(); // re-attach in case DOM changed
    });
  });

  // Export API
  window.UTMTracker = {
    logEvent,
    generateReport
  };
})(window, document);
