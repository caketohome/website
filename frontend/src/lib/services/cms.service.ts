import { CmsRepository } from "../repositories/cms.repository";
import { CmsPageDomain } from "../types/domain";

export class CmsService {
  /**
   * Get all published CMS pages
   */
  static async getPages(): Promise<CmsPageDomain[]> {
    const pages = await CmsRepository.findAllPages();
    return pages.filter((p) => p.status === "published");
  }

  /**
   * Get single CMS page by slug
   */
  static async getPageBySlug(slug: string): Promise<CmsPageDomain | null> {
    return CmsRepository.findPageBySlug(slug);
  }

  /**
   * Save / update CMS page (draft or published)
   */
  static async savePage(page: Partial<CmsPageDomain>): Promise<void> {
    await CmsRepository.savePage(page);
  }

  /**
   * Delete CMS page
   */
  static async deletePage(id: string): Promise<void> {
    await CmsRepository.deletePage(id);
  }
}
