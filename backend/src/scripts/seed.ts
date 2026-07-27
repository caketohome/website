import {
  createApiKeysWorkflow,
  createProductCategoriesWorkflow,
  createRegionsWorkflow,
  createSalesChannelsWorkflow,
  createShippingOptionsWorkflow,
  createShippingProfilesWorkflow,
  createStockLocationsWorkflow,
  createTaxRegionsWorkflow,
  linkSalesChannelsToApiKeyWorkflow,
  updateStoresWorkflow,
} from "@medusajs/core-flows";
import { Logger } from "@medusajs/medusa";

import { ExecArgs } from "@medusajs/types";
import {
  ContainerRegistrationKeys,
  ModuleRegistrationName,
  Modules,
  ProductStatus,
} from "@medusajs/utils";
import dotenv from "dotenv";
import cakeToHomeSeedData from "../../data/caketohome-seed-data.json";
import { createShopWorkflow } from "../workflows/shop/workflows/create-shop";
import { createShopProductsWorkflow } from "../workflows/shop/workflows/create-shop-products";

dotenv.config();

const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000";

export default async function seedData({ container }: ExecArgs) {
  const logger: Logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  const remoteLink: any = container.resolve(
    ContainerRegistrationKeys.REMOTE_LINK
  );
  const fulfillmentModuleService = container.resolve(
    ModuleRegistrationName.FULFILLMENT
  );
  const salesChannelModuleService = container.resolve(
    ModuleRegistrationName.SALES_CHANNEL
  );
  const storeModuleService = container.resolve(ModuleRegistrationName.STORE);

  const countries = ["gb", "de", "dk", "se", "fr", "es", "it"];

  logger.info("Seeding store data...");
  const [store] = await storeModuleService.listStores();
  let defaultSalesChannel = await salesChannelModuleService.listSalesChannels({
    name: "Default Sales Channel",
  });

  if (!defaultSalesChannel.length) {
    // create the default sales channel
    const { result: salesChannelResult } = await createSalesChannelsWorkflow(
      container
    ).run({
      input: {
        salesChannelsData: [
          {
            name: "Default Sales Channel",
          },
        ],
      },
    });
    defaultSalesChannel = salesChannelResult;
  }

  await updateStoresWorkflow(container).run({
    input: {
      selector: { id: store.id },
      update: {
        supported_currencies: [
          {
            currency_code: "eur",
            is_default: true,
          },
          {
            currency_code: "usd",
          },
        ],
        default_sales_channel_id: defaultSalesChannel[0].id,
      },
    },
  });
  let region: any;
  try {
    logger.info("Seeding region data...");
    const { result: regionResult } = await createRegionsWorkflow(container).run({
      input: {
        regions: [
          {
            name: "Europe",
            currency_code: "eur",
            countries,
            payment_providers: ["pp_system_default"],
          },
        ],
      },
    });
    region = regionResult[0];
    logger.info("Finished seeding regions.");
  } catch (err: any) {
    logger.warn(`Region seeding skipped: ${err.message}`);
    const regionService = container.resolve(ModuleRegistrationName.REGION);
    const existing = await regionService.listRegions({ name: "Europe" });
    region = existing[0];
  }

  try {
    logger.info("Seeding tax regions...");
    await createTaxRegionsWorkflow(container).run({
      input: countries.map((country_code) => ({
        country_code,
      })),
    });
    logger.info("Finished seeding tax regions.");
  } catch (err: any) {
    logger.warn(`Tax region seeding skipped: ${err.message}`);
  }

  logger.info("Seeding fulfillment data...");
  const { result: shippingProfileResult } =
    await createShippingProfilesWorkflow(container).run({
      input: {
        data: [
          {
            name: "Default",
            type: "default",
          },
        ],
      },
    });
  const shippingProfile = shippingProfileResult[0];

  const fulfillmentSet = await fulfillmentModuleService.createFulfillmentSets({
    name: "European Warehouse delivery",
    type: "shipping",
    service_zones: [
      {
        name: "Europe",
        geo_zones: [
          {
            country_code: "gb",
            type: "country",
          },
          {
            country_code: "de",
            type: "country",
          },
          {
            country_code: "dk",
            type: "country",
          },
          {
            country_code: "se",
            type: "country",
          },
          {
            country_code: "fr",
            type: "country",
          },
          {
            country_code: "es",
            type: "country",
          },
          {
            country_code: "it",
            type: "country",
          },
        ],
      },
    ],
  });

  logger.info("Seeding stock location data...");
  const { result: stockLocationResult } = await createStockLocationsWorkflow(
    container
  ).run({
    input: {
      locations: [
        {
          name: "European Warehouse",
          address: {
            city: "Copenhagen",
            country_code: "DK",
            address_1: "",
          },
        },
      ],
    },
  });
  const stockLocation = stockLocationResult[0];

  const fulfillmentProvider = await fulfillmentModuleService
    .listFulfillmentProviders({}, { take: 1 })
    .then((res) => res[0]);

  const fulfillmentProviderId = fulfillmentProvider.id;

  await remoteLink.create([
    {
      [Modules.STOCK_LOCATION]: {
        stock_location_id: stockLocation.id,
      },
      [Modules.FULFILLMENT]: {
        fulfillment_set_id: fulfillmentSet.id,
      },
    },
    {
      [Modules.STOCK_LOCATION]: {
        stock_location_id: stockLocation.id,
      },
      [Modules.FULFILLMENT]: {
        fulfillment_provider_id: fulfillmentProviderId,
      },
    },
    {
      [Modules.SALES_CHANNEL]: {
        sales_channel_id: fulfillmentSet.id,
      },
      [Modules.STOCK_LOCATION]: {
        stock_location_id: stockLocation.id,
      },
    },
  ]);

  logger.info("Finished seeding stock location data.");

  await createShippingOptionsWorkflow(container).run({
    input: [
      {
        name: "Standard Shipping",
        price_type: "flat",
        provider_id: fulfillmentProviderId,
        service_zone_id: fulfillmentSet.service_zones[0].id,
        shipping_profile_id: shippingProfile.id,
        type: {
          label: "Standard",
          description: "Ship in 2-3 days.",
          code: "standard",
        },
        prices: [
          {
            currency_code: "usd",
            amount: 10,
          },
          {
            currency_code: "eur",
            amount: 10,
          },
          {
            region_id: region.id,
            amount: 10,
          },
        ],
        rules: [
          {
            attribute: "enabled_in_store",
            value: '"true"',
            operator: "eq",
          },
          {
            attribute: "is_return",
            value: "false",
            operator: "eq",
          },
        ],
      },
      {
        name: "Express Shipping",
        price_type: "flat",
        provider_id: fulfillmentProviderId,
        service_zone_id: fulfillmentSet.service_zones[0].id,
        shipping_profile_id: shippingProfile.id,
        type: {
          label: "Express",
          description: "Ship in 24 hours.",
          code: "express",
        },
        prices: [
          {
            currency_code: "usd",
            amount: 10,
          },
          {
            currency_code: "eur",
            amount: 10,
          },
          {
            region_id: region.id,
            amount: 10,
          },
        ],
        rules: [
          {
            attribute: "enabled_in_store",
            value: '"true"',
            operator: "eq",
          },
          {
            attribute: "is_return",
            value: "false",
            operator: "eq",
          },
        ],
      },
    ],
  });
  logger.info("Finished seeding fulfillment data.");

  logger.info("Seeding publishable API key data...");
  const { result: publishableApiKeyResult } = await createApiKeysWorkflow(
    container
  ).run({
    input: {
      api_keys: [
        {
          title: "Webshop",
          type: "publishable",
          created_by: "",
        },
      ],
    },
  });
  const publishableApiKey = publishableApiKeyResult[0];

  await linkSalesChannelsToApiKeyWorkflow(container).run({
    input: {
      id: publishableApiKey.id,
      add: [defaultSalesChannel[0].id],
    },
  });
  logger.info("Finished seeding publishable API key data.");

  logger.info("Seeding shop data...");
  const { shop } = cakeToHomeSeedData;

  shop.image_url = FRONTEND_URL + shop.image_url;

  const { result: createdShop } = await createShopWorkflow(
    container
  ).run({
    input: {
      shop,
    },
  });

  logger.info("Seeding product data...");

  const { result: categoryResult } = await createProductCategoriesWorkflow(
    container
  ).run({
    input: {
      product_categories: cakeToHomeSeedData.categories,
    },
  });

  const productData = cakeToHomeSeedData.products.map((product) => {
    const { id } = categoryResult.find((c) => c.handle === product.category);
    const category_id = id;
    const optionValues = Array.from(new Set(product.variants.map((v) => v.title.includes("1kg") ? "1kg" : "Standard")));
    const options = [{ title: "Size", values: optionValues }];
    const variants = product.variants.map((v) => ({
      ...v,
      options: {
        Size: v.title.includes("1kg") ? "1kg" : "Standard",
      },
    }));

    return {
      title: product.title,
      handle: product.handle,
      description: product.description,
      is_giftcard: product.is_giftcard,
      thumbnail: FRONTEND_URL + product.thumbnail,
      category_ids: [category_id],
      status: ProductStatus.PUBLISHED,
      sales_channels: [
        {
          id: defaultSalesChannel[0].id,
        },
      ],
      options,
      variants,
    };
  });

  await createShopProductsWorkflow(container).run({
    input: {
      products: productData,
      shop_id: createdShop.id,
    },
  });

  logger.info("Finished seeding product data.");
}
