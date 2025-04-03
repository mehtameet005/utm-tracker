<!-- UTM Tracker Config + Script (Auto Consent & Persistence Fixes) -->
<script>
(function (window, document) {
  const CONFIG = {
    cookieExpirationDays: 90,
    apiEndpoint: '', // Optional CRM POST endpoint
    googleSheetsWebhook: '', // Optional webhook for Google Sheets
    consentCookieName: 'tracking_consent',
    reportGeneration: 'auto', // 'manual' or 'auto'
  };

  const UTM_PARAMS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'];
  const STORAGE_KEY = 'utm_tracking_data';

  // Cookie utilities
  function getCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    return parts.length === 2 ? decodeURIComponent(parts.pop().split(';').shift()) : null;
  }

  function setCookie(name, value, days) {
    const expires = new Date(Date.now() + days * 864e5).toUTCString();
    document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/`;
  }

  // UTM functions
  function getUTMParamsFromURL() {
    const params = new URLSearchParams(window.location.search);
    const result = {};
    UTM_PARAMS.forEach((key) => {
      if (params.has(key)) result[key] = params.get(key);
    });
    return result;
  }

  function storeUTMParams(utmData) {
    const data = {
      ...utmData,
      firstVisit: new Date().toISOString(),
    };
    const json = JSON.stringify(data);
    localStorage.setItem(STORAGE_KEY, json);
    setCookie(STORAGE_KEY, json, CONFIG.cookieExpirationDays);
  }

  function getStoredUTMData() {
    const fromLocal = localStorage.getItem(STORAGE_KEY);
    return fromLocal ? JSON.parse(fromLocal) : null;
  }

  function restoreUTMFromCookie() {
    const fromCookie = getCookie(STORAGE_KEY);
    if (fromCookie && !getStoredUTMData()) {
      try {
        localStorage.setItem(STORAGE_KEY, fromCookie);
      } catch (e) {
        console.warn('⚠️ UTM cookie restore failed:', e);
      }
    }
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
    reportLog.push(event);
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

  // Reporting system
  const reportLog = [];

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

      report.funnel[entry.eventType] = (report.funnel[entry.eventType] || 0) + 1;

      const uid = JSON.stringify(entry.utm || {});
      userStart[uid] = userStart[uid] || entry.timestamp;

      const duration = new Date(entry.timestamp) - new Date(userStart[uid]);
      report.timeMetrics[uid] = report.timeMetrics[uid] || [];
      report.timeMetrics[uid].push(duration);

      report.userJourneys[uid] = report.userJourneys[uid] || [];
      report.userJourneys[uid].push({ event: entry.eventType, time: entry.timestamp });
    });

    return report;
  }

  // Event bindings
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
          const fields = {};
          new FormData(form).forEach((v, k) => (fields[k] = v));
          logEvent('form_submission', { formId: form.id || null, fields });
        });
      }
    });
  }

  function watchForForms() {
    new MutationObserver(attachFormListeners).observe(document.body, {
      childList: true,
      subtree: true,
    });
  }

  // Initialization
  window.addEventListener('DOMContentLoaded', () => {
    // ✅ Simulate consent for testing mode
    document.cookie = `${CONFIG.consentCookieName}=true; path=/; max-age=31536000`;

    const utmParams = getUTMParamsFromURL();
    const alreadyStored = getStoredUTMData();

    if (Object.keys(utmParams).length > 0 && !alreadyStored) {
      storeUTMParams(utmParams);
    } else {
      restoreUTMFromCookie();
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
      console.log('📈 Report:', generateReport());
    }
  });

  // Public interface
  window.UTMTracker = {
    generateReport,
    logEvent,
  };
})(window, document);
</script>
