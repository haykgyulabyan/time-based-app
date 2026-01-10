/**
 * Time-based App - Announcement Banner
 * Client-side JavaScript for rendering scheduled announcement banners
 */

(function() {
  'use strict';

  // Try header container first (for proper document flow), fall back to app embed container
  const HEADER_CONTAINER_ID = 'time-based-header-banners';
  const FALLBACK_CONTAINER_ID = 'time-based-app-banners';
  const APP_PROXY_PATH = '/apps/time-based/banners';

  /**
   * Initialize the announcement banner system
   */
  function init() {
    // Prefer header container for proper document flow, fall back to app embed container
    let container = document.getElementById(HEADER_CONTAINER_ID);
    let useHeaderContainer = !!container;

    if (!container) {
      container = document.getElementById(FALLBACK_CONTAINER_ID);
    }

    if (!container) {
      console.warn('Time-based App: Banner container not found');
      return;
    }

    // Get current page info for filtering
    const pageInfo = getPageInfo();

    // Fetch banners from app proxy
    fetchBanners(pageInfo)
      .then(banners => {
        const activeBanners = filterActiveBanners(banners);
        renderBanners(container, activeBanners);
      })
      .catch(error => {
        console.error('Time-based App: Failed to load banners', error);
      });
  }

  /**
   * Get current page information for banner filtering
   */
  function getPageInfo() {
    const path = window.location.pathname;
    const info = {
      isHomepage: path === '/' || path === '',
      productType: null,
      collectionHandle: null
    };

    // Check if on collection page
    const collectionMatch = path.match(/^\/collections\/([^\/]+)/);
    if (collectionMatch) {
      info.collectionHandle = collectionMatch[1];
    }

    // Get product type from meta tag if available
    const productTypeMeta = document.querySelector('meta[property="product:type"]');
    if (productTypeMeta) {
      info.productType = productTypeMeta.content;
    }

    return info;
  }

  /**
   * Fetch banners from the app proxy endpoint
   */
  async function fetchBanners(pageInfo) {
    const params = new URLSearchParams();
    // Send the actual path for server-side page type detection
    params.append('path', window.location.pathname);
    if (pageInfo.productType) {
      params.append('product_type', pageInfo.productType);
    }
    if (pageInfo.collectionHandle) {
      params.append('collection', pageInfo.collectionHandle);
    }

    const url = `${APP_PROXY_PATH}?${params.toString()}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch banners: ${response.status}`);
    }

    const data = await response.json();
    return data.banners || [];
  }

  /**
   * Filter banners based on their schedule (client-side UTC check)
   */
  function filterActiveBanners(banners) {
    const now = new Date();
    const nowUTC = now.getTime();

    return banners.filter(banner => {
      // Skip if banner is not enabled
      if (!banner.status) {
        return false;
      }

      // If scheduling is not enabled, the banner is always active
      if (!banner.schedulingEnabled) {
        return true;
      }

      // Check schedule
      const startDate = banner.startDate ? new Date(banner.startDate).getTime() : null;
      const endDate = banner.endDate ? new Date(banner.endDate).getTime() : null;

      // If start date is set and we're before it, don't show
      if (startDate && nowUTC < startDate) {
        return false;
      }

      // If end date is set and we're past it, don't show
      if (endDate && nowUTC > endDate) {
        return false;
      }

      return true;
    });
  }

  /**
   * Render banners in the container
   */
  function renderBanners(container, banners) {
    if (banners.length === 0) {
      container.style.display = 'none';
      return;
    }

    // Clear container
    container.innerHTML = '';

    // Render each banner
    banners.forEach(banner => {
      const bannerElement = createBannerElement(banner);
      container.appendChild(bannerElement);
    });

    // Show container
    container.style.display = 'block';
  }

  /**
   * Create a banner DOM element
   */
  function createBannerElement(banner) {
    // If link is enabled, make the entire banner clickable
    const isClickable = banner.linkEnabled && banner.linkUrl;

    let bannerElement;
    if (isClickable) {
      // Use anchor as the banner wrapper for full clickability
      bannerElement = document.createElement('a');
      bannerElement.href = banner.linkUrl;
      bannerElement.target = banner.linkTarget || '_self';
      bannerElement.className = 'time-based-announcement-bar time-based-announcement-bar--clickable';
    } else {
      bannerElement = document.createElement('div');
      bannerElement.className = 'time-based-announcement-bar';
    }
    bannerElement.style.backgroundColor = banner.backgroundColor || '#000000';

    // Create inner content wrapper
    const contentWrapper = document.createElement('div');
    contentWrapper.className = 'time-based-announcement-bar__content';

    // Add content lines
    appendContentLines(contentWrapper, banner);

    // Add coupon display if enabled
    if (banner.couponEnabled && banner.couponDisplay && banner.couponDisplay.text) {
      const couponElement = createContentElement(
        banner.couponDisplay.text,
        banner.couponDisplay.fontSize || '14px',
        banner.couponDisplay.htmlTag || 'p'
      );
      couponElement.className = 'time-based-announcement-bar__coupon';
      contentWrapper.appendChild(couponElement);
    }

    bannerElement.appendChild(contentWrapper);
    return bannerElement;
  }

  /**
   * Append content lines to a container
   */
  function appendContentLines(container, banner) {
    const content = banner.content || [];
    const isMobile = window.innerWidth < 768;

    content.forEach(line => {
      const deviceContent = isMobile ? (line.mobile || line.desktop) : line.desktop;
      if (deviceContent && deviceContent.text) {
        const element = createContentElement(
          deviceContent.text,
          deviceContent.fontSize || '14px',
          deviceContent.htmlTag || 'p'
        );
        container.appendChild(element);
      }
    });
  }

  /**
   * Create a content element with proper HTML tag
   */
  function createContentElement(text, fontSize, htmlTag) {
    const validTags = ['p', 'h1', 'h2', 'h3', 'h4', 'span', 'div'];
    const tag = validTags.includes(htmlTag) ? htmlTag : 'p';

    const element = document.createElement(tag);
    element.className = 'time-based-announcement-bar__text';
    element.style.fontSize = fontSize;
    element.innerHTML = text; // Allow HTML for basic formatting

    return element;
  }

  /**
   * Handle window resize for responsive content
   */
  let resizeTimeout;
  function handleResize() {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(init, 250);
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Re-render on significant resize (for mobile/desktop content switch)
  window.addEventListener('resize', handleResize);

})();
