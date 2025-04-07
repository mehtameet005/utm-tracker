// UTM Tracker: Version 9 - Click Tracking Fix + Page Views + Backend Logging
console.log('🟢 UTM Tracker Script Executing...');
(function (window, document) {
  const CONFIG = {
    cookieExpirationDays: 90,
    consentCookieName: 'tracking_consent',
    reportGeneration: 'auto',
    apiEndpoint: 'http://localhost:3000/log'
  };

  const UTM_PARAMS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'];
  const STORAGE_KEY = 'utm_tracking_data';
  const REPORT_LOG_KEY = 'utm_report_log';
  const USER_ID_KEY = 'utm_user_id';

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
    UTM_PARAMS.forEach(key => {
      if (params.has(key)) result[key] = params.get(key);
    });
    return result;
  }

  function storeUTMParams(data) {
    const fullData = { ...data, firstVisit: new Date().toISOString() };
    const json = JSON.stringify(fullData);
    localStorage.setItem(STORAGE_KEY, json);
    setCookie(STORAGE_KEY, json, CONFIG.cookieExpirationDays);
    console.log('📦 Stored UTM:', fullData);
  }

  function getStoredUTMData() {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      return data ? JSON.parse(data) : null;
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
        console.warn('⚠️ Failed to parse UTM from cookie:', e);
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

    let stored = [];
    try {
      stored = JSON.parse(localStorage.getItem(REPORT_LOG_KEY)) || [];
    } catch {}
    stored.push(event);
    localStorage.setItem(REPORT_LOG_KEY, JSON.stringify(stored));

    if (CONFIG.apiEndpoint) {
      fetch(CONFIG.apiEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(event)
      }).then(() => {
        console.log('🚀 Event sent to backend:', type);
      }).catch(err => {
        console.error('❌ Backend log failed:', err);
      });
    }

    console.log(`📌 Event logged: ${type}`, event);
  }

  function generateReport() {
    let stored = [];
    try {
      stored = JSON.parse(localStorage.getItem(REPORT_LOG_KEY)) || [];
    } catch {}

    const funnel = {};
    const timeMetrics = {};
    const userJourneys = {};
    const utmSources = {};

    stored.forEach(e => {
      funnel[e.eventType] = (funnel[e.eventType] || 0) + 1;
      if (e.utm?.utm_source) {
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

  function attachClickTracker() {
    document.body.addEventListener('click', function (e) {
      const target = e.target.closest('a, button');
      if (target) {
        const label = (
          target.innerText?.trim() ||
          target.getAttribute('aria-label') ||
          target.getAttribute('title') ||
          target.id ||
          'unlabeled'
        ).slice(0, 100);
        console.log('🖱️ Click detected on:', label);
        logEvent('click', { label });
      }
    });
  }

  window.addEventListener('DOMContentLoaded', () => {
    console.log('🔥 DOMContentLoaded in UTM Tracker v9');
    document.cookie = `${CONFIG.consentCookieName}=true; path=/; max-age=31536000`;

    const utm = getUTMParamsFromURL();
    const existing = getStoredUTMData();

    console.log('🔍 URL Params:', utm);
    console.log('📦 Existing UTM:', existing);

    if (Object.keys(utm).length > 0 && !existing) {
      console.log('✅ Storing UTM from URL');
      storeUTMParams(utm);
    } else if (!existing) {
      restoreUTMFromCookie();
    }

    logEvent('page_view');
    attachClickTracker();

    if (CONFIG.reportGeneration === 'auto') {
      console.log('📊 Report:', generateReport());
    }
  });

  window.UTMTracker = {
    logEvent,
    generateReport
  };
})(window, document);
