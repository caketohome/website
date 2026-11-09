import { Injectable, NotFoundException } from "@nestjs/common";

@Injectable()
export class UsersService {
  async getProfile(userId: string) {
    if (!userId) {
      throw new NotFoundException("User ID is required");
    }

    return {
      id: userId,
      phone: "+919876543210",
      first_name: "Customer",
      last_name: "User",
      email: "customer@caketohome.com",
      role: "CUSTOMER",
      created_at: new Date().toISOString(),
    };
  }

  async updateProfile(userId: string, data: any) {
    return {
      id: userId,
      ...data,
      updated_at: new Date().toISOString(),
    };
  }
}

