import { StorefrontProductHomepage } from "@frontend/components/store/home/storefront-product-homepage";
import { HomepageSectionRenderer } from "@frontend/components/store/cms/homepage-section-renderer";
import { getHomepage } from "@frontend/lib/data/cms";

export default async function Home() {
  const cms = await getHomepage().catch(() => ({ sections: [], banners: [] }));

  const sections = cms?.sections ?? [];
  const banners = cms?.banners ?? [];

  return (
    <div className="flex flex-col gap-12">
      {/* Dynamic CMS sections if configured */}
      {sections.length > 0 && (
        <div className="flex flex-col gap-12">
          {sections.map((section) => (
            <HomepageSectionRenderer
              key={section.id}
              section={section}
              banners={banners}
            />
          ))}
        </div>
      )}

      {/* Main Single-Brand CakeToHome Product Storefront */}
      <StorefrontProductHomepage />
    </div>
  );
}
