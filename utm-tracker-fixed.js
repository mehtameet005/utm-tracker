/**
 * UTM Tracker: Final Version
 * - Tracks UTM from URL or Referrer
 * - Stores in localStorage + cookie
 * - Tracks page views, buttons, forms
 * - Auto-reporting + developer debug logs
 */

(function (window, document) {
  const CONFIG = {
    cookieExpirationDays: 90,
    apiEndpoint: '',                // Optional: POST destination
    googleSheetsWebhook: '',        // Optional: Sheets webhook
    consentCookieName: 'tracking_consent',
    reportGeneration: 'auto'
  };

  const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'];
  const STORAGE_KEY = 'utm_tracking_data';
  const reportLog = [];

  // ------------------ Cookie Helpers ------------------

  function getCookie(name) {
    const cookies = `; ${document.cookie}`.split(`; ${name}=`);
    return cookies.length === 2 ? decodeURIComponent(cookies.pop().split(';')[0]) : null;
  }

  function setCookie(name, value, days) {
    const expires = new Date(Date.now() + days * 864e5).toUTCString();
    document.cookie = `${name}=${encodeURIComponent(value)}; path=/; expires=${expires}`;
  }

  // ------------------ UTM Extraction ------------------

  function getUTMParamsFromURL() {
    const params = new URLSearchParams(window.location.search);
    const utm = {};
    UTM_KEYS.forEach(key => {
      if (params.has(key)) utm[key] = params.get(key);
    });
    return utm;
  }

  function getReferrerSource() {
    const ref = document.referrer;
    if (!ref || ref.includes(location.hostname)) return null;
    try {
      const host = new URL(ref).hostname;
      if (host.includes('google')) return 'google';
      if (host.includes('bing')) return 'bing';
      if (host.includes('facebook')) return 'facebook';
      if (host.includes('instagram')) return 'instagram';
      if (host.includes('linkedin')) return 'linkedin';
      if (host.includes('twitter') || host.includes('t.co')) return 'twitter';
      return host;
    } catch {
      return null;
    }
  }

  function storeUTM(utmData) {
    const data = {
      ...utmData,
      firstVisit: new Date().toISOString()
    };
    const json = JSON.stringify(data);
    localStorage.setItem(STORAGE_KEY, json);
    setCookie(STORAGE_KEY, json, CONFIG.cookieExpirationDays);
    console.log('📦 UTM data stored:', data);
  }

  function getStoredUTM() {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      return data ? JSON.parse(data) : null;
    } catch (e) {
      console.warn('⚠️ Error parsing UTM data from localStorage', e);
      return null;
    }
  }

  function restoreFromCookieIfNeeded() {
    const cookieData = getCookie(STORAGE_KEY);
    if (cookieData && !getStoredUTM()) {
      try {
        localStorage.setItem(STORAGE_KEY, cookieData);
        console.log('♻️ UTM restored from cookie:', JSON.parse(cookieData));
      } catch (e) {
        console.warn('⚠️ Error restoring UTM from cookie:', e);
      }
    }
  }

  // ------------------ Consent Check ------------------

  function hasConsent() {
    return getCookie(CONFIG.consentCookieName) !== 'false';
  }

  // ------------------ Event Tracking ------------------

  function logEvent(type, details = {}) {
    if (!hasConsent()) return;

    const utm = getStoredUTM();
    const event = {
      eventType: type,
      timestamp: new Date().toISOString(),
      utm,
      pageURL: window.location.href,
      ...details
    };

    reportLog.push(event);
    console.log(`📌 Event logged: ${type}`, event);
    pushToDestinations(event);
  }

  function pushToDestinations(data) {
    if (CONFIG.apiEndpoint) {
      fetch(CONFIG.apiEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      }).catch(console.error);
    }

    if (CONFIG.googleSheetsWebhook) {
      fetch(CONFIG.googleSheetsWebhook, {
        method: 'POST',
        body: JSON.stringify(data)
      }).catch(console.error);
    }
  }

  // ------------------ Reporting ------------------

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
      const uid = JSON.stringify(entry.utm || {});

      report.utmSources[source] = (report.utmSources[source] || 0) + 1;
      report.funnel[type] = (report.funnel[type] || 0) + 1;

      if (!userStart[uid]) userStart[uid] = entry.timestamp;
      const duration = new Date(entry.timestamp) - new Date(userStart[uid]);

      report.timeMetrics[uid] = report.timeMetrics[uid] || [];
      report.timeMetrics[uid].push(duration);

      report.userJourneys[uid] = report.userJourneys[uid] || [];
      report.userJourneys[uid].push({ event: type, time: entry.timestamp });
    });

    return report;
  }

  // ------------------ DOM Interaction ------------------

  function attachClickListeners() {
    document.querySelectorAll('button, a, input[type="submit"]').forEach(el => {
      const label = el.innerText || el.value || '';
      if (/sign\s?up|submit|buy|book|download|get/i.test(label)) {
        el.addEventListener('click', () => {
          logEvent('button_click', {
            elementText: label,
            elementId: el.id || null
          });
        });
      }
    });
  }

  function attachFormListeners() {
    document.querySelectorAll('form').forEach(form => {
      if (!form.dataset.tracked && form.querySelector('input[type="email"]')) {
        form.dataset.tracked = 'true';
        form.addEventListener('submit', () => {
          const fields = {};
          new FormData(form).forEach((val, key) => (fields[key] = val));
          logEvent('form_submission', {
            formId: form.id || null,
            fields
          });
        });
      }
    });
  }

  function watchForDynamicForms() {
    new MutationObserver(attachFormListeners).observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  // ------------------ Initialization ------------------

  window.addEventListener('DOMContentLoaded', () => {
    console.log('🔥 UTM Tracker initialized');

    // ✅ Simulate consent
    document.cookie = `${CONFIG.consentCookieName}=true; path=/; max-age=31536000`;

    const utm = getUTMParamsFromURL();
    const existing = getStoredUTM();

    console.log('🔍 URL Params:', utm);
    console.log('📦 Existing localStorage UTM:', existing);

    if (Object.keys(utm).length > 0 && !existing) {
      console.log('✅ UTM from URL being stored now');
      storeUTM(utm);
    } else if (!existing) {
      const ref = getReferrerSource();
      if (ref) {
        storeUTM({
          utm_source: ref,
          utm_medium: 'referral',
          fallback: true
        });
        console.log('🔁 Fallback referrer UTM:', ref);
      } else {
        restoreFromCookieIfNeeded();
      }
    }

    // ✅ Defer event log after save
    setTimeout(() => {
      logEvent('page_view');
      if (CONFIG.reportGeneration === 'auto') {
        console.log('📊 Report:', generateReport());
      }
    }, 100);

    attachClickListeners();
    attachFormListeners();
    watchForDynamicForms();
  });

  // Public API
  window.UTMTracker = {
    logEvent,
    generateReport
  };
})(window, document);
