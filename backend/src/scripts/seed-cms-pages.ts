import { Logger } from "@medusajs/medusa";
import { ContainerRegistrationKeys } from "@medusajs/utils";
import { ExecArgs } from "@medusajs/types";
import dotenv from "dotenv";
import { CMS_MODULE } from "../modules/cms";

dotenv.config();

/**
 * Seeds the standard static CMS pages + a default footer navigation for
 * CakeToHome. Idempotent — skips pages that already exist by slug.
 *
 * Run with: `npx medusa exec ./src/scripts/seed-cms-pages.ts`
 *
 * Pages seeded (type=static, status=published):
 *   about, contact, privacy, terms, refund-policy, shipping-policy, faq,
 *   careers, franchise
 *
 * Navigation seeded:
 *   footer — About, Privacy, Terms, Refund Policy, FAQ
 */
export default async function seedCmsPages({ container }: ExecArgs) {
    const logger: Logger = container.resolve(ContainerRegistrationKeys.LOGGER);
    const cmsModule = container.resolve(CMS_MODULE) as {
        createPage: (input: Record<string, unknown>) => Promise<{ id: string }>;
        listCmsPages: (filters: Record<string, unknown>) => Promise<Array<{ slug: string }>>;
        publishPage: (id: string, author?: string | null) => Promise<unknown>;
        createNavigation: (input: Record<string, unknown>) => Promise<{ id: string }>;
        listCmsNavigations: (filters: Record<string, unknown>) => Promise<Array<{ name: string }>>;
    };

    interface PageSeed {
        slug: string;
        title: string;
        meta_title: string;
        meta_description: string;
        excerpt: string;
        blocks: Array<{ type: string; content: string }>;
    }

    const pages: PageSeed[] = [
        {
            slug: "about",
            title: "About CakeToHome",
            meta_title: "About CakeToHome — Premium Cake & Bakery Ordering",
            meta_description:
                "CakeToHome is an online cake ordering platform delivering premium cakes and bakery products to your doorstep across multiple cities.",
            excerpt:
                "CakeToHome connects you with the best bakeries for premium cakes, delivered fresh to your door.",
            blocks: [
                { type: "heading", content: "Our Story" },
                {
                    type: "paragraph",
                    content:
                        "CakeToHome is an online cake ordering platform that brings premium cakes and bakery products right to your doorstep. We partner with trusted bakeries across multiple cities to deliver freshly baked cakes for every occasion.",
                },
                { type: "heading", content: "What We Do" },
                {
                    type: "paragraph",
                    content:
                        "We handle the ordering, delivery, and customer experience — so you can focus on celebrating. From birthdays to weddings to corporate events, CakeToHome makes ordering the perfect cake effortless.",
                },
            ],
        },
        {
            slug: "contact",
            title: "Contact Us",
            meta_title: "Contact CakeToHome — Support & Enquiries",
            meta_description:
                "Get in touch with CakeToHome for order support, custom cake enquiries, bulk orders, and partnership opportunities.",
            excerpt: "We're here to help with orders, custom cakes, and partnerships.",
            blocks: [
                { type: "heading", content: "Get in Touch" },
                {
                    type: "paragraph",
                    content:
                        "For order support, custom cake enquiries, bulk orders, or partnership opportunities, reach out to our customer experience team.",
                },
                { type: "heading", content: "Customer Support" },
                {
                    type: "paragraph",
                    content:
                        "Email: support@caketohome.com\nPhone: Available 9 AM – 9 PM IST\nLive chat: Available in your account dashboard.",
                },
            ],
        },
        {
            slug: "privacy",
            title: "Privacy Policy",
            meta_title: "Privacy Policy — CakeToHome",
            meta_description:
                "How CakeToHome collects, uses, and protects your personal information when you order cakes online.",
            excerpt: "Your privacy matters. Learn how we handle your data.",
            blocks: [
                { type: "heading", content: "Privacy Policy" },
                {
                    type: "paragraph",
                    content:
                        "CakeToHome is committed to protecting your privacy. This policy describes how we collect, use, and safeguard your personal information when you use our platform to order cakes and bakery products.",
                },
                { type: "heading", content: "Information We Collect" },
                {
                    type: "paragraph",
                    content:
                        "We collect information you provide directly (name, phone, address, payment details) and information collected automatically (device, location, usage data) to fulfil orders and improve your experience.",
                },
                { type: "heading", content: "How We Use Your Information" },
                {
                    type: "paragraph",
                    content:
                        "We use your information to process orders, arrange delivery, provide customer support, send order notifications, and (with consent) marketing communications.",
                },
            ],
        },
        {
            slug: "terms",
            title: "Terms & Conditions",
            meta_title: "Terms & Conditions — CakeToHome",
            meta_description:
                "The terms governing your use of CakeToHome's online cake ordering and delivery platform.",
            excerpt: "The terms governing your use of CakeToHome.",
            blocks: [
                { type: "heading", content: "Terms & Conditions" },
                {
                    type: "paragraph",
                    content:
                        "By using CakeToHome, you agree to these terms. CakeToHome is an ordering and delivery platform; cakes are prepared and delivered by our partner bakeries.",
                },
                { type: "heading", content: "Orders & Payments" },
                {
                    type: "paragraph",
                    content:
                        "All orders are subject to availability and confirmation. Prices are inclusive of applicable taxes unless stated otherwise. Payment is required at the time of order placement.",
                },
                { type: "heading", content: "Delivery" },
                {
                    type: "paragraph",
                    content:
                        "Delivery times are estimates. We are not liable for delays caused by factors beyond our control. Scheduled and midnight delivery slots are subject to branch coverage.",
                },
            ],
        },
        {
            slug: "refund-policy",
            title: "Refund & Cancellation Policy",
            meta_title: "Refund & Cancellation Policy — CakeToHome",
            meta_description:
                "CakeToHome's policy for order cancellations, refunds, and replacements for online cake orders.",
            excerpt: "Our cancellation, refund, and replacement policy.",
            blocks: [
                { type: "heading", content: "Cancellation" },
                {
                    type: "paragraph",
                    content:
                        "Orders can be cancelled free of charge before the bakery begins preparation. Once preparation has started, cancellation may incur a charge. Scheduled orders can be cancelled up to 12 hours before the delivery slot.",
                },
                { type: "heading", content: "Refunds" },
                {
                    type: "paragraph",
                    content:
                        "Approved refunds are credited to your original payment method or CakeToHome wallet, as you choose. Refund processing time depends on your payment provider.",
                },
                { type: "heading", content: "Quality Issues" },
                {
                    type: "paragraph",
                    content:
                        "If your cake arrives damaged or does not match your order, contact us within 2 hours of delivery with photos for a replacement or refund.",
                },
            ],
        },
        {
            slug: "shipping-policy",
            title: "Shipping & Delivery Policy",
            meta_title: "Shipping & Delivery Policy — CakeToHome",
            meta_description:
                "CakeToHome's delivery options including standard, scheduled, midnight, and fixed-time cake delivery.",
            excerpt: "Delivery options, charges, and coverage areas.",
            blocks: [
                { type: "heading", content: "Delivery Options" },
                {
                    type: "paragraph",
                    content:
                        "CakeToHome offers standard delivery, scheduled delivery, midnight delivery, and fixed-time delivery depending on branch coverage in your area.",
                },
                { type: "heading", content: "Delivery Charges" },
                {
                    type: "paragraph",
                    content:
                        "Delivery charges are calculated based on your delivery zone and branch. Free delivery may be available on orders above a configurable threshold.",
                },
                { type: "heading", content: "Coverage" },
                {
                    type: "paragraph",
                    content:
                        "Delivery availability is determined by the nearest branch serving your pincode. Use the delivery availability checker at checkout to confirm coverage.",
                },
            ],
        },
        {
            slug: "faq",
            title: "Frequently Asked Questions",
            meta_title: "FAQ — CakeToHome",
            meta_description:
                "Answers to common questions about ordering cakes, delivery, customisation, and payments on CakeToHome.",
            excerpt: "Answers to common questions about ordering with CakeToHome.",
            blocks: [
                { type: "heading", content: "How do I place an order?" },
                {
                    type: "paragraph",
                    content:
                        "Browse cakes, select your favourite, choose customisation options, pick a delivery slot, and check out. You'll receive order updates by SMS and WhatsApp.",
                },
                { type: "heading", content: "Can I schedule a delivery?" },
                {
                    type: "paragraph",
                    content:
                        "Yes. We offer scheduled delivery, midnight delivery, and fixed-time delivery slots subject to branch availability.",
                },
                { type: "heading", content: "Do you offer custom cakes?" },
                {
                    type: "paragraph",
                    content:
                        "Yes. Use the custom cake request form for bespoke designs, photo cakes, and bulk orders. Our team will contact you to confirm details and pricing.",
                },
                { type: "heading", content: "What payment methods do you accept?" },
                {
                    type: "paragraph",
                    content:
                        "We accept major credit/debit cards, UPI, net banking, and wallet payments. Saved payment methods are supported for faster checkout.",
                },
            ],
        },
        {
            slug: "careers",
            title: "Careers at CakeToHome",
            meta_title: "Careers — CakeToHome",
            meta_description:
                "Join the CakeToHome team. Explore open roles in operations, technology, customer experience, and delivery.",
            excerpt: "Build the future of online cake ordering with us.",
            blocks: [
                { type: "heading", content: "Join CakeToHome" },
                {
                    type: "paragraph",
                    content:
                        "We're building the most complete online cake ordering platform. If you're passionate about customer experience, technology, and great cake, we'd love to hear from you.",
                },
                { type: "heading", content: "Open Roles" },
                {
                    type: "paragraph",
                    content:
                        "Email your resume to careers@caketohome.com with the role you're applying for in the subject line.",
                },
            ],
        },
        {
            slug: "franchise",
            title: "Franchise Opportunities",
            meta_title: "Franchise Opportunities — CakeToHome",
            meta_description:
                "Partner with CakeToHome to bring premium cake ordering and delivery to your city. Franchise enquiry form and details.",
            excerpt: "Bring CakeToHome to your city.",
            blocks: [
                { type: "heading", content: "Partner With Us" },
                {
                    type: "paragraph",
                    content:
                        "CakeToHome is expanding across India. If you're interested in bringing our platform to your city as a franchise partner, we'd love to connect.",
                },
                { type: "heading", content: "Why Partner With Us" },
                {
                    type: "paragraph",
                    content:
                        "Access our full technology platform, marketing engine, delivery network, and customer base. We provide onboarding, training, and ongoing support.",
                },
                { type: "heading", content: "Enquire" },
                {
                    type: "paragraph",
                    content:
                        "Email franchise@caketohome.com with your city, experience, and investment capacity for a franchise information pack.",
                },
            ],
        },
    ];

    logger.info("Seeding static CMS pages...");

    const existing = await cmsModule.listCmsPages({});
    const existingSlugs = new Set(existing.map((p) => p.slug));

    let created = 0;
    for (const page of pages) {
        if (existingSlugs.has(page.slug)) {
            logger.info(`  ⊘ ${page.slug} (already exists, skipping)`);
            continue;
        }
        const createdPage = await cmsModule.createPage({
            slug: page.slug,
            title: page.title,
            type: "static",
            status: "published",
            meta_title: page.meta_title,
            meta_description: page.meta_description,
            excerpt: page.excerpt,
            blocks: page.blocks,
            published_at: new Date(),
        });
        await cmsModule.publishPage(createdPage.id, "system-seed");
        logger.info(`  ✓ ${page.slug}`);
        created++;
    }

    logger.info(`Seeded ${created} new CMS pages (${pages.length - created} already existed).`);

    // ── Footer navigation ──────────────────────────────────────────────────
    logger.info("Seeding footer navigation...");

    const existingNavs = await cmsModule.listCmsNavigations({ location: "footer" });
    if (existingNavs.length > 0) {
        logger.info("  ⊘ footer navigation (already exists, skipping)");
    } else {
        await cmsModule.createNavigation({
            name: "Footer Links",
            location: "footer",
            is_active: true,
            items: [
                { label: "About", type: "page", page_slug: "about" },
                { label: "Privacy", type: "page", page_slug: "privacy" },
                { label: "Terms", type: "page", page_slug: "terms" },
                { label: "Refund Policy", type: "page", page_slug: "refund-policy" },
                { label: "FAQ", type: "page", page_slug: "faq" },
                { label: "Contact", type: "page", page_slug: "contact" },
            ],
        });
        logger.info("  ✓ footer navigation");
    }

    logger.info("CMS pages + navigation seeded successfully.");
}
