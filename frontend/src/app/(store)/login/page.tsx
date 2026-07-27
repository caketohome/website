import { OtpLoginForm } from "@frontend/components/store/auth/otp-login-form";
import { Container, Heading, Text } from "@medusajs/ui";

export default function LoginPage() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-4">
      <Container className="flex flex-col gap-4">
        <Heading level="h1" className="text-xl text-center">
          Login to CakeToHome
        </Heading>
        <Text className="text-ui-fg-subtle text-center text-sm">
          {"Enter your mobile number — we'll send you a verification code."}
        </Text>
        <OtpLoginForm />
      </Container>
    </div>
  );
}
