/**
 * CakeToHome Core API - Dynamic Products & Customizer Domain Service (Phase 1 Feature 2)
 * Manages Dynamic Product Catalog, Unlimited Customization Option Groups, Price Modifiers,
 * Color Swatches, Image Swatches, and Branch-Specific Catalog Overrides.
 */

export interface OptionItemDto {
  id: string;
  name: string;
  priceModifier: string; // @db.Decimal(12,2)
  colorHex?: string;
  imageUrl?: string;
  isAvailable: boolean;
}

export interface OptionGroupDto {
  id: string;
  name: string;
  displayType: "DROPDOWN" | "RADIO" | "COLOR_SWATCH" | "TEXT_INPUT" | "FILE_UPLOAD";
  isRequired: boolean;
  isEnabled: boolean;
  displayOrder: number;
  options: OptionItemDto[];
}

export interface DynamicProductDto {
  id: string;
  title: string;
  slug: string;
  description: string;
  basePrice: string; // @db.Decimal(12,2)
  rating: number;
  reviewCount: number;
  isEggless: boolean;
  isBestseller: boolean;
  optionGroups: OptionGroupDto[];
}

export class ProductsService {
  private products: Map<string, DynamicProductDto> = new Map();

  constructor() {
    // Seed standard Rich Chocolate Truffle product with full option groups
    const truffleProduct: DynamicProductDto = {
      id: "prod_truffle_01",
      title: "Rich Chocolate Truffle Cake",
      slug: "rich-chocolate-truffle-cake",
      description: "Decadent Dutch cocoa cake layers with dark chocolate ganache and customizable toppings",
      basePrice: "699.00",
      rating: 4.9,
      reviewCount: 128,
      isEggless: true,
      isBestseller: true,
      optionGroups: [
        {
          id: "grp_cake_type",
          name: "Cake Type",
          displayType: "RADIO",
          isRequired: true,
          isEnabled: true,
          displayOrder: 1,
          options: [
            { id: "opt_egg", name: "With Egg", priceModifier: "0.00", isAvailable: true },
            { id: "opt_eggless", name: "100% Eggless", priceModifier: "50.00", isAvailable: true },
          ],
        },
        {
          id: "grp_weight",
          name: "Weight",
          displayType: "DROPDOWN",
          isRequired: true,
          isEnabled: true,
          displayOrder: 2,
          options: [
            { id: "opt_05kg", name: "500g (Serves 4-6)", priceModifier: "0.00", isAvailable: true },
            { id: "opt_1kg", name: "1kg (Serves 10-12)", priceModifier: "600.00", isAvailable: true },
            { id: "opt_15kg", name: "1.5kg (Serves 14-16)", priceModifier: "1100.00", isAvailable: true },
          ],
        },
        {
          id: "grp_cream_color",
          name: "Cream Color",
          displayType: "COLOR_SWATCH",
          isRequired: false,
          isEnabled: true,
          displayOrder: 3,
          options: [
            { id: "opt_color_white", name: "Classic White", priceModifier: "0.00", colorHex: "#FFFFFF", isAvailable: true },
            { id: "opt_color_pink", name: "Rose Pink", priceModifier: "30.00", colorHex: "#FFC0CB", isAvailable: true },
            { id: "opt_color_blue", name: "Sky Blue", priceModifier: "30.00", colorHex: "#87CEEB", isAvailable: true },
          ],
        },
        {
          id: "grp_custom_message",
          name: "Custom Message on Cake",
          displayType: "TEXT_INPUT",
          isRequired: false,
          isEnabled: true,
          displayOrder: 4,
          options: [
            { id: "opt_msg", name: "Icing Message (Max 35 Chars)", priceModifier: "0.00", isAvailable: true },
          ],
        },
        {
          id: "grp_photo_upload",
          name: "Edible Photo Print",
          displayType: "FILE_UPLOAD",
          isRequired: false,
          isEnabled: true,
          displayOrder: 5,
          options: [
            { id: "opt_photo", name: "Upload Edible Photo (+₹150)", priceModifier: "150.00", isAvailable: true },
          ],
        },
      ],
    };

    this.products.set(truffleProduct.id, truffleProduct);
  }

  async listProducts(): Promise<DynamicProductDto[]> {
    return Array.from(this.products.values());
  }

  async getProductBySlug(slug: string): Promise<DynamicProductDto | null> {
    return Array.from(this.products.values()).find((p) => p.slug === slug) || null;
  }

  calculateCustomizedPrice(basePriceStr: string, selectedOptionIds: string[]): string {
    let total = parseFloat(basePriceStr);
    for (const p of Array.from(this.products.values())) {
      for (const grp of p.optionGroups) {
        for (const opt of grp.options) {
          if (selectedOptionIds.includes(opt.id)) {
            total += parseFloat(opt.priceModifier);
          }
        }
      }
    }
    return total.toFixed(2);
  }
}
