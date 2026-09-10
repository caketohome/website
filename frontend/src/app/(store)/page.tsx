import { cookies } from "next/headers";
import { LuxuryStorefront } from "../../components/store/home/luxury-storefront";
import { getHomepage } from "../../lib/data/cms";
import { listProducts, listPimCategories, listOccasions, listPublicOffers } from "../../lib/data/catalog";
import { SeoMetadataBuilder } from "../../lib/seo/metadata-builder";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function generateMetadata(): Promise<Metadata> {
  const cms = await getHomepage().catch(() => ({ page: null, sections: [], banners: [] }));
  const page = cms.page;

  return SeoMetadataBuilder.buildMetadata({
    entityType: "page",
    slug: "/",
    fallbackTitle: page?.meta_title || "Online Cakes & Cake Delivery in Bangalore | CakeToHome",
    fallbackDescription: page?.meta_description || "Order fresh handcrafted artisanal cakes online in Bangalore with same-day and midnight delivery. Custom birthday cakes, anniversary cakes, and gourmet pastries.",
    fallbackImage: page?.og_image || undefined,
  });
}

export default async function Home() {
  const cookieStore = cookies();
  const branchId = cookieStore.get("_cth_branch_id")?.value;
  const pincode = cookieStore.get("_cth_pincode")?.value;

  const cms = await getHomepage().catch(() => ({ page: null, sections: [], banners: [] }));
  const [allProducts, allCategories, occasions, allOffers] = await Promise.all([
    listProducts({ branchId, pincode }),
    listPimCategories(),
    listOccasions(),
    listPublicOffers(),
  ]);

  const sections = cms?.sections ?? [];
  const banners = cms?.banners ?? [];
  const announcementBar = "announcementBar" in cms ? cms.announcementBar : undefined;

  return (
    <div className="flex flex-col gap-0 w-full overflow-x-clip">
      <LuxuryStorefront 
        sections={sections}
        banners={banners}
        allProducts={allProducts}
        allCategories={allCategories}
        occasions={occasions}
        announcementBar={announcementBar}
      />
    </div>
  );
}
