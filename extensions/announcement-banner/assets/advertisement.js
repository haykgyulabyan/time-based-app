(function() {
  'use strict';

  const APP_PROXY_PATH = '/apps/time-based/advertisements';

  // Size dimensions for reference
  const SIZES = {
    '1x1': { width: 350, height: 525 },
    '2x1': { width: 716, height: 525 },
    '3x1': { width: 1078, height: 525 },
    '4x1': { width: 1434, height: 525 }
  };

  // Cache for fetched ads (in-memory, session-based)
  const adCache = new Map();

  /**
   * Initialize all advertisement blocks on the page
   * Uses batch fetching for performance
   */
  async function init() {
    const adContainers = document.querySelectorAll('.time-based-advertisement[data-ad-id]');

    // Collect containers that need fetching
    const containersToFetch = [];
    const adIds = new Set();
    let shop = null;

    adContainers.forEach(container => {
      const adId = container.dataset.adId;

      // Skip if no ad ID specified (show selector UI)
      if (!adId || adId.trim() === '') {
        return;
      }

      // Check if already rendered
      if (container.dataset.rendered === 'true') {
        return;
      }

      // Check cache first
      if (adCache.has(adId)) {
        const cachedAd = adCache.get(adId);
        processAdForContainer(container, cachedAd, adId);
        return;
      }

      containersToFetch.push({ container, adId });
      adIds.add(adId);
      shop = shop || container.dataset.shop;
    });

    // If no ads to fetch, we're done
    if (adIds.size === 0 || !shop) {
      return;
    }

    // Batch fetch all ads in one request
    try {
      const idsParam = Array.from(adIds).join(',');
      const response = await fetch(`${APP_PROXY_PATH}?ids=${idsParam}&shop=${shop}`);

      if (!response.ok) {
        console.error('Time-based App: Failed to load advertisements', response.status);
        containersToFetch.forEach(({ container, adId }) => {
          showError(container, adId, 'Advertisement not found');
        });
        return;
      }

      const data = await response.json();
      const adsMap = data.advertisements || {};

      // Cache and render each ad
      Object.entries(adsMap).forEach(([id, ad]) => {
        adCache.set(id, ad);
      });

      // Process each container with its ad
      containersToFetch.forEach(({ container, adId }) => {
        const ad = adsMap[adId];
        processAdForContainer(container, ad, adId);
      });

    } catch (error) {
      console.error('Time-based App: Error loading advertisements', error);
      containersToFetch.forEach(({ container, adId }) => {
        showError(container, adId, 'Failed to load advertisement');
      });
    }
  }

  /**
   * Process a single ad for a container (render or show error)
   */
  function processAdForContainer(container, ad, adId) {
    if (!ad) {
      showError(container, adId, 'Advertisement not found');
      return;
    }

    // Check if ad is active (status + schedule)
    if (!isAdActive(ad)) {
      // In theme editor, show preview anyway but indicate it's inactive
      if (isThemeEditor()) {
        renderAdvertisement(container, ad, true);
      } else {
        hideContainer(container);
      }
      return;
    }

    // Render the advertisement
    renderAdvertisement(container, ad, false);
    container.dataset.rendered = 'true';
  }

  /**
   * Check if we're in the Shopify theme editor
   */
  function isThemeEditor() {
    return window.Shopify && window.Shopify.designMode;
  }

  /**
   * Check if advertisement is active based on status and schedule
   */
  function isAdActive(ad) {
    // Check status
    if (!ad.status) {
      return false;
    }

    // Check schedule if enabled
    if (!ad.schedulingEnabled) {
      return true;
    }

    const now = Date.now();
    const start = ad.startDate ? new Date(ad.startDate).getTime() : null;
    const end = ad.endDate ? new Date(ad.endDate).getTime() : null;

    if (start && now < start) {
      return false;
    }

    if (end && now > end) {
      return false;
    }

    return true;
  }

  /**
   * Show error message
   */
  function showError(container, adId, message) {
    container.innerHTML = `
      <div class="time-based-ad-error">
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="10" cy="10" r="9" stroke="#dc2626" stroke-width="2"/>
          <line x1="10" y1="6" x2="10" y2="11" stroke="#dc2626" stroke-width="2" stroke-linecap="round"/>
          <circle cx="10" cy="14" r="1" fill="#dc2626"/>
        </svg>
        <div>
          <strong>Error loading ad #${adId}</strong>
          <p>${message}</p>
        </div>
      </div>
    `;
  }

  /**
   * Render advertisement content
   */
  function renderAdvertisement(container, ad, isInactive) {
    const isMobile = window.innerWidth < 768;
    const image = isMobile ? (ad.mobileImage || ad.desktopImage) : ad.desktopImage;

    // If no image, show error
    if (!image || !image.url) {
      showError(container, ad.id, 'No image configured for this advertisement');
      return;
    }

    const size = SIZES[ad.size] || SIZES['1x1'];

    // Clear existing content
    container.innerHTML = '';

    // Add size class
    container.className = `time-based-advertisement time-based-advertisement--${ad.size}`;
    container.style.maxWidth = `${size.width}px`;

    // In theme editor, show ad info header
    if (isThemeEditor()) {
      const infoHeader = document.createElement('div');
      infoHeader.className = 'time-based-ad-info-header';
      infoHeader.innerHTML = `
        <div class="time-based-ad-info-header__content">
          <strong>${ad.name}</strong>
          <span class="time-based-ad-info-header__badge ${isInactive ? 'time-based-ad-info-header__badge--inactive' : ''}">
            ${isInactive ? 'Inactive' : ad.size}
          </span>
        </div>
        ${isInactive ? '<p class="time-based-ad-info-header__warning">This ad is currently inactive and won\'t show on the live site.</p>' : ''}
      `;
      container.appendChild(infoHeader);
    }

    // Create wrapper for image and button
    const wrapper = document.createElement('div');
    wrapper.className = 'time-based-advertisement__wrapper';

    // Create image element
    const img = document.createElement('img');
    img.src = image.url;
    img.alt = image.alt || ad.name || 'Advertisement';
    img.className = 'time-based-advertisement__image';
    img.loading = 'lazy';

    // Add inactive overlay in theme editor
    if (isInactive && isThemeEditor()) {
      img.style.opacity = '0.5';
    }

    wrapper.appendChild(img);

    // Create button if enabled
    if (ad.buttonEnabled && ad.buttonText && ad.buttonLinkUrl) {
      const button = document.createElement('a');
      button.className = 'time-based-advertisement__button';
      button.textContent = ad.buttonText;
      button.href = ad.buttonLinkUrl;
      button.style.backgroundColor = ad.buttonBgColor || '#2e7d32';
      button.style.color = ad.buttonTextColor || '#ffffff';
      button.style.fontSize = ad.buttonTextSize || '16px';
      button.dataset.placement = ad.buttonPlacement || 'center';

      wrapper.appendChild(button);
    }

    container.appendChild(wrapper);
  }

  /**
   * Hide container when ad cannot be displayed
   */
  function hideContainer(container) {
    container.style.display = 'none';
  }

  /**
   * Handle window resize for responsive behavior
   * Uses cached data - no network request needed
   */
  let resizeTimeout;
  let lastWidth = window.innerWidth;

  function handleResize() {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
      // Only re-render if crossing mobile/desktop threshold
      const currentWidth = window.innerWidth;
      const wasMobile = lastWidth < 768;
      const isMobile = currentWidth < 768;

      if (wasMobile === isMobile) {
        lastWidth = currentWidth;
        return; // No need to re-render
      }

      lastWidth = currentWidth;

      // Re-render all rendered ads using cached data
      const adContainers = document.querySelectorAll('.time-based-advertisement[data-rendered="true"]');
      adContainers.forEach(container => {
        const adId = container.dataset.adId;
        if (adId && adCache.has(adId)) {
          const ad = adCache.get(adId);
          renderAdvertisement(container, ad, false);
        }
      });
    }, 250);
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Handle window resize
  window.addEventListener('resize', handleResize);

  // Re-initialize when Shopify section is re-rendered (for theme editor)
  document.addEventListener('shopify:section:load', init);
  document.addEventListener('shopify:block:select', init);
})();
