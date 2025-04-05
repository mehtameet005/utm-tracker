// UTM Tracker: v4 - With Full Page + Button Click Tracking
(function (window, document) {
  const CONFIG = {
    cookieExpirationDays: 90,
    consentCookieName: 'tracking_consent',
    reportGeneration: 'auto'
  };

  const UTM_PARAMS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'];
  const STORAGE_KEY = 'utm_tracking_data';
  const reportLog = [];

  // ------------------- UTILITY -------------------
  function getCookie(name) {
    const cookies = `; ${document.cookie}`;
    const parts = cookies.split(`; ${name}=`);
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
    const json = JSON.stringify(fullData);
    localStorage.setItem(STORAGE_KEY, json);
    setCookie(STORAGE_KEY, json, CONFIG.cookieExpirationDays);
    console.log('📦 Stored UTM to localStorage & cookie:', fullData);
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

  // ------------------- TRACKING -------------------
  function logEvent(type, details = {}) {
    const utm = getStoredUTMData();
    const event = {
      eventType: type,
      timestamp: new Date().toISOString(),
      utm,
      pageTitle: document.title,
      pageURL: window.location.href,
      ...details
    };
    reportLog.push(event);
    console.log(`📌 Event logged: ${type}`, event);
  }

  function generateReport() {
    const funnel = {};
    const clickSummary = {};
    const pageViewTitles = {};
    const userJourneys = {};

    reportLog.forEach((e) => {
      funnel[e.eventType] = (funnel[e.eventType] || 0) + 1;
      if (e.eventType === 'button_click') {
        clickSummary[e.elementText] = (clickSummary[e.elementText] || 0) + 1;
      }
      if (e.eventType === 'page_view') {
        pageViewTitles[e.pageTitle] = (pageViewTitles[e.pageTitle] || 0) + 1;
      }

      const uid = JSON.stringify(e.utm || {});
      userJourneys[uid] = userJourneys[uid] || [];
      userJourneys[uid].push({ type: e.eventType, time: e.timestamp, page: e.pageTitle });
    });

    return {
      totalEvents: reportLog.length,
      utmStored: getStoredUTMData(),
      funnel,
      clickSummary,
      pageViewTitles,
      userJourneys
    };
  }

  // ------------------- INTERACTIONS -------------------
  function attachClickTracking() {
    document.body.addEventListener('click', (e) => {
      const target = e.target.closest('a, button, input[type="submit"]');
      if (!target) return;

      const text = target.innerText || target.value || target.getAttribute('aria-label') || '[no-label]';
      logEvent('button_click', {
        elementText: text,
        elementId: target.id || null,
        tag: target.tagName
      });
    });
  }

  function trackPageNavigation() {
    let lastURL = location.href;
    new MutationObserver(() => {
      if (location.href !== lastURL) {
        lastURL = location.href;
        logEvent('page_view');
      }
    }).observe(document.body, { childList: true, subtree: true });
  }

  // ------------------- INIT -------------------
  window.addEventListener('DOMContentLoaded', () => {
    console.log('🔥 DOMContentLoaded in UTM Tracker');

    // Force Consent
    document.cookie = `${CONFIG.consentCookieName}=true; path=/; max-age=31536000`;

    const utm = getUTMParamsFromURL();
    const existing = getStoredUTMData();
    console.log('🔍 URL Params:', utm);
    console.log('📦 Existing stored UTM:', existing);

    if (Object.keys(utm).length > 0 && !existing) {
      console.log('✅ UTM from URL being stored now');
      storeUTMParams(utm);
    } else if (!existing) {
      restoreUTMFromCookie();
    }

    logEvent('page_view');

    if (CONFIG.reportGeneration === 'auto') {
      console.log('📊 UTM Report:', generateReport());
    }

    attachClickTracking();
    trackPageNavigation();
  });

  window.UTMTracker = {
    logEvent,
    generateReport
  };
})(window, document);
