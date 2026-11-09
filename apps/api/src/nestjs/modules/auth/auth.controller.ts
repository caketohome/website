import { Controller, Post, Body } from "@nestjs/common";
import { AuthService } from "./auth.service";
import { Public } from "../../guards/public.decorator";

@Controller("api/v1/auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post("otp/send")
  async sendOtp(@Body() body: { phone: string }) {
    return await this.authService.sendOtp(body.phone);
  }

  @Public()
  @Post("otp/verify")
  async verifyOtp(@Body() body: { phone: string; code: string }) {
    return await this.authService.verifyOtp(body.phone, body.code);
  }
}

