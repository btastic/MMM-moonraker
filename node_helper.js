/* Magic Mirror
 * Node Helper: MMM-moonraker
 *
 * By Ben Konsemüller
 * MIT Licensed.
 */

const Log = require("logger");
const NodeHelper = require("node_helper");
const fetch = require("fetch");
const moment = require("moment");

module.exports = NodeHelper.create({
  config: {},
  currentFile: null,
  metadata: null,
  async socketNotificationReceived(notification, payload) {
    if (notification === "CONFIG") {
      this.config = payload;

      if (this.fetchTimerId) {
        clearTimeout(this.fetchTimerId);
      }

      await this.fetchData();
    }
  },

  async fetchData() {
    const self = this;

    const printer_status = await this.fetchPrinterStatus();
    let metadata = null;

    if (!printer_status) {
      return;
    }

    if (this.currentFile !== printer_status.print_stats.filename) {
      this.currentFile = printer_status.print_stats.filename;
      metadata = await this.fetchMetadata(printer_status);
    }

    const thumbnail = metadata?.thumbnails[0].relative_path;

    const eta = await this.calculateEta(printer_status, metadata);

    this.sendSocketNotification("PRINTER_STATUS", { printer_status, metadata, eta, thumbnail });

    this.fetchTimerId = setTimeout(async function () {
      await self.fetchData();
    }, this.config.updateInterval);
  },

  async fetchPrinterStatus() {
    const endpoint = this.config.endpoint + "/printer/objects/query?print_stats&virtual_sdcard&extruder&heater_bed";

    try {
      const response = await fetch(endpoint);
      const json = await response.json();

      return json.result.status;
    } catch (error) {
      Log.log(`${this.name} received an error: ${error}`);
      this.sendSocketNotification("HTTP_ERROR", {});

      return null;
    }
  },

  async fetchMetadata(printer_status) {
    if (!printer_status.print_stats.filename) {
      return;
    }

    const endpoint = this.config.endpoint + "/server/files/metadata?filename=" + printer_status.print_stats.filename;

    try {
      const response = await fetch(endpoint);
      const json = await response.json();

      // join up the final thumbnail url for convenience
      if (json.result.thumbnails) {
        for (let index = 0; index < json.result.thumbnails.length; index++) {
          const element = json.result.thumbnails[index];
          element.relative_path = this.config.endpoint + "/server/files/gcodes/" + element.relative_path;
        }

        // sort thumbnails by width so the first one is the larger one
        json.result.thumbnails.sort(function (a, b) { return b.width - a.width });
      }
      
      if (!json.result.thumbnails || json.result.thumbnails.length === 0) {
        json.result.thumbnails = [{ relative_path: "./modules/MMM-moonraker/img/no_thumbnail.png" }];
      }

      return json.result;
    } catch (error) {
      Log.log(`${this.name} received an error: ${error}`);
      this.sendSocketNotification("HTTP_ERROR", {});

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
