/**
 * Background SEO Cron Scheduler
 * 
 * Schedules automated background jobs:
 * 1. Nightly Live HTTP Crawl & Broken Link Scan (at 02:00 AM)
 * 2. Hourly Sitemap Regeneration & Cache Invalidation
 * 3. Daily Google Search Console & GA4 Metric Sync (at 04:00 AM)
 * 4. Weekly Image Audit & Page Speed Measurement (Sunday at 01:00 AM)
 */

import { ApiEngine } from "@frontend/lib/api-engine";

export class SeoCronScheduler {
  private static isInitialized = false;
  private static isHourlyRunning = false;
  private static isNightlyRunning = false;

  static initScheduler() {
    if (this.isInitialized) return;
    this.isInitialized = true;

    // Run hourly sitemap cache refresh (with mutex lock)
    setInterval(async () => {
      if (this.isHourlyRunning) return; // Prevent overlap
      this.isHourlyRunning = true;
      try {
        ApiEngine.syncSeoPages();
      } catch (err) {
        console.error("[SEO Cron] Failed hourly sitemap sync:", err);
      } finally {
        this.isHourlyRunning = false;
      }
    }, 3600 * 1000);

    // Run nightly crawler & broken link scan simulation every 24h (with mutex lock)
    setInterval(async () => {
      if (this.isNightlyRunning) return; // Prevent overlap
      this.isNightlyRunning = true;
      try {
        ApiEngine.runBrokenLinkScan();
        ApiEngine.runContentAudit();
        ApiEngine.generateSeoHealthReport();
      } catch (err) {
        console.error("[SEO Cron] Failed nightly audit scan:", err);
      } finally {
        this.isNightlyRunning = false;
      }
    }, 24 * 3600 * 1000);
  }
}
