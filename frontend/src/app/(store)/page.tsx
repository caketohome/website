import { cookies } from "next/headers";
import { PageRenderer } from "../../components/store/cms/page-renderer";
import { StorefrontProductHomepage } from "../../components/store/home/storefront-product-homepage";
import { getHomepage } from "../../lib/data/cms";
import { listProducts, listPimCategories, listOccasions } from "../../lib/data/catalog";
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
  const [allProducts, allCategories, occasions] = await Promise.all([
    listProducts({ branchId, pincode }),
    listPimCategories(),
    listOccasions(),
  ]);

  const sections = cms?.sections ?? [];
  const banners = cms?.banners ?? [];
  const announcementBar = "announcementBar" in cms ? cms.announcementBar : undefined;
  const defaultLuxuryTheme = {
    bg_color: "radial-gradient(ellipse at top right, #1d2d5a 0%, #142040 50%, #0c1326 100%)",
    text_color: "#FAF9F6",
    heading_color: "#FAF9F6",
    accent_color: "#D4AF37",
    font_family: "'Plus Jakarta Sans', sans-serif",
    heading_font: "'Playfair Display', serif",
    card_style: "luxury",
  };
  const theme = ("theme" in cms && cms.theme) ? cms.theme : (cms?.page as any)?.theme || defaultLuxuryTheme;

  return (
    <div className="flex flex-col gap-0 w-full overflow-x-clip selection:bg-[#B76E79]/30 selection:text-[#FAF9F6]">
      {/* Dynamic Published CMS Page Sections */}
      {sections.length > 0 ? (
        <PageRenderer
          sections={sections}
          banners={banners}
          allProducts={allProducts}
          allCategories={allCategories}
          occasions={occasions}
          announcementBar={announcementBar}
          theme={theme}
          h1={cms?.page?.h1 || cms?.page?.title}
          subheading={cms?.page?.subheading}
          introContent={cms?.page?.intro_content}
        />
      ) : (
        /* Fallback Storefront Catalog if no sections published */
        <StorefrontProductHomepage />
      )}
    </div>
  );
}
