// UTM Tracker: Final Stable Version with Backend API + UUID + Full Journey Tracking
(function (window, document) {
  const CONFIG = {
    cookieExpirationDays: 90,
    consentCookieName: 'tracking_consent',
    reportGeneration: 'auto',
    apiEndpoint: (window.UTMTrackerConfig && window.UTMTrackerConfig.apiEndpoint) || ''
  };

  const UTM_PARAMS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'];
  const STORAGE_KEY = 'utm_tracking_data';
  const UUID_KEY = 'utm_user_id';
  const reportLog = [];

  function getCookie(name) {
    const parts = `; ${document.cookie}`.split(`; ${name}=`);
    return parts.length === 2 ? decodeURIComponent(parts.pop().split(';')[0]) : null;
  }

  function setCookie(name, value, days) {
    const expires = new Date(Date.now() + days * 864e5).toUTCString();
    document.cookie = `${name}=${encodeURIComponent(value)}; path=/; expires=${expires}`;
  }

  function generateUUID() {
    return ([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g, c =>
      (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
    );
  }

  function getUserId() {
    let uid = localStorage.getItem(UUID_KEY);
    if (!uid) {
      uid = generateUUID();
      localStorage.setItem(UUID_KEY, uid);
      setCookie(UUID_KEY, uid, CONFIG.cookieExpirationDays);
    }
    return uid;
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
        localStorage.setItem(STORAGE_KEY, cookieVal);
        console.log('♻️ Restored UTM from cookie:', JSON.parse(cookieVal));
      } catch (e) {
        console.warn('⚠️ Failed to restore UTM from cookie:', e);
      }
    }
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

    if (CONFIG.apiEndpoint) {
      fetch(CONFIG.apiEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(event)
      }).then(res => {
        if (!res.ok) throw new Error('Failed to send to API');
        return res.text();
      }).then(msg => console.log('📤 Sent to backend:', msg))
        .catch(console.error);
    }
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
      const id = entry.userId;
      const source = entry.utm?.utm_source || 'unknown';
      const type = entry.eventType;

      report.utmSources[source] = (report.utmSources[source] || 0) + 1;
      report.funnel[type] = (report.funnel[type] || 0) + 1;

      userStart[id] = userStart[id] || entry.timestamp;
      const duration = new Date(entry.timestamp) - new Date(userStart[id]);

      report.timeMetrics[id] = report.timeMetrics[id] || [];
      report.timeMetrics[id].push(duration);

      report.userJourneys[id] = report.userJourneys[id] || [];
      report.userJourneys[id].push({ event: type, time: entry.timestamp, page: entry.pageURL });
    });

    return report;
  }

  function attachClickListeners() {
    document.querySelectorAll('a, button, input[type="submit"]').forEach(el => {
      const text = el.innerText || el.value || '';
      if (text.trim()) {
        el.addEventListener('click', () => {
          logEvent('button_click', {
            elementText: text,
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
          new FormData(form).forEach((v, k) => (fields[k] = v));
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
    console.log('🔥 DOMContentLoaded in UTM Tracker v4');

    document.cookie = `${CONFIG.consentCookieName}=true; path=/; max-age=31536000`;

    const utm = getUTMParamsFromURL();
    const existing = getStoredUTMData();

    if (Object.keys(utm).length > 0 && !existing) {
      console.log('✅ UTM from URL being stored now');
      storeUTMParams(utm);
    } else if (!existing) {
      const ref = getReferrerSource();
      if (ref) {
        storeUTMParams({
          utm_source: ref,
          utm_medium: 'referral',
          fallback: true
        });
        console.log('🔁 Fallback UTM from referrer:', ref);
      } else {
        restoreUTMFromCookie();
      }
    }

    // ✅ Log page view only after UTM is saved
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

  window.UTMTracker = {
    logEvent,
    generateReport
  };
})(window, document);
