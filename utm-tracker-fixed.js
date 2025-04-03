/**
 * UTM & User Interaction Tracker Plugin (Autonomous + LocalStorage Fallback)
 * Tracks UTM parameters, page views, and interactions. Auto-consent enabled.
 */

(function (window, document) {
  const CONFIG = {
    cookieExpirationDays: 90,
    apiEndpoint: '',
    googleSheetsWebhook: '',
    consentCookieName: 'tracking_consent',
    reportGeneration: 'auto',
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
    document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Lax`;
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
    const cookieConsent = getCookie(CONFIG.consentCookieName);
    return cookieConsent === 'true' || !!getStoredUTMData();
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

  function attachClickListeners() {
    document.querySelectorAll('button, a, input[type="submit"]').forEach((el) => {
      if (
        el.innerText?.match(/sign\s?up|submit|buy|book|download|get/i) ||
        el.value?.match(/sign\s?up|submit|buy|book|download|get/i)
      ) {
        el.addEventListener('click', (e) => {
          logEvent('button_click', {
            elementText: e.target.innerText || e.target.value,
            elementId: e.target.id || null,
          });
        });
      }
    });
  }

  function attachFormListeners() {
    document.querySelectorAll('form').forEach((form) => {
      if (form.querySelector('input[type="email"]') && !form.dataset.tracked) {
        form.dataset.tracked = 'true';
        form.addEventListener('submit', (e) => {
          try {
            const formData = new FormData(form);
            const fields = {};
            formData.forEach((value, key) => {
              fields[key] = value;
            });

            logEvent('form_submission', {
              formId: form.id || null,
              fields,
            });
          } catch (err) {
            console.error('Tracking error on form:', err);
          }
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

  function attachEventListeners() {
    attachClickListeners();
    attachFormListeners();
    watchForForms();
  }

  window.addEventListener('DOMContentLoaded', () => {
    const utmParams = getUTMParamsFromURL();
    if (Object.keys(utmParams).length) {
      storeUTMParams(utmParams);
    }

    if (!hasConsent()) return;

    logEvent('page_view');
    attachEventListeners();

    if (
      typeof window.UTMTrackerConfig === 'object' &&
      window.UTMTrackerConfig.reportGeneration === 'auto'
    ) {
      console.log('📊 Auto-generating report...');
      console.log('📈 Auto Report:', generateReport());
    }
  });

  window.UTMTracker = {
    generateReport,
    logEvent,
  };
})(window, document);
