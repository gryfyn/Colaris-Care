/**
 * Performance utilities for admin dashboard optimization
 */

/**
 * Measure and log performance metrics
 */
export function measurePerformance(label) {
  const startTime = performance.now();
  const startMemory = performance.memory?.usedJSHeapSize || 0;

  return {
    end: () => {
      const endTime = performance.now();
      const endMemory = performance.memory?.usedJSHeapSize || 0;
      const duration = endTime - startTime;
      const memoryDelta = endMemory - startMemory;

      if (process.env.NODE_ENV !== 'production') {
        console.log(
          `[Performance] ${label}: ${duration.toFixed(2)}ms (memory: ${(memoryDelta / 1024 / 1024).toFixed(2)}MB)`
        );
      }

      return { duration, memoryDelta };
    },
  };
}

/**
 * Debounce function for expensive operations
 */
export function debounce(fn, delayMs = 300) {
  let timeoutId;
  let lastResult;

  return function debounced(...args) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => {
      lastResult = fn.apply(this, args);
    }, delayMs);

    return lastResult;
  };
}

/**
 * Throttle function for rate-limiting
 */
export function throttle(fn, delayMs = 300) {
  let lastCallTime = 0;
  let lastResult;

  return function throttled(...args) {
    const now = Date.now();

    if (now - lastCallTime >= delayMs) {
      lastCallTime = now;
      lastResult = fn.apply(this, args);
    }

    return lastResult;
  };
}

/**
 * Batch updates to reduce re-renders
 */
export function batchUpdates(fn) {
  // Use React 18 batching or manual batching
  if (typeof window !== 'undefined' && window.React?.startTransition) {
    window.React.startTransition(fn);
  } else {
    fn();
  }
}

/**
 * Lazy load images with intersection observer
 */
export function lazyLoadImages(container = document) {
  if (!('IntersectionObserver' in window)) {
    // Fallback: load all images immediately
    const images = container.querySelectorAll('img[data-src]');
    images.forEach(img => {
      img.src = img.dataset.src;
      img.removeAttribute('data-src');
    });
    return;
  }

  const observer = new IntersectionObserver((entries, observer) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const img = entry.target;
        img.src = img.dataset.src;
        img.removeAttribute('data-src');
        observer.unobserve(img);
      }
    });
  });

  const images = container.querySelectorAll('img[data-src]');
  images.forEach(img => observer.observe(img));

  return observer;
}

/**
 * Virtual list rendering for large tables
 * Only render visible rows
 */
export function createVirtualList(items, options = {}) {
  const {
    itemHeight = 40,
    containerHeight = 400,
    bufferSize = 5,
  } = options;

  const visibleCount = Math.ceil(containerHeight / itemHeight) + bufferSize * 2;

  return {
    getTotalHeight: () => items.length * itemHeight,

    getVisibleItems: (scrollTop) => {
      const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - bufferSize);
      const endIndex = Math.min(
        items.length,
        Math.ceil((scrollTop + containerHeight) / itemHeight) + bufferSize
      );

      return {
        items: items.slice(startIndex, endIndex),
        startIndex,
        endIndex,
        offsetTop: startIndex * itemHeight,
      };
    },

    getItemOffsetTop: (index) => index * itemHeight,
  };
}

/**
 * Request animation frame batching
 */
export function rafBatch(callbacks) {
  let frameScheduled = false;
  const batch = [];

  return function batchFn(fn) {
    batch.push(fn);

    if (!frameScheduled) {
      frameScheduled = true;
      requestAnimationFrame(() => {
        batch.forEach(fn => fn());
        batch.length = 0;
        frameScheduled = false;
      });
    }
  };
}

/**
 * Monitor and warn about performance degradation
 */
export function enablePerformanceMonitoring(thresholds = {}) {
  const defaults = {
    longTaskDuration: 50, // ms
    fpDuration: 1000, // ms
    lcpDuration: 2500, // ms
  };

  const config = { ...defaults, ...thresholds };

  if (!('PerformanceObserver' in window)) {
    return;
  }

  // Monitor long tasks
  try {
    const longTaskObserver = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.duration > config.longTaskDuration) {
          console.warn(
            `[Performance] Long task detected: ${entry.name} (${entry.duration.toFixed(2)}ms)`
          );
        }
      }
    });

    longTaskObserver.observe({ entryTypes: ['longtask'] });
  } catch (e) {
    // Long task API not available
  }

  // Monitor core web vitals
  try {
    const vitalsObserver = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.duration > config.fpDuration || entry.startTime > config.lcpDuration) {
          console.warn(
            `[Performance] Web vital degradation: ${entry.name} (${entry.value?.toFixed(2) || entry.duration.toFixed(2)}ms)`
          );
        }
      }
    });

    vitalsObserver.observe({
      entryTypes: ['first-paint', 'largest-contentful-paint'],
    });
  } catch (e) {
    // Vitals API not available
  }
}

/**
 * Cache API responses with TTL
 */
export function createCache(ttlMs = 60000) {
  const cache = new Map();

  return {
    set: (key, value) => {
      cache.set(key, {
        value,
        expiresAt: Date.now() + ttlMs,
      });
    },

    get: (key) => {
      const entry = cache.get(key);
      if (!entry) return undefined;

      if (Date.now() > entry.expiresAt) {
        cache.delete(key);
        return undefined;
      }

      return entry.value;
    },

    has: (key) => {
      const entry = cache.get(key);
      if (!entry) return false;

      if (Date.now() > entry.expiresAt) {
        cache.delete(key);
        return false;
      }

      return true;
    },

    clear: () => cache.clear(),

    size: () => cache.size,
  };
}

/**
 * React hook for debounced value
 */
export function useDebouncedValue(value, delayMs = 300) {
  const [debouncedValue, setDebouncedValue] = require('react').useState(value);

  require('react').useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delayMs);

    return () => clearTimeout(handler);
  }, [value, delayMs]);

  return debouncedValue;
}

/**
 * React hook for memoized value with custom equality
 */
export function useMemoized(value, equalFn) {
  const prevRef = require('react').useRef();
  const memoRef = require('react').useRef(value);

  if (!equalFn(prevRef.current, value)) {
    prevRef.current = value;
    memoRef.current = value;
  }

  return memoRef.current;
}
