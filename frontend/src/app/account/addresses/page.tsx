import { retrieveUser } from "@frontend/lib/data";
import { AddressManager } from "@frontend/components/store/account/address-manager";
import { redirect } from "next/navigation";

export const metadata = {
  title: "Delivery Addresses | CakeToHome",
  description: "Manage your saved delivery addresses and kitchen hub locations.",
};

export default async function AddressesPage() {
  const user = await retrieveUser();
  if (!user) {
    redirect("/login");
  }

  const initialAddresses = user.addresses || [];

  return <AddressManager initialAddresses={initialAddresses} />;
}
