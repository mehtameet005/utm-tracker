(function (window, document) {
  const CONFIG = {
    cookieExpirationDays: 90,
    apiEndpoint: '', // Optional CRM endpoint
    googleSheetsWebhook: '', // Optional Google Sheets webhook
    consentCookieName: 'tracking_consent',
    reportGeneration: 'auto', // 'manual' or 'auto'
  };

  const UTM_PARAMS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'];
  const STORAGE_KEY = 'utm_tracking_data';

  function getCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    return parts.length === 2 ? decodeURIComponent(parts.pop().split(';').shift()) : null;
  }

  function setCookie(name, value, days) {
    const expires = new Date(Date.now() + days * 864e5).toUTCString();
    document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/`;
  }

  function getUTMParamsFromURL() {
    const params = new URLSearchParams(window.location.search);
    const result = {};
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
    const storedJSON = JSON.stringify(stored);
    localStorage.setItem(STORAGE_KEY, storedJSON);
    setCookie(STORAGE_KEY, storedJSON, CONFIG.cookieExpirationDays);
  }

  function getStoredUTMData() {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : null;
  }

  function hasConsent() {
    const value = getCookie(CONFIG.consentCookieName);
    return value === null || value === 'true';
  }

  function logEvent(type, details = {}) {
    if (!hasConsent()) return;

    const utm = getStoredUTMData();
    const event = {
      eventType: type,
      timestamp: new Date().toISOString(),
      utm,
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

      if (!report.funnel[entry.eventType]) {
        report.funnel[entry.eventType] = 0;
      }
      report.funnel[entry.eventType]++;

      const uid = JSON.stringify(entry.utm);
      if (!userStart[uid]) {
        userStart[uid] = entry.timestamp;
      }

      const duration = new Date(entry.timestamp) - new Date(userStart[uid]);
      if (!report.timeMetrics[uid]) {
        report.timeMetrics[uid] = [];
      }
      report.timeMetrics[uid].push(duration);

      if (!report.userJourneys[uid]) {
        report.userJourneys[uid] = [];
      }
      report.userJourneys[uid].push({ event: entry.eventType, time: entry.timestamp });
    });

    return report;
  }

  function attachClickListeners() {
    document.querySelectorAll('button, a, input[type="submit"]').forEach((el) => {
      const text = el.innerText || el.value || '';
      if (/sign\s?up|submit|buy|book|download|get/i.test(text)) {
        el.addEventListener('click', () => {
          logEvent('button_click', {
            elementText: text,
            elementId: el.id || null,
          });
        });
      }
    });
  }

  function attachFormListeners() {
    document.querySelectorAll('form').forEach((form) => {
      if (form.querySelector('input[type="email"]') && !form.dataset.tracked) {
        form.dataset.tracked = 'true';
        form.addEventListener('submit', () => {
          const formData = new FormData(form);
          const fields = {};
          formData.forEach((value, key) => (fields[key] = value));
          logEvent('form_submission', {
            formId: form.id || null,
            fields,
          });
        });
      }
    });
  }

  function watchForForms() {
    const observer = new MutationObserver(() => {
      attachFormListeners();
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  window.addEventListener('DOMContentLoaded', () => {
    // ✅ Auto consent for testing
    document.cookie = `${CONFIG.consentCookieName}=true; path=/; max-age=31536000`;

    const utmParams = getUTMParamsFromURL();

    if (Object.keys(utmParams).length > 0) {
      storeUTMParams(utmParams);
    } else {
      // ✅ Restore from cookie if localStorage is empty
      const cookieValue = getCookie(STORAGE_KEY);
      if (cookieValue && !getStoredUTMData()) {
        try {
          localStorage.setItem(STORAGE_KEY, cookieValue);
        } catch (e) {
          console.warn('⚠️ Could not restore UTM from cookie:', e);
        }
      }
    }

    attachClickListeners();
    attachFormListeners();
    watchForForms();

    logEvent('page_view');

    if (
      typeof window.UTMTrackerConfig === 'object' &&
      window.UTMTrackerConfig.reportGeneration === 'auto'
    ) {
      console.log('📊 Auto-generating report...');
      const report = generateReport();
      console.log('📈 Report:', report);
    }
  });

  // Public API
  window.UTMTracker = {
    generateReport,
    logEvent,
  };
})(window, document);
