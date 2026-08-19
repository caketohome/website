import { getCmsPage } from "@frontend/lib/data/cms";
import { listProducts, listPimCategories, listOccasions } from "@frontend/lib/data/catalog";
import { PageRenderer } from "@frontend/components/store/cms/page-renderer";
import { BreadcrumbJsonLd } from "@frontend/components/store/seo/json-ld";
import { SeoMetadataBuilder } from "@frontend/lib/seo/metadata-builder";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const page = await getCmsPage(params.slug);
  if (!page) return {};

  return SeoMetadataBuilder.buildMetadata({
    entityType: "cms",
    slug: params.slug,
    fallbackTitle: page.meta_title || page.title,
    fallbackDescription: page.meta_description || page.intro_content || undefined,
    fallbackImage: page.og_image || undefined,
  });
}

export default async function CmsPageRoute({
  params,
}: {
  params: { slug: string };
}) {
  const page = await getCmsPage(params.slug);
  if (!page) notFound();

  const [allProducts, allCategories, occasions] = await Promise.all([
    listProducts(),
    listPimCategories(),
    listOccasions(),
  ]);
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://cakes2home.com";
  const pageUrl = `${baseUrl}/${params.slug}`;

  const sections = Array.isArray(page.sections) ? page.sections : [];

  return (
    <article className="flex flex-col gap-8 w-full max-w-7xl mx-auto px-4 py-6">
      <BreadcrumbJsonLd
        crumbs={[
          { name: "Home", url: baseUrl },
          { name: page.breadcrumb_title || page.title, url: pageUrl },
        ]}
      />

      {sections.length > 0 ? (
        <PageRenderer
          sections={sections}
          allProducts={allProducts}
          allCategories={allCategories}
          occasions={occasions}
          announcementBar={page.announcement_bar}
          h1={page.h1 || page.title}
          subheading={page.subheading}
          introContent={page.intro_content}
        />
      ) : (
        <div className="prose dark:prose-invert max-w-none">
          <h1 className="text-3xl font-bold">{page.h1 || page.title}</h1>
          {page.subheading && (
            <p className="text-lg text-muted-foreground">{page.subheading}</p>
          )}
          {page.intro_content && (
            <div className="mt-4">{page.intro_content}</div>
          )}
        </div>
      )}
    </article>
  );
}
