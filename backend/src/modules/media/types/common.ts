import MediaModuleService from "../service";

export interface MediaDTO {
    id: string;
    name: string;
    url: string;
    thumbnail_url: string | null;
    mime_type: string;
    size: number;
    folder: string;
    alt_text: string | null;
    width: number | null;
    height: number | null;
    is_webp_generated: boolean;
    created_at: Date;
    updated_at: Date;
}

export interface CreateMediaDTO {
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
}

declare module "@medusajs/types" {
    export interface ModuleImplementations {
        mediaModuleService: MediaModuleService;
    }
}
