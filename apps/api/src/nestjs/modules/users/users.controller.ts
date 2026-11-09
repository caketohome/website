import { Controller, Get, Put, Body, Req } from "@nestjs/common";
import { UsersService } from "./users.service";

@Controller("api/v1/users")
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get("me")
  async getProfile(@Req() req: any) {
    const userId = req.user?.id || "usr_guest";
    return await this.usersService.getProfile(userId);
  }

  @Put("me")
  async updateProfile(@Req() req: any, @Body() body: any) {
    const userId = req.user?.id || "usr_guest";
    return await this.usersService.updateProfile(userId, body);
  }
}

