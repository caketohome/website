import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { MEDIA_MODULE } from "../../../modules/media";

/**
 * GET /admin/media
 * List media, optionally filtered by folder.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
    const mediaModule = req.scope.resolve(MEDIA_MODULE);
    const folder = req.query.folder as string | undefined;

    if (folder) {
        const media = await mediaModule.listByFolder(folder);
        return res.status(200).json({ media });
    }

    const media = await mediaModule.listMedia({});
    return res.status(200).json({ media });
}

/**
 * POST /admin/media
 * Register a media entry after upload (URL-based; storage adapter handles the file).
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
    const mediaModule = req.scope.resolve(MEDIA_MODULE);

    const body = req.body as {
        name: string;
        url: string;
        thumbnail_url?: string;
        mime_type: string;
        size?: number;
        folder?: string;
        alt_text?: string;
        width?: number;
        height?: number;
        is_webp_generated?: boolean;
    };

    if (!body.name || !body.url || !body.mime_type) {
        return res
            .status(400)
            .json({ message: "name, url, mime_type are required" });
    }

    const media = await mediaModule.registerMedia({
        name: body.name,
        url: body.url,
        thumbnail_url: body.thumbnail_url,
        mime_type: body.mime_type,
        size: body.size,
        folder: body.folder,
        alt_text: body.alt_text,
        width: body.width,
        height: body.height,
        is_webp_generated: body.is_webp_generated,
    });

    return res.status(200).json({ media });
}
