/**
 * Time-based App - Slider Banner
 * Client-side JavaScript for rendering scheduled slider banners with advanced transitions
 */

(function() {
  'use strict';

  const CONTAINER_ID = 'time-based-slider-placeholder';
  const APP_PROXY_PATH = '/apps/time-based/slider-banners';
  const STRIPE_COUNT = 10; // Number of stripes for stripe-based effects
  const TRANSITION_DURATION = 800; // Base duration in ms

  // All available transition effects for random selection
  const ALL_EFFECTS = [
    'simple-fade',
    'v-grow-down-ltr', 'v-grow-down-rtl', 'v-grow-down-random',
    'v-move-down-ltr', 'v-move-down-rtl', 'v-move-down-random',
    'v-grow-up-ltr', 'v-grow-up-rtl', 'v-grow-up-random',
    'v-move-up-ltr', 'v-move-up-rtl', 'v-move-up-random',
    'v-grow-into-ltr', 'v-grow-into-rtl',
    'v-move-into-ltr', 'v-move-into-rtl',
    'v-fold-ltr', 'v-fold-rtl',
    'h-grow-ltr-ttb', 'h-grow-ltr-btt', 'h-grow-ltr-random',
    'h-move-ltr-ttb', 'h-move-ltr-btt', 'h-move-ltr-random',
    'h-grow-rtl-ttb', 'h-grow-rtl-btt', 'h-grow-rtl-random',
    'h-move-rtl-ttb', 'h-move-rtl-btt', 'h-move-rtl-random',
    'h-grow-into-ttb', 'h-grow-into-btt',
    'h-move-into-ttb', 'h-move-into-btt'
  ];

  /**
   * Initialize the slider banner system
   */
  function init() {
    const container = document.getElementById(CONTAINER_ID);
    if (!container) {
      console.warn('Time-based App: Slider container not found');
      return;
    }

    const pageInfo = getPageInfo();

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
    return {
      isHomepage: path === '/' || path === '',
      productType: document.querySelector('meta[property="product:type"]')?.content || null,
      collectionHandle: path.match(/^\/collections\/([^\/]+)/)?.[1] || null
    };
  }

  /**
   * Fetch sliders from the app proxy endpoint
   */
  async function fetchSliders(pageInfo) {
    const params = new URLSearchParams();
    params.append('path', window.location.pathname);
    if (pageInfo.productType) params.append('product_type', pageInfo.productType);
    if (pageInfo.collectionHandle) params.append('collection', pageInfo.collectionHandle);

    const response = await fetch(`${APP_PROXY_PATH}?${params.toString()}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });

    if (!response.ok) throw new Error(`Failed to fetch sliders: ${response.status}`);
    const data = await response.json();
    return data.sliders || [];
  }

  /**
   * Filter sliders based on schedule and device visibility
   */
  function filterActiveSliders(sliders) {
    const nowUTC = Date.now();
    const isMobile = window.innerWidth < 768;

    return sliders.filter(slider => {
      if (!slider.status) return false;

      // Check device visibility based on aspect ratio
      if (isMobile && !slider.mobileAspectRatio) return false;
      if (!isMobile && !slider.desktopAspectRatio) return false;

      if (!slider.schedulingEnabled) return true;

      const startDate = slider.startDate ? new Date(slider.startDate).getTime() : null;
      const endDate = slider.endDate ? new Date(slider.endDate).getTime() : null;

      if (startDate && nowUTC < startDate) return false;
      if (endDate && nowUTC > endDate) return false;

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

    container.innerHTML = '';
    sliders.forEach(slider => {
      const sliderElement = createSliderElement(slider);
      container.appendChild(sliderElement);
    });
    container.style.display = 'block';
  }

  /**
   * Create a slider DOM element
   */
  function createSliderElement(slider) {
    const isMobile = window.innerWidth < 768;
    const aspectRatio = isMobile ? slider.mobileAspectRatio : slider.desktopAspectRatio;

    const sliderDiv = document.createElement('div');
    sliderDiv.className = 'time-based-slider';
    sliderDiv.dataset.sliderId = slider.id;
    sliderDiv.dataset.delay = slider.delayBetweenSlides || 5;
    sliderDiv.dataset.transition = slider.transitionEffect || 'simple-fade';

    if (slider.addBorder && !isMobile) {
      sliderDiv.classList.add('time-based-slider--bordered');
    }

    if (aspectRatio) {
      const [w, h] = aspectRatio.split(':').map(Number);
      if (w && h) sliderDiv.style.setProperty('--slider-aspect-ratio', `${w}/${h}`);
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

    // Start autoplay if more than one slide
    if (slides.length > 1) {
      // Store slider state
      sliderDiv._currentIndex = 0;
      sliderDiv._isTransitioning = false;

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

    // Create media wrapper for transitions
    const mediaWrapper = document.createElement('div');
    mediaWrapper.className = 'time-based-slider__media-wrapper';

    const mediaUrl = media?.url || media?.preview;
    if (media && mediaUrl) {
      const isVideo = media.type === 'video' || media.type?.startsWith('video/');

      if (isVideo) {
        const video = document.createElement('video');
        video.src = mediaUrl;
        video.className = 'time-based-slider__media';
        video.autoplay = true;
        video.loop = true;
        video.muted = true;
        video.playsInline = true;
        mediaWrapper.appendChild(video);
      } else {
        const img = document.createElement('img');
        img.src = mediaUrl;
        img.alt = media.alt || media.name || `Slide ${index + 1}`;
        img.className = 'time-based-slider__media';
        img.loading = index === 0 ? 'eager' : 'lazy';
        mediaWrapper.appendChild(img);
      }
    } else {
      const placeholder = document.createElement('div');
      placeholder.className = 'time-based-slider__placeholder';
      placeholder.textContent = `Slide ${index + 1}`;
      mediaWrapper.appendChild(placeholder);
    }

    slideDiv.appendChild(mediaWrapper);

    // Add clickable link overlay if link is set
    if (slide.linkType && slide.linkValue) {
      const link = document.createElement('a');
      link.href = constructLinkUrl(slide);
      link.className = 'time-based-slider__link';
      link.setAttribute('aria-label', `Link for slide ${index + 1}`);
      slideDiv.appendChild(link);
    }

    // Add button if enabled
    if (slide.buttonEnabled && slide.buttonText) {
      const button = document.createElement('a');
      button.className = 'time-based-slider__button';
      button.textContent = slide.buttonText;
      button.style.backgroundColor = slide.buttonBgColor || '#2e7d32';
      button.style.color = slide.buttonTextColor || '#ffffff';
      button.style.fontSize = slide.buttonTextSize || '16px';
      button.dataset.placement = slide.buttonPlacement || 'center';

      if (slide.linkType && slide.linkValue) {
        button.href = constructLinkUrl(slide);
      }

      slideDiv.appendChild(button);
    }

    return slideDiv;
  }

  /**
   * Construct link URL based on link type
   */
  function constructLinkUrl(slide) {
    switch (slide.linkType) {
      case 'external': return slide.linkValue;
      case 'productType': return `/collections/all/${slide.linkValue}`;
      case 'collection': return `/collections/${slide.linkValue}`;
      case 'homepage': return '/';
      default: return slide.linkValue || '#';
    }
  }

  /**
   * Go to a specific slide with transition effect
   */
  function goToSlide(sliderDiv, targetIndex) {
    if (sliderDiv._isTransitioning) return;

    const slides = sliderDiv.querySelectorAll('.time-based-slider__slide');
    const currentIndex = sliderDiv._currentIndex || 0;

    if (targetIndex === currentIndex) return;

    sliderDiv._isTransitioning = true;

    const currentSlide = slides[currentIndex];
    const targetSlide = slides[targetIndex];
    let effect = sliderDiv.dataset.transition || 'simple-fade';

    // Handle random effect
    if (effect === 'random') {
      effect = ALL_EFFECTS[Math.floor(Math.random() * ALL_EFFECTS.length)];
    }

    // Handle no-effect (same as simple-fade)
    if (effect === 'no-effect' || effect === '') {
      effect = 'simple-fade';
    }

    // Perform transition
    performTransition(sliderDiv, currentSlide, targetSlide, effect, () => {
      // Update active states
      slides.forEach((slide, i) => slide.classList.toggle('active', i === targetIndex));

      sliderDiv._currentIndex = targetIndex;
      sliderDiv._isTransitioning = false;

      resetAutoPlay(sliderDiv);
    });
  }

  /**
   * Perform the transition effect
   */
  function performTransition(sliderDiv, fromSlide, toSlide, effect, onComplete) {
    // Simple fade transition
    if (effect === 'simple-fade') {
      performFadeTransition(fromSlide, toSlide, onComplete);
      return;
    }

    // Stripe-based transitions
    if (effect.startsWith('v-') || effect.startsWith('h-')) {
      performStripeTransition(sliderDiv, fromSlide, toSlide, effect, onComplete);
      return;
    }

    // Fallback to fade
    performFadeTransition(fromSlide, toSlide, onComplete);
  }

  /**
   * Simple fade transition
   */
  function performFadeTransition(fromSlide, toSlide, onComplete) {
    toSlide.style.opacity = '0';
    toSlide.classList.add('active');

    requestAnimationFrame(() => {
      toSlide.style.transition = `opacity ${TRANSITION_DURATION}ms ease-in-out`;
      fromSlide.style.transition = `opacity ${TRANSITION_DURATION}ms ease-in-out`;
      toSlide.style.opacity = '1';
      fromSlide.style.opacity = '0';

      setTimeout(() => {
        fromSlide.classList.remove('active');
        fromSlide.style.opacity = '';
        fromSlide.style.transition = '';
        toSlide.style.transition = '';
        onComplete();
      }, TRANSITION_DURATION);
    });
  }

  /**
   * Stripe-based transition effects
   */
  function performStripeTransition(sliderDiv, fromSlide, toSlide, effect, onComplete) {
    const isVertical = effect.startsWith('v-');
    const sliderRect = sliderDiv.getBoundingClientRect();

    // Parse effect details
    const parts = effect.split('-');
    const action = parts[1]; // grow, move, fold
    const direction = parts.slice(2).join('-'); // ltr, rtl, random, into-ltr, etc.

    // Create transition overlay
    const overlay = document.createElement('div');
    overlay.className = 'time-based-slider__transition-overlay';
    overlay.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      z-index: 100;
      overflow: hidden;
      pointer-events: none;
    `;

    // Get the target slide's media element
    const toMedia = toSlide.querySelector('.time-based-slider__media, .time-based-slider__placeholder');
    const toMediaSrc = toMedia?.src || toMedia?.style?.backgroundImage || '';

    // Create stripes
    const stripes = [];
    for (let i = 0; i < STRIPE_COUNT; i++) {
      const stripe = document.createElement('div');
      stripe.className = 'time-based-slider__stripe';

      if (isVertical) {
        // Vertical stripes (side by side)
        const width = 100 / STRIPE_COUNT;
        stripe.style.cssText = `
          position: absolute;
          top: 0;
          left: ${i * width}%;
          width: ${width + 0.5}%;
          height: 100%;
          overflow: hidden;
        `;
      } else {
        // Horizontal stripes (stacked)
        const height = 100 / STRIPE_COUNT;
        stripe.style.cssText = `
          position: absolute;
          left: 0;
          top: ${i * height}%;
          width: 100%;
          height: ${height + 0.5}%;
          overflow: hidden;
        `;
      }

      // Create inner content that shows the target slide
      const inner = document.createElement('div');
      inner.className = 'time-based-slider__stripe-inner';

      if (isVertical) {
        const width = 100 / STRIPE_COUNT;
        inner.style.cssText = `
          position: absolute;
          top: 0;
          left: ${-i * 100}%;
          width: ${STRIPE_COUNT * 100}%;
          height: 100%;
        `;
      } else {
        const height = 100 / STRIPE_COUNT;
        inner.style.cssText = `
          position: absolute;
          left: 0;
          top: ${-i * 100}%;
          width: 100%;
          height: ${STRIPE_COUNT * 100}%;
        `;
      }

      // Clone target media into stripe
      if (toMedia) {
        const clone = toMedia.cloneNode(true);
        clone.style.cssText = `
          width: 100%;
          height: 100%;
          object-fit: cover;
        `;
        inner.appendChild(clone);
      }

      stripe.appendChild(inner);
      stripes.push(stripe);
      overlay.appendChild(stripe);
    }

    sliderDiv.querySelector('.time-based-slider__slides').appendChild(overlay);

    // Calculate animation order
    let order = [];
    if (direction.includes('random')) {
      order = [...Array(STRIPE_COUNT).keys()].sort(() => Math.random() - 0.5);
    } else if (direction.includes('rtl') || direction.includes('btt')) {
      order = [...Array(STRIPE_COUNT).keys()].reverse();
    } else {
      order = [...Array(STRIPE_COUNT).keys()];
    }

    // Set initial states based on action
    stripes.forEach((stripe, i) => {
      const inner = stripe.querySelector('.time-based-slider__stripe-inner');

      if (action === 'grow') {
        if (isVertical) {
          if (direction.includes('down') || direction.includes('into')) {
            stripe.style.clipPath = 'inset(0 0 100% 0)';
          } else {
            stripe.style.clipPath = 'inset(100% 0 0 0)';
          }
        } else {
          if (direction.includes('ltr') || direction.includes('into')) {
            stripe.style.clipPath = 'inset(0 100% 0 0)';
          } else {
            stripe.style.clipPath = 'inset(0 0 0 100%)';
          }
        }
      } else if (action === 'move') {
        if (isVertical) {
          if (direction.includes('down') || direction.includes('into')) {
            inner.style.transform = 'translateY(-100%)';
          } else {
            inner.style.transform = 'translateY(100%)';
          }
        } else {
          if (direction.includes('ltr') || direction.includes('into')) {
            inner.style.transform = 'translateX(-100%)';
          } else {
            inner.style.transform = 'translateX(100%)';
          }
        }
        stripe.style.clipPath = 'inset(0)';
      } else if (action === 'fold') {
        stripe.style.transformOrigin = isVertical ? 'left center' : 'center top';
        stripe.style.transform = isVertical ? 'rotateY(-90deg)' : 'rotateX(90deg)';
        stripe.style.opacity = '0';
      }

      // Handle "into" effects (alternating directions)
      if (direction.includes('into')) {
        const isEven = i % 2 === 0;
        if (action === 'grow') {
          if (isVertical) {
            stripe.style.clipPath = isEven ? 'inset(0 0 100% 0)' : 'inset(100% 0 0 0)';
          } else {
            stripe.style.clipPath = isEven ? 'inset(0 100% 0 0)' : 'inset(0 0 0 100%)';
          }
        } else if (action === 'move') {
          if (isVertical) {
            inner.style.transform = isEven ? 'translateY(-100%)' : 'translateY(100%)';
          } else {
            inner.style.transform = isEven ? 'translateX(-100%)' : 'translateX(100%)';
          }
        }
      }
    });

    // Animate stripes
    const staggerDelay = TRANSITION_DURATION / (STRIPE_COUNT * 2);

    requestAnimationFrame(() => {
      order.forEach((originalIndex, animOrder) => {
        const stripe = stripes[originalIndex];
        const inner = stripe.querySelector('.time-based-slider__stripe-inner');
        const delay = animOrder * staggerDelay;

        setTimeout(() => {
          stripe.style.transition = `clip-path ${TRANSITION_DURATION * 0.6}ms ease-out, transform ${TRANSITION_DURATION * 0.6}ms ease-out, opacity ${TRANSITION_DURATION * 0.4}ms ease-out`;
          inner.style.transition = `transform ${TRANSITION_DURATION * 0.6}ms ease-out`;

          if (action === 'grow' || action === 'move') {
            stripe.style.clipPath = 'inset(0)';
            inner.style.transform = 'translate(0, 0)';
          } else if (action === 'fold') {
            stripe.style.transform = 'rotateY(0deg) rotateX(0deg)';
            stripe.style.opacity = '1';
          }
        }, delay);
      });
    });

    // Complete transition
    setTimeout(() => {
      overlay.remove();
      toSlide.classList.add('active');
      fromSlide.classList.remove('active');
      onComplete();
    }, TRANSITION_DURATION + (STRIPE_COUNT * staggerDelay));
  }

  /**
   * Start auto-play for a slider
   */
  function startAutoPlay(sliderDiv) {
    const delay = parseInt(sliderDiv.dataset.delay, 10) * 1000 || 5000;
    sliderDiv._autoPlayInterval = setInterval(() => {
      if (!sliderDiv._isTransitioning) {
        nextSlide(sliderDiv);
      }
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
   * Go to next slide
   */
  function nextSlide(sliderDiv) {
    const slides = sliderDiv.querySelectorAll('.time-based-slider__slide');
    const currentIndex = sliderDiv._currentIndex || 0;
    const nextIndex = (currentIndex + 1) % slides.length;
    goToSlide(sliderDiv, nextIndex);
  }

  /**
   * Handle window resize
   */
  let resizeTimeout;
  function handleResize() {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
      // Clear existing intervals
      document.querySelectorAll('.time-based-slider').forEach(slider => {
        if (slider._autoPlayInterval) {
          clearInterval(slider._autoPlayInterval);
        }
      });
      init();
    }, 250);
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.addEventListener('resize', handleResize);

})();
