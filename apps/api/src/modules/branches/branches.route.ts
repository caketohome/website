import { Router } from "express";
import { BranchController } from "./branches.controller";
import { branchesFeatureGuard } from "./branches.middleware";

const router = Router();
const controller = new BranchController();

// ── Capability 4.1: Branch Directory ─────────────────────────────────────────
router.get("/branches", branchesFeatureGuard("branches.directory.v2"), controller.listBranches);
router.get("/branches/serviceable", branchesFeatureGuard("branches.directory.v2"), controller.findServiceableBranch);
router.get("/branches/:id", branchesFeatureGuard("branches.directory.v2"), controller.getBranchById);

export { router as branchesRouter };
