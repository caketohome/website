import * as fs from "fs";
import * as path from "path";

describe("Architecture Fitness Tests", () => {
  const modulesDir = path.resolve(__dirname, "../../modules");

  function getFilesRecursively(dir: string): string[] {
    let results: string[] = [];
    if (!fs.existsSync(dir)) return results;
    const list = fs.readdirSync(dir);
    list.forEach((file) => {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);
      if (stat && stat.isDirectory()) {
        results = results.concat(getFilesRecursively(filePath));
      } else {
        results.push(filePath);
      }
    });
    return results;
  }

  const allModuleFiles = getFilesRecursively(modulesDir);

  it("Rule 1: Controllers MUST NOT import Prisma directly", () => {
    const controllerFiles = allModuleFiles.filter((f) => f.endsWith(".controller.ts"));
    controllerFiles.forEach((file) => {
      const content = fs.readFileSync(file, "utf-8");
      expect(content).not.toContain("@prisma/client");
      expect(content).not.toContain("prisma.");
    });
  });

  it("Rule 2: Services MUST NOT import Express framework elements", () => {
    const serviceFiles = allModuleFiles.filter((f) => f.endsWith(".service.ts"));
    serviceFiles.forEach((file) => {
      const content = fs.readFileSync(file, "utf-8");
      expect(content).not.toContain('from "express"');
      expect(content).not.toContain("Request,");
      expect(content).not.toContain("Response,");
      expect(content).not.toContain("NextFunction");
    });
  });

  it("Rule 3: Repositories MUST export methods returning DTO mapped objects or primitives", () => {
    const repositoryFiles = allModuleFiles.filter((f) => f.endsWith(".repository.ts"));
    repositoryFiles.forEach((file) => {
      const content = fs.readFileSync(file, "utf-8");
      expect(content).toContain("Mapper");
    });
  });

  it("Rule 4: Routes MUST NOT contain inline request handling logic", () => {
    const routeFiles = allModuleFiles.filter((f) => f.endsWith(".route.ts"));
    routeFiles.forEach((file) => {
      const content = fs.readFileSync(file, "utf-8");
      expect(content).not.toContain("res.send(");
      expect(content).not.toContain("res.json(");
    });
  });
});
