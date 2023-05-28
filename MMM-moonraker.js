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

  // hold timer id
  fetchTimerId: null,
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
    if (this.fetchTimerId) {
      clearTimeout(this.fetchTimerId);
    }

    this.fetchData();
  },


  getTemplate: function () {
    return "templates/"+this.name+".njk";
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
      this.name+".css"
    ];
  },

  getTranslations: function () {
    return {
      en: "translations/en.json",
      de: "translations/de.json",
    };
  },

  async fetchData() {
    const self = this;

    const printer_status = await this.fetchPrinterStatus();
    if(printer_status){
      if (this.currentFile !== printer_status.print_stats.filename) {
        this.currentFile = printer_status.print_stats.filename;
        this.metadata = await this.fetchMetadata(printer_status);
      }

      const eta = await this.calculateEta(printer_status, this.metadata);

      this.process_return("PRINTER_STATUS", { printer_status, metadata: this.metadata, eta });

      this.fetchTimerId = setTimeout(async function () {
        await self.fetchData();
      }, this.config.updateInterval);
    }
  },


  async fetchPrinterStatus() {
    const endpoint = this.config.endpoint + "/printer/objects/query?print_stats&virtual_sdcard&extruder&heater_bed";

    try {
      const response = await fetch(endpoint);
      const json = await response.json();

      return json.result.status;
    } catch (error) {
      Log.log(`${this.name} received an error: ${error}`);

      this.process_return("HTTP_ERROR", {});

      return null;
    }
  },

  process_return(notification, payload){
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

  async fetchMetadata(printer_status) {
    const endpoint = this.config.endpoint + "/server/files/metadata?filename=" + printer_status.print_stats.filename;

    try {
      const response = await fetch(endpoint);
      const json = await response.json();

      // join up the final thumbnail url for convenience
      for (let index = 0; index < json.result.thumbnails.length; index++) {
        const element = json.result.thumbnails[index];
        element.relative_path = this.config.endpoint + "/server/files/gcodes/" + element.relative_path;
      }

      // sort thumbnails by width so the first one is the larger one
      json.result.thumbnails.sort(function (a, b) { return b.width - a.width });

      return json.result;
    } catch (error) {
      Log.log(`${this.name} received an error: ${error}`);
      this.process_return("HTTP_ERROR", {});

      return null;
    }
  },

  calculateEta(printer_status, metadata) {
    if (printer_status.print_stats.state !== 'printing') {
      return null;
    }

    if (metadata && metadata.estimated_time) {
      const progressTime = printer_status.virtual_sdcard.progress * metadata.estimated_time;
      return moment.utc(1000 * (metadata.estimated_time - progressTime)).format('HH[h] mm[m] ss[s]');;
    }

    const total_time = printer_status.print_stats.print_duration / printer_status.virtual_sdcard.progress;
    return moment.utc(1000 * (total_time - printer_status.print_stats.print_duration)).format('HH[h] mm[m] ss[s]');
  },
});
