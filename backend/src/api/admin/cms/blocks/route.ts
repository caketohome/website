import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { CMS_MODULE } from "../../../../modules/cms";

export async function GET(req: MedusaRequest, res: MedusaResponse) {
    const cmsModule = req.scope.resolve(CMS_MODULE) as {
        listCmsBlocks: (filters: Record<string, unknown>) => Promise<unknown[]>;
    };
    const filters: Record<string, unknown> = {};
    if (req.query.language_code) filters.language_code = req.query.language_code;
    const blocks = await cmsModule.listCmsBlocks(filters);
    return res.status(200).json({ blocks });
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
    const cmsModule = req.scope.resolve(CMS_MODULE) as {
        createBlock: (
            name: string,
            identifier: string,
            type: string,
            content: unknown,
            languageCode?: string
        ) => Promise<{ id: string }>;
    };
    const body = req.body as {
        name: string;
        identifier: string;
        type?: string;
        content?: unknown;
        language_code?: string;
    };
    if (!body.name || !body.identifier) {
        return res.status(400).json({ message: "name and identifier are required." });
    }
    const block = await cmsModule.createBlock(
        body.name,
        body.identifier,
        body.type ?? "rich_text",
        body.content,
        body.language_code ?? "en"
    );
    return res.status(201).json({ block });
}
