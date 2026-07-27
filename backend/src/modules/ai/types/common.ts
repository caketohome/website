import AIModuleService from "../service";

export type {
    AIProvider,
    AICompleteInput,
    AICompleteResult,
    AIForecastInput,
    AIForecastResult,
    AIClassifyInput,
    AIClassifyResult,
} from "./provider";

declare module "@medusajs/types" {
    export interface ModuleImplementations {
        aiModuleService: AIModuleService;
    }
}
