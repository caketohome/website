/**
 * Customer Repository — Direct Prisma Data Access Layer with DTO Mappers
 */

import { CustomerMapper } from "./customer.mapper";

export class CustomerRepository {
  private prisma: any;

  constructor(prismaClient?: any) {
    this.prisma = prismaClient;
  }

  async findCustomerByPhone(phone: string) {
    if (!this.prisma) return null;
    const raw = await this.prisma.customer.findUnique({
      where: { phone },
      include: { addresses: true, phones: true },
    });
    return CustomerMapper.toCustomerDTO(raw);
  }

  async findCustomerById(id: string) {
    if (!this.prisma) return null;
    const raw = await this.prisma.customer.findUnique({
      where: { id },
      include: { addresses: true },
    });
    return CustomerMapper.toCustomerDTO(raw);
  }

  async createCustomer(data: { phone: string; first_name?: string; last_name?: string }) {
    if (!this.prisma) {
      return CustomerMapper.toCustomerDTO({ id: `cus_${Date.now()}`, phone: data.phone, ...data });
    }
    const raw = await this.prisma.customer.create({ data });
    return CustomerMapper.toCustomerDTO(raw);
  }

  async findPhoneRecord(phone: string) {
    if (!this.prisma) return null;
    const raw = await this.prisma.customerPhone.findUnique({ where: { phone } });
    return CustomerMapper.toPhoneRecordDTO(raw);
  }

  async upsertPhoneRecord(data: {
    phone: string;
    otp_hash: string;
    otp_expires_at: Date;
    otp_attempts: number;
    customer_id?: string;
  }) {
    if (!this.prisma) return CustomerMapper.toPhoneRecordDTO(data);
    const raw = await this.prisma.customerPhone.upsert({
      where: { phone: data.phone },
      update: {
        otp_hash: data.otp_hash,
        otp_expires_at: data.otp_expires_at,
        otp_attempts: data.otp_attempts,
        customer_id: data.customer_id,
      },
      create: data,
    });
    return CustomerMapper.toPhoneRecordDTO(raw);
  }

  async listAddresses(customer_id: string) {
    if (!this.prisma) return [];
    const list = await this.prisma.customerAddress.findMany({
      where: { customer_id },
      orderBy: { created_at: "desc" },
    });
    return list.map(CustomerMapper.toAddressDTO);
  }

  async createAddress(customer_id: string, data: any) {
    if (!this.prisma) return CustomerMapper.toAddressDTO({ id: `addr_${Date.now()}`, customer_id, ...data });
    const raw = await this.prisma.customerAddress.create({
      data: { customer_id, ...data },
    });
    return CustomerMapper.toAddressDTO(raw);
  }

  async deleteAddress(id: string, customer_id: string) {
    if (!this.prisma) return true;
    return this.prisma.customerAddress.deleteMany({
      where: { id, customer_id },
    });
  }

  async createLoginEvent(data: { customer_id: string; phone: string; ip?: string; user_agent?: string; success: boolean }) {
    if (!this.prisma) return;
    return this.prisma.loginEvent.create({ data });
  }
}
