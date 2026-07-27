import { MedusaContainer } from "@medusajs/framework";
import { LOCALIZATION_MODULE } from "../modules/localization";

/**
 * Background Job: sync-exchange-rates.
 *
 * Runs nightly at 01:00. Fetches exchange rates from a external rates service
 * (simulated) and updates localization currency conversion rates in the DB.
 */
export default async function syncExchangeRatesJob(args: any) {
  const container = args?.container || args;
  const locService = container.resolve(LOCALIZATION_MODULE) as any;

  try {
    const currencies = await locService.listCurrencies();

    // Exchange rates provider simulation (e.g. USD, EUR, INR base conversions)
    const simulatedRates: Record<string, number> = {
      USD: 1.0,
      EUR: 0.92,
      INR: 83.5,
      GBP: 0.78,
    };

    for (const currency of currencies) {
      if (currency.is_default) {
        continue;
      }

      const freshRate = simulatedRates[currency.code];
      if (freshRate !== undefined) {
        await locService.updateCurrencies({
          id: currency.id,
          rate: freshRate,
        });
        console.info(`Synced currency rate for ${currency.code}: ${freshRate}`);
      }
    }
  } catch (err) {
    console.error("Failed to execute sync-exchange-rates background job:", err);
  }
}

export const config = {
  name: "sync-exchange-rates",
  schedule: "0 1 * * *", // 01:00 daily
};
