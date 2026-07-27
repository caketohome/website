import { SignupForm } from "@frontend/components/dashboard/signup-form";
import { Container, Heading } from "@medusajs/ui";
import { listShops } from "@frontend/lib/data";

export default async function SignupPage() {
  const shops = await listShops();

  return (
    <Container className="flex flex-col gap-4">
      <Heading level="h1" className="text-xl">
        Create your CakeToHome account
      </Heading>
      <SignupForm shops={shops} />
    </Container>
  );
}
