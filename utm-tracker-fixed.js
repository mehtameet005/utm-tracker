// UTM Tracker v5: Persistent Visitor ID + Button/Page Tracking
(function (window, document) {
  const CONFIG = {
    cookieExpirationDays: 90,
    consentCookieName: 'tracking_consent',
    reportGeneration: 'auto',
    utmKey: 'utm_tracking_data',
    visitorKey: 'visitor_id',
    sessionKey: 'utm_session_log'
  };

  const UTM_PARAMS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'];
  const reportLog = restoreSessionLog();

  // ---------------- UTILITY ----------------

  function generateUUID() {
    return ([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g, c =>
      (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
    );
  }

  function getCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    return parts.length === 2 ? decodeURIComponent(parts.pop().split(';').shift()) : null;
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

  function getStoredData(key) {
    try {
      return JSON.parse(localStorage.getItem(key)) || null;
    } catch {
      return null;
    }
  }

  function setStoredData(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function restoreSessionLog() {
    try {
      return JSON.parse(sessionStorage.getItem(CONFIG.sessionKey)) || [];
    } catch {
      return [];
    }
  }

  function persistSessionLog() {
    sessionStorage.setItem(CONFIG.sessionKey, JSON.stringify(reportLog));
  }

  function getVisitorId() {
    let id = getStoredData(CONFIG.visitorKey) || getCookie(CONFIG.visitorKey);
    if (!id) {
      id = generateUUID();
      setStoredData(CONFIG.visitorKey, id);
      setCookie(CONFIG.visitorKey, id, CONFIG.cookieExpirationDays);
    }
    return id;
  }

  function getPageName() {
    return window.location.pathname;
  }

  function logEvent(type, details = {}) {
    const utm = getStoredData(CONFIG.utmKey);
    const event = {
      eventType: type,
      timestamp: new Date().toISOString(),
      visitorId: getVisitorId(),
      utm,
      pageURL: window.location.href,
      pageName: getPageName(),
      ...details
    };
    reportLog.push(event);
    persistSessionLog();
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

    const userStart = {};

    reportLog.forEach(entry => {
      const source = entry.utm?.utm_source || 'unknown';
      const type = entry.eventType;
      const uid = entry.visitorId;

      report.utmSources[source] = (report.utmSources[source] || 0) + 1;
      report.funnel[type] = (report.funnel[type] || 0) + 1;

      if (!userStart[uid]) userStart[uid] = entry.timestamp;
      const duration = new Date(entry.timestamp) - new Date(userStart[uid]);

      report.timeMetrics[uid] = report.timeMetrics[uid] || [];
      report.timeMetrics[uid].push(duration);

      report.userJourneys[uid] = report.userJourneys[uid] || [];
      report.userJourneys[uid].push({ event: type, page: entry.pageName, time: entry.timestamp });
    });

    return report;
  }

  function trackButtonsAndLinks() {
    document.querySelectorAll('a, button, input[type="submit"]').forEach(el => {
      if (el.dataset.tracked) return;
      el.dataset.tracked = 'true';
      const text = el.innerText || el.value || el.getAttribute('aria-label') || 'unknown';
      el.addEventListener('click', () => {
        logEvent('click', { elementText: text, elementTag: el.tagName });
      });
    });
  }

  function monitorDOMChanges() {
    const observer = new MutationObserver(trackButtonsAndLinks);
    observer.observe(document.body, { childList: true, subtree: true });
  }

  // ---------------- INIT ----------------

  window.addEventListener('DOMContentLoaded', () => {
    console.log('🔥 DOMContentLoaded in UTM Tracker v5');
    document.cookie = `${CONFIG.consentCookieName}=true; path=/; max-age=31536000`;

    const utm = getUTMParamsFromURL();
    const existing = getStoredData(CONFIG.utmKey);

    if (Object.keys(utm).length > 0 && !existing) {
      console.log('✅ UTM captured from URL:', utm);
      setStoredData(CONFIG.utmKey, { ...utm, firstVisit: new Date().toISOString() });
    }

    logEvent('page_view');
    trackButtonsAndLinks();
    monitorDOMChanges();

    if (CONFIG.reportGeneration === 'auto') {
      console.log('📊 UTM Report:', generateReport());
    }
  });

  window.UTMTracker = {
    logEvent,
    generateReport
  };
})(window, document);
