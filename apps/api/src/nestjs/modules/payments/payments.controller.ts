import { Controller, Post, Get, Param, Body } from "@nestjs/common";
import { PaymentsService } from "./payments.service";
import { Public } from "../../guards/public.decorator";

@Controller("api/v1/payments")
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Public()
  @Post("cashfree/order")
  async createCashfreeOrder(@Body() body: any) {
    return await this.paymentsService.createCashfreePaymentOrder(body);
  }

  @Public()
  @Get("status/:orderId")
  async getStatus(@Param("orderId") orderId: string) {
    return await this.paymentsService.getPaymentStatus(orderId);
  }

  @Post("refund")
  async refund(@Body() body: any) {
    return await this.paymentsService.initiateRefund(body);
  }

  // Decommission guards for Razorpay (410 Gone)
  @Public()
  @Post("razorpay")
  rejectRazorpayPostBase() {
    this.paymentsService.rejectRazorpay();
  }

  @Public()
  @Post("razorpay/:subpath")
  rejectRazorpayPostSub() {
    this.paymentsService.rejectRazorpay();
  }

  @Public()
  @Get("razorpay")
  rejectRazorpayGetBase() {
    this.paymentsService.rejectRazorpay();
  }

  @Public()
  @Get("razorpay/:subpath")
  rejectRazorpayGetSub() {
    this.paymentsService.rejectRazorpay();
  }
}
