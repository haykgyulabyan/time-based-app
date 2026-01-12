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

  /**
   * Initialize all advertisement blocks on the page
   */
  function init() {
    const adContainers = document.querySelectorAll('.time-based-advertisement[data-ad-id]');

    adContainers.forEach(container => {
      const adId = container.dataset.adId;

      // Skip if no ad ID specified
      if (!adId || adId.trim() === '') {
        return;
      }

      // Check if already rendered
      if (container.dataset.rendered === 'true') {
        return;
      }

      fetchAdvertisement(container, adId);
    });
  }

  /**
   * Fetch advertisement data from app proxy
   */
  async function fetchAdvertisement(container, adId) {
    try {
      const shop = container.dataset.shop;
      const response = await fetch(`${APP_PROXY_PATH}?id=${adId}&shop=${shop}`);

      if (!response.ok) {
        console.error('Time-based App: Failed to load advertisement', response.status);
        hideContainer(container);
        return;
      }

      const data = await response.json();
      const ad = data.advertisement;

      if (!ad) {
        console.error('Time-based App: Advertisement not found');
        hideContainer(container);
        return;
      }

      // Check if ad is active (status + schedule)
      if (!isAdActive(ad)) {
        hideContainer(container);
        return;
      }

      // Render the advertisement
      renderAdvertisement(container, ad);
      container.dataset.rendered = 'true';

    } catch (error) {
      console.error('Time-based App: Error loading advertisement', error);
      hideContainer(container);
    }
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
   * Render advertisement content
   */
  function renderAdvertisement(container, ad) {
    const isMobile = window.innerWidth < 768;
    const image = isMobile ? (ad.mobileImage || ad.desktopImage) : ad.desktopImage;

    // If no image, hide container
    if (!image || !image.url) {
      hideContainer(container);
      return;
    }

    const size = SIZES[ad.size] || SIZES['1x1'];

    // Clear existing content
    container.innerHTML = '';

    // Add size class
    container.className = `time-based-advertisement time-based-advertisement--${ad.size}`;
    container.style.maxWidth = `${size.width}px`;

    // Create wrapper for image and button
    const wrapper = document.createElement('div');
    wrapper.className = 'time-based-advertisement__wrapper';

    // Create image element
    const img = document.createElement('img');
    img.src = image.url;
    img.alt = image.alt || ad.name || 'Advertisement';
    img.className = 'time-based-advertisement__image';
    img.loading = 'lazy';
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
   */
  let resizeTimeout;
  function handleResize() {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
      // Re-render all rendered ads
      const adContainers = document.querySelectorAll('.time-based-advertisement[data-rendered="true"]');
      adContainers.forEach(container => {
        container.dataset.rendered = 'false';
        const adId = container.dataset.adId;
        if (adId) {
          fetchAdvertisement(container, adId);
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
})();
