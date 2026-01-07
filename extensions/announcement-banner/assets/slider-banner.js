/**
 * Time-based App - Slider Banner
 * Client-side JavaScript for rendering scheduled slider banners
 */

(function() {
  'use strict';

  const CONTAINER_ID = 'time-based-app-sliders';
  const APP_PROXY_PATH = '/apps/time-based/slider-banners';

  /**
   * Initialize the slider banner system
   */
  function init() {
    const container = document.getElementById(CONTAINER_ID);
    if (!container) {
      console.warn('Time-based App: Slider container not found');
      return;
    }

    // Get current page info for filtering
    const pageInfo = getPageInfo();

    // Fetch sliders from app proxy
    fetchSliders(pageInfo)
      .then(sliders => {
        const activeSliders = filterActiveSliders(sliders);
        renderSliders(container, activeSliders);
      })
      .catch(error => {
        console.error('Time-based App: Failed to load sliders', error);
      });
  }

  /**
   * Get current page information for slider filtering
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
   * Fetch sliders from the app proxy endpoint
   */
  async function fetchSliders(pageInfo) {
    const params = new URLSearchParams();
    params.append('homepage', pageInfo.isHomepage);
    if (pageInfo.productType) {
      params.append('productType', pageInfo.productType);
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
      throw new Error(`Failed to fetch sliders: ${response.status}`);
    }

    const data = await response.json();
    return data.sliders || [];
  }

  /**
   * Filter sliders based on their schedule (client-side UTC check)
   */
  function filterActiveSliders(sliders) {
    const now = new Date();
    const nowUTC = now.getTime();

    return sliders.filter(slider => {
      // Skip if slider is not enabled
      if (!slider.status) {
        return false;
      }

      // If scheduling is not enabled, the slider is always active
      if (!slider.schedulingEnabled) {
        return true;
      }

      // Check schedule
      const startDate = slider.startDate ? new Date(slider.startDate).getTime() : null;
      const endDate = slider.endDate ? new Date(slider.endDate).getTime() : null;

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
   * Render sliders in the container
   */
  function renderSliders(container, sliders) {
    if (sliders.length === 0) {
      container.style.display = 'none';
      return;
    }

    // Clear container
    container.innerHTML = '';

    // Render each slider
    sliders.forEach(slider => {
      const sliderElement = createSliderElement(slider);
      container.appendChild(sliderElement);
    });

    // Show container
    container.style.display = 'block';
  }

  /**
   * Create a slider DOM element
   */
  function createSliderElement(slider) {
    const sliderDiv = document.createElement('div');
    sliderDiv.className = 'time-based-slider';
    sliderDiv.dataset.sliderId = slider.id;
    sliderDiv.dataset.delay = slider.delayBetweenSlides || 5;
    sliderDiv.dataset.transition = slider.transitionEffect || 'simple-fade';

    if (slider.addBorder) {
      sliderDiv.classList.add('time-based-slider--bordered');
    }

    const isMobile = window.innerWidth < 768;
    const aspectRatio = isMobile ? slider.mobileAspectRatio : slider.desktopAspectRatio;

    // Set aspect ratio CSS custom property
    if (aspectRatio) {
      const [w, h] = aspectRatio.split(':').map(Number);
      if (w && h) {
        sliderDiv.style.setProperty('--slider-aspect-ratio', `${w}/${h}`);
      }
    }

    // Create slides container
    const slidesContainer = document.createElement('div');
    slidesContainer.className = 'time-based-slider__slides';

    const slides = slider.slides || [];
    slides.forEach((slide, index) => {
      const slideElement = createSlideElement(slide, index, isMobile);
      slidesContainer.appendChild(slideElement);
    });

    sliderDiv.appendChild(slidesContainer);

    // Add navigation dots if more than one slide
    if (slides.length > 1) {
      const dotsContainer = document.createElement('div');
      dotsContainer.className = 'time-based-slider__dots';

      slides.forEach((_, index) => {
        const dot = document.createElement('button');
        dot.className = 'time-based-slider__dot';
        dot.dataset.index = index;
        if (index === 0) dot.classList.add('active');
        dot.addEventListener('click', () => goToSlide(sliderDiv, index));
        dotsContainer.appendChild(dot);
      });

      sliderDiv.appendChild(dotsContainer);

      // Start auto-play
      startAutoPlay(sliderDiv);
    }

    return sliderDiv;
  }

  /**
   * Create a slide element
   */
  function createSlideElement(slide, index, isMobile) {
    const slideDiv = document.createElement('div');
    slideDiv.className = 'time-based-slider__slide';
    if (index === 0) slideDiv.classList.add('active');
    slideDiv.dataset.index = index;

    const deviceData = isMobile ? (slide.mobile || slide.desktop) : slide.desktop;
    const media = deviceData?.media;

    // Create media element
    if (media && media.preview) {
      const isVideo = media.type?.startsWith('video/');

      if (isVideo) {
        const video = document.createElement('video');
        video.src = media.preview;
        video.className = 'time-based-slider__media';
        video.autoplay = true;
        video.loop = true;
        video.muted = true;
        video.playsInline = true;
        slideDiv.appendChild(video);
      } else {
        const img = document.createElement('img');
        img.src = media.preview;
        img.alt = media.name || '';
        img.className = 'time-based-slider__media';
        slideDiv.appendChild(img);
      }
    } else {
      // Placeholder for demo
      const placeholder = document.createElement('div');
      placeholder.className = 'time-based-slider__placeholder';
      placeholder.textContent = `Slide ${index + 1}`;
      slideDiv.appendChild(placeholder);
    }

    // Add link wrapper if link is set
    if (slide.linkType && slide.linkValue) {
      const link = document.createElement('a');
      link.href = constructLinkUrl(slide);
      link.className = 'time-based-slider__link';
      slideDiv.appendChild(link);
    }

    // Add button if enabled
    if (slide.buttonEnabled && slide.buttonText) {
      const button = document.createElement('button');
      button.className = 'time-based-slider__button';
      button.textContent = slide.buttonText;
      button.style.backgroundColor = slide.buttonBgColor || '#2e7d32';
      button.style.color = slide.buttonTextColor || '#ffffff';
      button.style.fontSize = slide.buttonTextSize || '16px';

      // Position button based on placement
      const placement = slide.buttonPlacement || 'center';
      button.dataset.placement = placement;

      slideDiv.appendChild(button);
    }

    return slideDiv;
  }

  /**
   * Construct link URL based on link type
   */
  function constructLinkUrl(slide) {
    switch (slide.linkType) {
      case 'external':
        return slide.linkValue;
      case 'productType':
        return `/collections/all/${slide.linkValue}`;
      case 'collection':
        return `/collections/${slide.linkValue}`;
      case 'homepage':
        return '/';
      default:
        return slide.linkValue || '#';
    }
  }

  /**
   * Go to a specific slide
   */
  function goToSlide(sliderDiv, index) {
    const slides = sliderDiv.querySelectorAll('.time-based-slider__slide');
    const dots = sliderDiv.querySelectorAll('.time-based-slider__dot');

    slides.forEach((slide, i) => {
      slide.classList.toggle('active', i === index);
    });

    dots.forEach((dot, i) => {
      dot.classList.toggle('active', i === index);
    });

    // Reset autoplay timer
    resetAutoPlay(sliderDiv);
  }

  /**
   * Get current slide index
   */
  function getCurrentSlideIndex(sliderDiv) {
    const activeSlide = sliderDiv.querySelector('.time-based-slider__slide.active');
    return activeSlide ? parseInt(activeSlide.dataset.index, 10) : 0;
  }

  /**
   * Go to next slide
   */
  function nextSlide(sliderDiv) {
    const slides = sliderDiv.querySelectorAll('.time-based-slider__slide');
    const currentIndex = getCurrentSlideIndex(sliderDiv);
    const nextIndex = (currentIndex + 1) % slides.length;
    goToSlide(sliderDiv, nextIndex);
  }

  /**
   * Start auto-play for a slider
   */
  function startAutoPlay(sliderDiv) {
    const delay = parseInt(sliderDiv.dataset.delay, 10) * 1000 || 5000;
    sliderDiv._autoPlayInterval = setInterval(() => {
      nextSlide(sliderDiv);
    }, delay);
  }

  /**
   * Reset auto-play timer
   */
  function resetAutoPlay(sliderDiv) {
    if (sliderDiv._autoPlayInterval) {
      clearInterval(sliderDiv._autoPlayInterval);
      startAutoPlay(sliderDiv);
    }
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
