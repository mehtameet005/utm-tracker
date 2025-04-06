// UTM Tracker: Version 5 - Persistent Logging + User ID
(function (window, document) {
  const CONFIG = {
    cookieExpirationDays: 90,
    consentCookieName: 'tracking_consent',
    reportGeneration: 'auto'
  };

  const UTM_PARAMS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'];
  const STORAGE_KEY = 'utm_tracking_data';
  const REPORT_LOG_KEY = 'utm_report_log';
  const USER_ID_KEY = 'utm_user_id';

  // ------------------ Helpers ------------------

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

  function getUserId() {
    let id = localStorage.getItem(USER_ID_KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(USER_ID_KEY, id);
    }
    return id;
  }

  function logEvent(type, details = {}) {
    const utm = getStoredUTMData();
    const userId = getUserId();
    const event = {
      eventType: type,
      timestamp: new Date().toISOString(),
      utm,
      userId,
      pageURL: window.location.href,
      ...details
    };

    // Load + append to report log
    let stored = [];
    try {
      stored = JSON.parse(localStorage.getItem(REPORT_LOG_KEY)) || [];
    } catch (e) {
      console.warn("Couldn't parse existing log:", e);
    }

    stored.push(event);
    localStorage.setItem(REPORT_LOG_KEY, JSON.stringify(stored));
    console.log(`📌 Event logged: ${type}`, event);
  }

  function generateReport() {
    let stored = [];
    try {
      stored = JSON.parse(localStorage.getItem(REPORT_LOG_KEY)) || [];
    } catch (e) {
      console.warn("Couldn't read saved report log:", e);
    }

    const funnel = {};
    const timeMetrics = {};
    const userJourneys = {};
    const utmSources = {};

    stored.forEach(e => {
      funnel[e.eventType] = (funnel[e.eventType] || 0) + 1;
      if (e.utm && e.utm.utm_source) {
        utmSources[e.utm.utm_source] = (utmSources[e.utm.utm_source] || 0) + 1;
      }
      if (e.userId) {
        timeMetrics[e.userId] = timeMetrics[e.userId] || [];
        timeMetrics[e.userId].push(e.timestamp);

        userJourneys[e.userId] = userJourneys[e.userId] || [];
        userJourneys[e.userId].push({ event: e.eventType, url: e.pageURL, time: e.timestamp });
      }
    });

    return {
      totalEvents: stored.length,
      funnel,
      utmSources,
      timeMetrics,
      userJourneys
    };
  }

  // ------------------ Init ------------------

  window.addEventListener('DOMContentLoaded', () => {
    console.log('🔥 DOMContentLoaded in UTM Tracker v5');
    document.cookie = `${CONFIG.consentCookieName}=true; path=/; max-age=31536000`;

    const utm = getUTMParamsFromURL();
    const existing = getStoredUTMData();

    console.log('🔍 URL Params:', utm);
    console.log('📦 Existing UTM:', existing);

    if (Object.keys(utm).length > 0 && !existing) {
      console.log('✅ UTM from URL being stored now');
      storeUTMParams(utm);
    } else if (!existing) {
      restoreUTMFromCookie();
    }

    // Page view tracking
    logEvent('page_view');

    if (CONFIG.reportGeneration === 'auto') {
      console.log('📊 Report:', generateReport());
    }
  });

  // Expose API
  window.UTMTracker = {
    logEvent,
    generateReport
  };
})(window, document);
