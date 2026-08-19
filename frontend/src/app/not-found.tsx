import { Container, Heading, Text, Button } from "@medusajs/ui";
import Link from "next/link";

export default function NotFound() {
    return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
            <Container className="flex flex-col items-center gap-4 p-8">
                <Heading level="h1" className="text-4xl">404</Heading>
                <Heading level="h2">Page Not Found</Heading>
                <Text className="text-ui-fg-subtle text-center">
                    {"The page you're looking for doesn't exist or has been moved."}
                </Text>
                <Link href="/">
                    <Button size="large">Back to Home</Button>
                </Link>
            </Container>
        </div>
    );
}
