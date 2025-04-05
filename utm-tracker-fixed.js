// UTM Tracker: Final Version v3
(function (window, document) {
  const CONFIG = {
    cookieExpirationDays: 90,
    consentCookieName: 'tracking_consent',
    reportGeneration: 'auto'
  };

  const UTM_PARAMS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'];
  const STORAGE_KEY = 'utm_tracking_data';
  const reportLog = [];

  // Utility: Cookie management
  function getCookie(name) {
    const cookies = `; ${document.cookie}`;
    const parts = cookies.split(`; ${name}=`);
    return parts.length === 2 ? decodeURIComponent(parts.pop().split(';')[0]) : null;
  }

  function setCookie(name, value, days) {
    const expires = new Date(Date.now() + days * 864e5).toUTCString();
    document.cookie = `${name}=${encodeURIComponent(value)}; path=/; expires=${expires}`;
  }

  // Utility: UTM collection
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
      console.log('📦 Stored UTM to localStorage & cookie:', fullData);
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

  // Logging
  function logEvent(type, details = {}) {
    const utm = getStoredUTMData();
    const event = {
      eventType: type,
      timestamp: new Date().toISOString(),
      utm,
      pageURL: window.location.href,
      pagePath: window.location.pathname,
      pageTitle: document.title,
      ...details
    };
    reportLog.push(event);
    console.log(`📌 Event logged: ${type}`, event);
  }

  // Reporting
  function generateReport() {
    const report = {
      totalEvents: reportLog.length,
      funnel: {},
      utmSources: {},
      clickSummary: {},
      pageViewTitles: {},
      userJourneys: []
    };

    reportLog.forEach(entry => {
      const type = entry.eventType;
      const pageTitle = entry.pageTitle || entry.pagePath;
      const src = entry.utm?.utm_source || 'unknown';

      report.funnel[type] = (report.funnel[type] || 0) + 1;
      report.utmSources[src] = (report.utmSources[src] || 0) + 1;
      if (type === 'page_view') {
        report.pageViewTitles[pageTitle] = (report.pageViewTitles[pageTitle] || 0) + 1;
      }
      if (type === 'click') {
        const key = entry.label || entry.elementText || 'unknown';
        report.clickSummary[key] = (report.clickSummary[key] || 0) + 1;
      }
      report.userJourneys.push({
        type,
        page: pageTitle,
        time: entry.timestamp
      });
    });

    return report;
  }

  // Dynamic Event Handling
  function attachClickListeners() {
    document.body.addEventListener('click', function (e) {
      const el = e.target.closest('button, a, input[type="submit"], [role="button"]');
      if (!el) return;
      const label = el.innerText || el.value || el.getAttribute('aria-label') || 'Unnamed';
      logEvent('click', {
        elementTag: el.tagName,
        elementText: label,
        elementId: el.id || null,
        elementClass: el.className || null
      });
    }, true);
  }

  // Bootstrapping
  window.addEventListener('DOMContentLoaded', () => {
    console.log('🔥 DOMContentLoaded in UTM Tracker');
    document.cookie = `${CONFIG.consentCookieName}=true; path=/; max-age=31536000`;

    const utm = getUTMParamsFromURL();
    const existing = getStoredUTMData();
    console.log('🔍 URL UTM Params:', utm);
    console.log('📦 Existing stored UTM:', existing);

    if (Object.keys(utm).length > 0 && !existing) {
      console.log('✅ UTM from URL being stored now');
      storeUTMParams(utm);
    } else if (!existing) {
      restoreUTMFromCookie();
    }

    // Track entry page view
    logEvent('page_view');

    // Track browser history navigation
    window.addEventListener('popstate', () => logEvent('page_view'));

    // Auto report
    if (CONFIG.reportGeneration === 'auto') {
      console.log('📊 UTM Report:', generateReport());
    }

    attachClickListeners();
  });

  window.UTMTracker = {
    logEvent,
    generateReport
  };
})(window, document);
