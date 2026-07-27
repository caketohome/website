"use client";

import { XMarkMini } from "@medusajs/icons";
import { Container, Heading, IconButton, Text } from "@medusajs/ui";
import { useState } from "react";

export default function DemoModal() {
  const [modalClosed, setModalClosed] = useState(false);

  if (modalClosed) {
    return null;
  }

  return (
    <div className="flex flex-col gap-8 transition-all ease-in-out delay-150  ">
      <Container className="flex flex-col gap-2 w-fit">
        <div className="flex justify-between">
          <Heading level="h2">Welcome to CakeToHome</Heading>
          <IconButton
            onClick={() => setModalClosed(true)}
            size="xsmall"
            variant="transparent"
          >
            <XMarkMini />
          </IconButton>
        </div>
        <Text className="text-left">
          Welcome to CakeToHome, a premium cake and bakery ordering platform.
        </Text>
        <Text className="text-left">
          Browse our selection of cakes, pastries, and cupcakes. Place your order
          and track it in real-time!
        </Text>
      </Container>
    </div>
  );
}
