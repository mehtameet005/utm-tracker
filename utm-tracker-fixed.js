// UTM Tracker: Final Stable Version (jsv4) with Cross-Page & Button Click Tracking
(function (window, document) {
  const CONFIG = {
    cookieExpirationDays: 90,
    consentCookieName: 'tracking_consent',
    reportGeneration: 'auto'
  };

  const UTM_PARAMS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'];
  const STORAGE_KEY = 'utm_tracking_data';
  const USER_ID_KEY = 'user_id';
  const reportLog = [];

  function getCookie(name) {
    const cookies = `; ${document.cookie}`;
    const parts = cookies.split(`; ${name}=`);
    return parts.length === 2 ? decodeURIComponent(parts.pop().split(';')[0]) : null;
  }

  function setCookie(name, value, days) {
    const expires = new Date(Date.now() + days * 864e5).toUTCString();
    document.cookie = `${name}=${encodeURIComponent(value)}; path=/; expires=${expires}`;
  }

  function getUserId() {
    const existing = localStorage.getItem(USER_ID_KEY);
    if (existing) return existing;
    const id = crypto.randomUUID();
    localStorage.setItem(USER_ID_KEY, id);
    return id;
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
    reportLog.push(event);
    console.log(`📌 Event logged: ${type}`, event);
  }

  function generateReport() {
    const report = {
      totalEvents: reportLog.length,
      utmSources: {},
      funnel: {},
      timeMetrics: {},
      userJourneys: {}
    };

    const startTime = {};

    reportLog.forEach(entry => {
      const src = entry.utm?.utm_source || 'unknown';
      const type = entry.eventType;
      const uid = entry.userId || 'unknown';

      report.utmSources[src] = (report.utmSources[src] || 0) + 1;
      report.funnel[type] = (report.funnel[type] || 0) + 1;

      if (!startTime[uid]) startTime[uid] = new Date(entry.timestamp);
      const duration = new Date(entry.timestamp) - startTime[uid];
      report.timeMetrics[uid] = report.timeMetrics[uid] || [];
      report.timeMetrics[uid].push(duration);

      report.userJourneys[uid] = report.userJourneys[uid] || [];
      report.userJourneys[uid].push({ event: type, time: entry.timestamp, page: entry.pageURL });
    });

    return report;
  }

  function appendUserIdToLinks(userId) {
    document.querySelectorAll('a[href^="/"], a[href^="https://www.briteorthodontics.com"]').forEach(link => {
      const url = new URL(link.href);
      url.searchParams.set("uid", userId);
      link.href = url.toString();
    });
  }

  function bindButtonClickTracking() {
    document.querySelectorAll('button, a, input[type="submit"]').forEach(el => {
      const label = el.innerText || el.value || el.getAttribute('aria-label') || 'unknown';
      el.addEventListener('click', () => {
        logEvent("button_click", {
          label,
          elementId: el.id || null
        });
      });
    });
  }

  window.addEventListener('DOMContentLoaded', () => {
    console.log('🔥 DOMContentLoaded in UTM Tracker v4');
    document.cookie = `${CONFIG.consentCookieName}=true; path=/; max-age=31536000`;

    const utm = getUTMParamsFromURL();
    const existing = getStoredUTMData();

    if (Object.keys(utm).length > 0 && !existing) {
      console.log('✅ UTM from URL being stored now');
      storeUTMParams(utm);
    } else if (!existing) {
      restoreUTMFromCookie();
    }

    const userId = getUserId();
    appendUserIdToLinks(userId);
    bindButtonClickTracking();
    logEvent('page_view');

    if (CONFIG.reportGeneration === 'auto') {
      console.log('📊 Report:', generateReport());
    }
  });

  window.UTMTracker = {
    logEvent,
    generateReport
  };
})(window, document);
