import { authApi } from "../../api/auth";
import { LoginForm } from "./LoginForm";

interface Props {
  onSwitchToCustomer: () => void;
}

export function AdminLoginScreen({ onSwitchToCustomer }: Props) {
  return (
    <LoginForm
      role="admin"
      title="Welcome back, admin."
      subtitle="Sign in with your administrator account. Customer accounts cannot access this workspace."
      emailPlaceholder="admin@example.com"
      onLogin={authApi.loginAdmin}
      switchLabel="Are you a Polis customer?"
      switchActionLabel="Go to customer sign in"
      onSwitch={onSwitchToCustomer}
    />
  );
}
