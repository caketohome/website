"use client";

import { login } from "@frontend/lib/actions";
import { Badge, Button, Input, Label, Select } from "@medusajs/ui";
import { Link } from "next-view-transitions";
import { useFormState, useFormStatus } from "react-dom";

function Submit() {
  const status = useFormStatus();

  return (
    <Button
      type="submit"
      size="large"
      className="self-end"
      isLoading={status.pending}
    >
      Login
    </Button>
  );
}

function DefaultLoginForm() {
  const [state, action] = useFormState(login, { message: "" });

  return (
    <form action={action} className="flex flex-col gap-4 max-w-96">
      <div className="flex flex-col gap-2">
        <div>
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" placeholder="Email" />
        </div>
        <div>
          <Label htmlFor="password">Password</Label>
          <Input id="password" name="password" type="password" />
        </div>
        <div>
          <Label htmlFor="actor_type">I&apos;m a...</Label>
          <Select name="actor_type">
            <Select.Trigger>
              <Select.Value></Select.Value>
            </Select.Trigger>
            <Select.Content>
              <Select.Item value="customer">Customer</Select.Item>
              <Select.Item value="shop">Shop Manager</Select.Item>
              <Select.Item value="delivery_partner">Delivery Partner</Select.Item>
              <Select.Item value="admin">Super Admin</Select.Item>
            </Select.Content>
          </Select>
        </div>
      </div>
      <div className="flex flex-row justify-between">
        <Link href="/signup">
          <Button variant="transparent" size="large">
            Create account
          </Button>
        </Link>
        <Submit />
      </div>
      {state?.message && (
        <Badge className="justify-center text-center">{state.message}</Badge>
      )}
    </form>
  );
}

export function LoginForm() {
  return <DefaultLoginForm />;
}
