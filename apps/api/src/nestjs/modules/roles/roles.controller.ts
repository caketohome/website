import { Controller, Get, Req } from "@nestjs/common";
import { RolesService } from "./roles.service";
import { Roles } from "../../guards/roles.decorator";

@Controller("api/v1/roles")
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Get()
  getRoles() {
    return this.rolesService.getRoles();
  }

  @Get("permissions")
  getPermissions() {
    return this.rolesService.getPermissions();
  }

  @Get("my-permissions")
  getMyPermissions(@Req() req: any) {
    const userId = req.user?.id || "usr_guest";
    return this.rolesService.getUserRoleAssignment(userId);
  }
}

