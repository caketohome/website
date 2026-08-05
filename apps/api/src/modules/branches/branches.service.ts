import { BranchRepository } from "./branches.repository";
import { BranchSearchQuery } from "./branches.types";
import { NotFoundError } from "../../core/errors/app-error";

export class BranchService {
  private repository: BranchRepository;

  constructor(repository: BranchRepository = new BranchRepository()) {
    this.repository = repository;
  }

  async listBranches(query: BranchSearchQuery) {
    const branches = await this.repository.listBranches(query);
    return {
      branches,
      meta: {
        count: branches.length,
        filter_pincode: query.pincode || null,
      },
    };
  }

  async findServiceableBranch(pincode: string) {
    const branch = await this.repository.findServiceableBranch(pincode);
    if (!branch) {
      throw new NotFoundError(`No active CakeToHome bakery branch serviceability found for pincode '${pincode}'.`);
    }
    return {
      pincode,
      serviceable: true,
      assigned_branch: branch,
    };
  }

  async getBranchById(id: string) {
    const branch = await this.repository.findBranchById(id);
    if (!branch) {
      throw new NotFoundError(`Bakery branch with identifier '${id}' not found.`);
    }
    return branch;
  }
}
