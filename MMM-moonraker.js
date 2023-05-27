/* global Module */

/* Magic Mirror
 * Module: MMM-moonraker
 *
 * By Ben Konsemüller
 * MIT Licensed.
 */

Module.register("MMM-moonraker", {
  defaults: {
    updateInterval: 60000,
    endpoint: "",
    showThumbnail: true,
    thumbnailSize: 150,
    hideDataOnStandby: true
  },

  // Store the data in an object.
  displayData: {
    printer_status: null,
    eta: null,
    thumbnails: [],
  },

  available: true,
  loading: true,

  requiresVersion: "2.1.0", // Required version of MagicMirror

  start: function () {
    Log.info(`Starting module: ${this.name}`);
    this.sendSocketNotification("CONFIG", this.config);
  },

  socketNotificationReceived: function (notification, payload) {
    switch (notification) {
      case "PRINTER_STATUS":
        this.displayData = payload;
        this.available = true;
        this.loading = false;
        break;
      case "HTTP_ERROR":
        this.loading = false;
        this.available = false;
        break;
    }
    this.updateDom(this.config.animationSpeed);
  },

  getTemplate: function () {
    return "templates\\mmm-moonraker.njk";
  },

  getTemplateData() {
    const templateData = {
      loading: this.loading,
      config: this.config,
      data: this.loading ? null : this.displayData.printer_status,
      eta: this.loading ? null : this.displayData.eta,
      thumbnails: this.loading ? [] : this.displayData.metadata?.thumbnails,
      available: this.available,
    };

    return templateData;
  },

  getScripts: function () {
    return [];
  },

  getStyles: function () {
    return [
      "MMM-moonraker.css",
    ];
  },

  getTranslations: function () {
    return {
      en: "translations/en.json",
      de: "translations/de.json",
    };
  },
});
