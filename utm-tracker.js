/**
 * UTM & User Interaction Tracker Plugin
 * Author: Senior Full-Stack Developer & Analytics Engineer
 * Description: Captures UTM params, tracks user actions, pushes data to CRM or Google Sheets,
 *              and provides reporting functionality. GDPR/CCPA compliant.
 */

(function (window, document) {
  // CONFIGURATION OPTIONS
  const CONFIG = {
    cookieExpirationDays: 90,
    apiEndpoint: '', // e.g., 'https://your-crm-api.com/track'
    googleSheetsWebhook: '', // e.g., 'https://script.google.com/.../exec'
    consentCookieName: 'tracking_consent',
    customSelectors: {
      buttonClicks: '[data-track-click]',
      formSubmissions: 'form[data-track-form]',
    },
    reportGeneration: 'manual', // 'manual' or 'auto'
  };

  const UTM_PARAMS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'];
  const STORAGE_KEY = 'utm_tracking_data';

  function getCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    return parts.length === 2 ? parts.pop().split(';').shift() : null;
  }

  function setCookie(name, value, days) {
    const expires = new Date(Date.now() + days * 864e5).toUTCString();
    document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/`;
  }

  function getUTMParamsFromURL() {
    const params = new URLSearchParams(window.location.search);
    let result = {};
    UTM_PARAMS.forEach((key) => {
      if (params.has(key)) {
        result[key] = params.get(key);
      }
    });
    return result;
  }

  function storeUTMParams(utmData) {
    const stored = {
      ...utmData,
      firstVisit: new Date().toISOString(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
    setCookie(STORAGE_KEY, JSON.stringify(stored), CONFIG.cookieExpirationDays);
  }

  function getStoredUTMData() {
    const localData = localStorage.getItem(STORAGE_KEY);
    return localData ? JSON.parse(localData) : null;
  }

  function hasConsent() {
    return getCookie(CONFIG.consentCookieName) === 'true';
  }

  function logEvent(type, details = {}) {
    if (!hasConsent()) return;

    const event = {
      eventType: type,
      timestamp: new Date().toISOString(),
      utm: getStoredUTMData(),
      pageURL: window.location.href,
      ...details,
    };

    pushToDestinations(event);
    addToReportLog(event);
  }

  function pushToDestinations(data) {
    if (CONFIG.apiEndpoint) {
      fetch(CONFIG.apiEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }).catch(console.error);
    }
    if (CONFIG.googleSheetsWebhook) {
      fetch(CONFIG.googleSheetsWebhook, {
        method: 'POST',
        body: JSON.stringify(data),
      }).catch(console.error);
    }
  }

  const reportLog = [];

  function addToReportLog(event) {
    reportLog.push(event);
  }

  function generateReport() {
    const report = {
      totalEvents: reportLog.length,
      utmSources: {},
      funnel: {},
      timeMetrics: {},
      userJourneys: {},
    };

    const userStart = {};
    reportLog.forEach((entry) => {
      const source = entry.utm?.utm_source || 'unknown';
      report.utmSources[source] = (report.utmSources[source] || 0) + 1;

      if (!report.funnel[entry.eventType]) report.funnel[entry.eventType] = 0;
      report.funnel[entry.eventType]++;

      const uid = JSON.stringify(entry.utm);
      if (!userStart[uid]) userStart[uid] = entry.timestamp;

      const duration = new Date(entry.timestamp) - new Date(userStart[uid]);
      if (!report.timeMetrics[uid]) report.timeMetrics[uid] = [];
      report.timeMetrics[uid].push(duration);

      if (!report.userJourneys[uid]) report.userJourneys[uid] = [];
      report.userJourneys[uid].push({ event: entry.eventType, time: entry.timestamp });
    });

    return report;
  }

  function attachEventListeners() {
    document.querySelectorAll(CONFIG.customSelectors.buttonClicks).forEach((el) => {
      el.addEventListener('click', (e) => {
        logEvent('button_click', {
          elementText: e.target.innerText,
          elementId: e.target.id || null,
        });
      });
    });

    document.querySelectorAll(CONFIG.customSelectors.formSubmissions).forEach((form) => {
      form.addEventListener('submit', (e) => {
        const formData = new FormData(form);
        const fields = {};
        formData.forEach((value, key) => {
          fields[key] = value;
        });

        logEvent('form_submission', {
          formId: form.id || null,
          fields,
        });
      });
    });
  }

  // Initialization Block
  (function init() {
    if (!hasConsent()) return;

    const utmParams = getUTMParamsFromURL();
    if (Object.keys(utmParams).length && !getStoredUTMData()) {
      storeUTMParams(utmParams);
    }

    logEvent('page_view');
    attachEventListeners();
  })();

  // Expose manual report generation if needed
  window.UTMTracker = {
    generateReport,
    logEvent,
  };
})(window, document);

/**
 * INTEGRATION EXAMPLE
 * <script src="/path/to/utm-tracker.js"></script>
 * <script>
 *   // Optional override config
 *   window.UTMTrackerConfig = {
 *     cookieExpirationDays: 60,
 *     apiEndpoint: 'https://crm.example.com/api/events',
 *     googleSheetsWebhook: 'https://script.google.com/macros/s/AKfy.../exec',
 *     reportGeneration: 'manual'
 *   };
 * </script>
 */

/**
 * SAMPLE REPORT OUTPUT (JSON)
 * {
 *   totalEvents: 12,
 *   utmSources: {
 *     "google": 6,
 *     "facebook": 3
 *   },
 *   funnel: {
 *     "page_view": 6,
 *     "button_click": 3,
 *     "form_submission": 2,
 *     "purchase": 1
 *   },
 *   timeMetrics: {
 *     "{\"utm_source\":\"google\"}": [0, 1200, 2500],
 *     ...
 *   },
 *   userJourneys: {
 *     "{\"utm_source\":\"google\"}": [
 *       { "event": "page_view", "time": "2025-04-02T10:00:00Z" },
 *       { "event": "form_submission", "time": "2025-04-02T10:01:00Z" }
 *     ]
 *   }
 * }
 */
