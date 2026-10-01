import { authApi } from "../../api/auth";
import { LoginForm } from "./LoginForm";

interface Props {
  onSwitchToCustomer: () => void;
}

export function AdminLoginScreen({ onSwitchToCustomer }: Props) {
  return (
    <LoginForm
      title="Admin Sign in"
      subtitle="Use your Citi employee credentials to continue."
      emailPlaceholder="admin@example.com"
      onLogin={authApi.loginAdmin}
      switchLabel="Are you a Citi customer?"
      switchActionLabel="Sign in here"
      onSwitch={onSwitchToCustomer}
    />
  );
}
