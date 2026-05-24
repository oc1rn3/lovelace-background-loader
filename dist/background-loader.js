(() => {
  if (window.__haBackgroundLoaderManagerInitialized) return;
  window.__haBackgroundLoaderManagerInitialized = true;

  class HABackgroundLoader {
    constructor(config = {}) {
      this.config = config;

      this.baseUrl = config.url || "http://has-images.has.ocsne.snerheb.com/webcam_rbc.jpg";
      this.entityId = config.entity || null;
      this.entityMode = config.entity_mode || "trigger"; // "trigger" | "url"

      this.interval = Number(config.interval ?? 300000);
      this.fadeDuration = Number(config.fade_duration ?? 50);
      this.activeIndex = 0;
      this.layers = [];
      this.started = false;

      this.defaultOverlay = Number(config.default_overlay ?? 0.12);
      this.minOverlay = Number(config.min_overlay ?? 0.08);
      this.maxOverlay = Number(config.max_overlay ?? 0.20);
      this.vignetteEnabled = Boolean(config.vignette ?? false);
      this.vignetteOpacity = Number(config.vignette_opacity ?? 0.28);
      this.vignetteSize = Number(config.vignette_size ?? 220);

      // 70% alt + 30% neu
      this.overlaySmoothingFactor = 0.30;
      this.currentOverlayLevel = this.defaultOverlay;

      this.skipUnchanged = Boolean(config.skip_unchanged ?? false);

      // Schwellwerte für "Bild praktisch unverändert" (nur bei skip_unchanged)
      this.minBrightnessDelta = 0.015;
      this.minSignatureDelta = 0.008;

      this.lastBrightness = null;
      this.lastSignature = null;
      this.lastEntityValue = null;

      this.debug = Boolean(config.debug ?? false);
      this.timer = null;
      this.observer = null;
      this.entityWatcher = null;
      this.updateInProgress = false;
      this.reloadOnForeground = null;

      this.init();
    }

    init() {
      this.injectStyle();
      this.createDom();
      this.loadInitialImage();

      const autoForegroundReload =
        this.interval > 0 || !this.entityId || this.entityMode === "trigger";

      this.reloadOnForeground =
        typeof this.config.reload_on_foreground === "boolean"
          ? this.config.reload_on_foreground
          : autoForegroundReload;

      this.visibilityHandler = () => {
        if (!this.reloadOnForeground) return;
        if (!document.hidden) this.updateImage("visibilitychange");
      };

      this.focusHandler = () => {
        if (!this.reloadOnForeground) return;
        this.updateImage("focus");
      };

      document.addEventListener("visibilitychange", this.visibilityHandler);
      window.addEventListener("focus", this.focusHandler);

      if (this.interval > 0) {
        this.timer = setInterval(() => this.updateImage("interval"), this.interval);
      }

      if (this.entityId) {
        this.startEntityWatcher();
      }

      this.log("Initialized", {
        interval: this.interval,
        entityId: this.entityId,
        entityMode: this.entityMode,
        reloadOnForeground: this.reloadOnForeground,
        skipUnchanged: this.skipUnchanged,
        vignetteEnabled: this.vignetteEnabled
      });
    }

    destroy() {
      if (this.timer) {
        clearInterval(this.timer);
        this.timer = null;
      }

      if (this.entityWatcher) {
        clearInterval(this.entityWatcher);
        this.entityWatcher = null;
      }

      if (this.observer) {
        this.observer.disconnect();
        this.observer = null;
      }

      if (this.visibilityHandler) {
        document.removeEventListener("visibilitychange", this.visibilityHandler);
      }

      if (this.focusHandler) {
        window.removeEventListener("focus", this.focusHandler);
      }

      const style = document.getElementById("ha-background-loader-style");
      if (style) style.remove();

      const root = document.getElementById("ha-bg-root");
      if (root) root.remove();

      this.log("Destroyed background loader");
    }

    injectStyle() {
      const oldStyle = document.getElementById("ha-background-loader-style");
      if (oldStyle) oldStyle.remove();

      const style = document.createElement("style");
      style.id = "ha-background-loader-style";
      style.textContent = `
        #ha-bg-root {
          position: fixed;
          inset: 0;
          z-index: 0;
          pointer-events: none;
          overflow: hidden;
          background: #000;
        }

        #ha-bg-root .ha-bg-layer {
          position: absolute;
          inset: 0;
          background-size: cover;
          background-position: center center;
          background-repeat: no-repeat;
          opacity: 0;
          transition: opacity ${this.fadeDuration}ms linear;
          will-change: opacity;
        }

        #ha-bg-root .ha-bg-layer.visible {
          opacity: 1;
        }

        #ha-bg-overlay {
          position: absolute;
          inset: 0;
          background: ${this.buildOverlayBackground(this.defaultOverlay)};
          transition: background 160ms linear;
          pointer-events: none;
        }

        home-assistant {
          background: transparent !important;
        }
      `;
      document.head.appendChild(style);
    }

    createDom() {
      const oldRoot = document.getElementById("ha-bg-root");
      if (oldRoot) oldRoot.remove();

      const root = document.createElement("div");
      root.id = "ha-bg-root";

      const layerA = document.createElement("div");
      layerA.className = "ha-bg-layer";

      const layerB = document.createElement("div");
      layerB.className = "ha-bg-layer";

      const overlay = document.createElement("div");
      overlay.id = "ha-bg-overlay";

      root.appendChild(layerA);
      root.appendChild(layerB);
      root.appendChild(overlay);

      document.body.prepend(root);

      this.root = root;
      this.overlay = overlay;
      this.layers = [layerA, layerB];

      this.makeHATransparent();
      this.startTransparencyObserver();
    }

    log(...args) {
      if (this.debug) {
        console.log("[HA Background V5.3]", ...args);
      }
    }

    getHomeAssistant() {
      return document.querySelector("home-assistant");
    }

    getEntityState(entityId) {
      const ha = this.getHomeAssistant();
      if (!ha) return null;
      return ha.hass?.states?.[entityId]?.state ?? null;
    }

    resolveBaseUrl() {
      if (this.entityId && this.entityMode === "url") {
        const entityValue = this.getEntityState(this.entityId);
        if (entityValue && entityValue !== "unknown" && entityValue !== "unavailable") {
          return entityValue;
        }
      }
      return this.baseUrl;
    }

    makeHATransparent() {
      const transparentSelectors = [
        "home-assistant",
        "home-assistant-main",
        "ha-drawer partial-panel-resolver",
        "partial-panel-resolver",
        "ha-panel-lovelace",
        "hui-root",
        "ha-app-layout",
        "app-header-layout",
        ".content",
        "hui-view",
        "hui-panel-view",
        ".view",
      ];

      transparentSelectors.forEach((selector) => {
        document.querySelectorAll(selector).forEach((el) => {
          el.style.background = "transparent";
          el.style.backgroundColor = "transparent";
        });
      });

      const ha = document.querySelector("home-assistant");
      if (ha && ha.shadowRoot) {
        this.makeShadowTransparent(ha.shadowRoot);
      }
    }

    makeShadowTransparent(root) {
      const selectors = [
        "home-assistant-main",
        "partial-panel-resolver",
        "ha-panel-lovelace",
        "hui-root",
        "ha-app-layout",
        "app-header-layout",
        ".content",
        "hui-view",
        "hui-panel-view",
        ".view",
      ];

      selectors.forEach((selector) => {
        root.querySelectorAll(selector).forEach((el) => {
          el.style.background = "transparent";
          el.style.backgroundColor = "transparent";
        });
      });

      root.querySelectorAll("*").forEach((el) => {
        if (
          el.tagName === "HA-PANEL-LOVELACE" ||
          el.tagName === "HUI-ROOT" ||
          el.tagName === "HUI-VIEW" ||
          el.tagName === "HUI-PANEL-VIEW"
        ) {
          el.style.background = "transparent";
          el.style.backgroundColor = "transparent";
        }
      });

      root.querySelectorAll("*").forEach((el) => {
        if (el.shadowRoot) {
          this.makeShadowTransparent(el.shadowRoot);
        }
      });
    }

    startTransparencyObserver() {
      if (this.observer) return;

      const observer = new MutationObserver(() => {
        this.makeHATransparent();
      });

      observer.observe(document.documentElement, {
        childList: true,
        subtree: true,
      });

      this.observer = observer;
    }

    startEntityWatcher() {
      this.lastEntityValue = this.getEntityState(this.entityId);
      this.log("Entity watcher started", {
        entity: this.entityId,
        mode: this.entityMode,
        initialValue: this.lastEntityValue
      });

      this.entityWatcher = setInterval(() => {
        const currentValue = this.getEntityState(this.entityId);
        if (currentValue === null || currentValue === this.lastEntityValue) return;

        const oldValue = this.lastEntityValue;
        this.lastEntityValue = currentValue;

        this.log("Entity changed", {
          entity: this.entityId,
          mode: this.entityMode,
          oldValue,
          newValue: currentValue
        });

        this.updateImage(`entity:${this.entityId}`);
      }, 1000);
    }

    buildUrl() {
      const resolvedBaseUrl = this.resolveBaseUrl();
      const sep = resolvedBaseUrl.includes("?") ? "&" : "?";
      return `${resolvedBaseUrl}${sep}t=${Date.now()}`;
    }

    preload(url) {
      return new Promise((resolve, reject) => {
        const img = new Image();
        img.decoding = "async";
        img.crossOrigin = "anonymous";
        img.onload = () => resolve(img);
        img.onerror = (err) => reject(err);
        img.src = url;
      });
    }

    analyzeImage(img) {
      try {
        const sampleWidth = 64;
        const sampleHeight = 36;

        const canvas = document.createElement("canvas");
        canvas.width = sampleWidth;
        canvas.height = sampleHeight;

        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) {
          return {
            brightness: null,
            signature: null,
            analysis: "canvas context unavailable"
          };
        }

        ctx.drawImage(img, 0, 0, sampleWidth, sampleHeight);
        const { data } = ctx.getImageData(0, 0, sampleWidth, sampleHeight);

        let brightnessSum = 0;
        let count = 0;
        let signatureSum = 0;
        let signatureCount = 0;

        for (let y = 0; y < sampleHeight; y++) {
          for (let x = 0; x < sampleWidth; x++) {
            const i = (y * sampleWidth + x) * 4;
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];

            const brightness = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
            brightnessSum += brightness;
            count++;

            if (x % 4 === 0 && y % 4 === 0) {
              const signatureValue =
                brightness * 0.7 +
                (r / 255) * 0.1 +
                (g / 255) * 0.1 +
                (b / 255) * 0.1;

              signatureSum += signatureValue;
              signatureCount++;
            }
          }
        }

        if (!count || !signatureCount) {
          return {
            brightness: null,
            signature: null,
            analysis: "no pixels read"
          };
        }

        return {
          brightness: brightnessSum / count,
          signature: signatureSum / signatureCount,
          analysis: "canvas ok"
        };
      } catch (e) {
        return {
          brightness: null,
          signature: null,
          analysis: `canvas blocked: ${e && e.message ? e.message : "unknown error"}`
        };
      }
    }

    brightnessToOverlay(brightness) {
      if (brightness === null || Number.isNaN(brightness)) {
        return this.defaultOverlay;
      }

      let overlay;
      if (brightness < 0.30) overlay = 0.08;
      else if (brightness < 0.45) overlay = 0.10;
      else if (brightness < 0.60) overlay = 0.12;
      else if (brightness < 0.72) overlay = 0.14;
      else if (brightness < 0.82) overlay = 0.17;
      else overlay = 0.20;

      return Math.max(this.minOverlay, Math.min(this.maxOverlay, overlay));
    }

    smoothOverlay(targetOverlay) {
      return (
        this.currentOverlayLevel * (1 - this.overlaySmoothingFactor) +
        targetOverlay * this.overlaySmoothingFactor
      );
    }

    clampOpacity(value) {
      if (!Number.isFinite(value)) return 0;
      return Math.max(0, Math.min(1, value));
    }

    buildOverlayBackground(level) {
      const base = this.clampOpacity(level);
      if (!this.vignetteEnabled) {
        return `rgba(0, 0, 0, ${base})`;
      }

      const edge = this.clampOpacity(this.vignetteOpacity);
      const shoulder = this.clampOpacity(edge * 0.55);
      const size = Math.max(1, Math.round(this.vignetteSize));
      const soft = Math.max(size + 1, Math.round(size * 2.1));

      return `
          linear-gradient(to right,
            rgba(0, 0, 0, ${edge}) 0,
            rgba(0, 0, 0, ${shoulder}) ${size}px,
            transparent ${soft}px,
            transparent calc(100% - ${soft}px),
            rgba(0, 0, 0, ${shoulder}) calc(100% - ${size}px),
            rgba(0, 0, 0, ${edge}) 100%),
          linear-gradient(to bottom,
            rgba(0, 0, 0, ${edge}) 0,
            rgba(0, 0, 0, ${shoulder}) ${size}px,
            transparent ${soft}px,
            transparent calc(100% - ${soft}px),
            rgba(0, 0, 0, ${shoulder}) calc(100% - ${size}px),
            rgba(0, 0, 0, ${edge}) 100%),
          rgba(0, 0, 0, ${base})`;
    }

    setOverlay(level) {
      this.currentOverlayLevel = level;
      this.overlay.style.background = this.buildOverlayBackground(level);
    }

    hasMeaningfulImageChange(brightness, signature) {
      if (
        this.lastBrightness === null ||
        this.lastSignature === null ||
        brightness === null ||
        signature === null
      ) {
        return true;
      }

      const brightnessDelta = Math.abs(brightness - this.lastBrightness);
      const signatureDelta = Math.abs(signature - this.lastSignature);

      return (
        brightnessDelta >= this.minBrightnessDelta ||
        signatureDelta >= this.minSignatureDelta
      );
    }

    updateStoredImageMetrics(brightness, signature) {
      if (brightness !== null && !Number.isNaN(brightness)) {
        this.lastBrightness = brightness;
      }
      if (signature !== null && !Number.isNaN(signature)) {
        this.lastSignature = signature;
      }
    }

    async loadInitialImage() {
      const url = this.buildUrl();

      try {
        this.log("Initial load started", { url });

        const img = await this.preload(url);
        const analysis = this.analyzeImage(img);

        const targetOverlay = this.brightnessToOverlay(analysis.brightness);
        const smoothedOverlay = this.smoothOverlay(targetOverlay);

        this.layers[0].style.backgroundImage = `url("${img.src}")`;
        this.layers[0].classList.add("visible");
        this.activeIndex = 0;
        this.started = true;

        this.setOverlay(smoothedOverlay);
        this.updateStoredImageMetrics(analysis.brightness, analysis.signature);

        this.log("Initial load complete", {
          url: img.src,
          brightness: analysis.brightness,
          signature: analysis.signature,
          targetOverlay,
          smoothedOverlay,
          analysis: analysis.analysis
        });
      } catch (err) {
        this.log("Initial load failed", {
          url,
          error: err && err.message ? err.message : err
        });
        console.error("Background initial load failed:", err);
      }
    }

    async updateImage(trigger = "manual") {
      if (!this.started || this.updateInProgress) return;
      this.updateInProgress = true;

      const nextIndex = this.activeIndex === 0 ? 1 : 0;
      const currentLayer = this.layers[this.activeIndex];
      const nextLayer = this.layers[nextIndex];
      const url = this.buildUrl();

      try {
        this.log("Update started", { trigger, url, nextIndex });

        const img = await this.preload(url);
        const analysis = this.analyzeImage(img);

        const targetOverlay = this.brightnessToOverlay(analysis.brightness);
        const smoothedOverlay = this.smoothOverlay(targetOverlay);

        if (
          this.skipUnchanged &&
          !this.hasMeaningfulImageChange(analysis.brightness, analysis.signature)
        ) {
          this.setOverlay(smoothedOverlay);

          this.log("Update skipped visually", {
            trigger,
            brightness: analysis.brightness,
            signature: analysis.signature,
            targetOverlay,
            smoothedOverlay,
            analysis: analysis.analysis
          });
          return;
        }

        nextLayer.style.backgroundImage = `url("${img.src}")`;

        requestAnimationFrame(() => {
          this.setOverlay(smoothedOverlay);
          nextLayer.classList.add("visible");
          currentLayer.classList.remove("visible");
          this.activeIndex = nextIndex;

          this.updateStoredImageMetrics(analysis.brightness, analysis.signature);

          this.log("Update complete", {
            trigger,
            url: img.src,
            brightness: analysis.brightness,
            signature: analysis.signature,
            targetOverlay,
            smoothedOverlay,
            analysis: analysis.analysis,
            activeIndex: this.activeIndex
          });
        });
      } catch (err) {
        this.log("Update failed", {
          trigger,
          url,
          error: err && err.message ? err.message : err
        });
        console.error("Background update failed, keeping previous image:", err);
      } finally {
        this.updateInProgress = false;
      }
    }
  }

  function findElementDeep(root, tagName) {
    if (!root) return null;

    const nodes = root.querySelectorAll ? root.querySelectorAll("*") : [];
    for (const el of nodes) {
      if (el.tagName === tagName.toUpperCase()) return el;
      if (el.shadowRoot) {
        const found = findElementDeep(el.shadowRoot, tagName);
        if (found) return found;
      }
    }
    return null;
  }

  function getCurrentLovelaceConfig() {
    const ha = document.querySelector("home-assistant");
    if (!ha || !ha.shadowRoot) return null;

    const huiRoot = findElementDeep(ha.shadowRoot, "hui-root");
    if (!huiRoot) return null;

    return huiRoot.lovelace?.config || null;
  }

  class HABackgroundLoaderManager {
    constructor() {
      this.loader = null;
      this.currentConfigKey = null;

      this.start();
    }

    start() {
      this.evaluate();

      this.navObserver = new MutationObserver(() => {
        this.evaluate();
      });

      this.navObserver.observe(document.documentElement, {
        childList: true,
        subtree: true,
      });

      window.addEventListener("location-changed", () => this.evaluate());
      window.addEventListener("popstate", () => this.evaluate());

      setInterval(() => this.evaluate(), 2000);
    }

    buildConfigKey(config) {
      return JSON.stringify(config || null);
    }

    evaluate() {
      const lovelaceConfig = getCurrentLovelaceConfig();
      const bgConfig = lovelaceConfig?.bg_loader;

      if (!bgConfig || bgConfig.enabled !== true) {
        if (this.loader) {
          this.loader.destroy();
          this.loader = null;
          this.currentConfigKey = null;
          console.log("[HA Background V5.3] Disabled for this dashboard");
        }
        return;
      }

      const newKey = this.buildConfigKey(bgConfig);
      if (this.loader && this.currentConfigKey === newKey) {
        return;
      }

      if (this.loader) {
        this.loader.destroy();
        this.loader = null;
      }

      this.currentConfigKey = newKey;
      this.loader = new HABackgroundLoader(bgConfig);
      console.log("[HA Background V5.3] Enabled for this dashboard", bgConfig);
    }
  }

  const start = () => new HABackgroundLoaderManager();

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})();
