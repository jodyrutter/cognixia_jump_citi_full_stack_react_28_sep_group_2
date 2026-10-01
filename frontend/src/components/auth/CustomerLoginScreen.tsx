import { authApi } from "../../api/auth";
import { LoginForm } from "./LoginForm";

interface Props {
  onSwitchToAdmin: () => void;
  onSignup: () => void;
}

export function CustomerLoginScreen({ onSwitchToAdmin, onSignup }: Props) {
  return (
    <LoginForm
      role="customer"
      title="Welcome back."
      subtitle="Sign in with your personal customer account. Staff accounts use a separate sign-in."
      emailPlaceholder="you@example.com"
      onLogin={authApi.loginCustomer}
      switchLabel="Are you a Citi administrator?"
      switchActionLabel="Go to admin sign in"
      onSwitch={onSwitchToAdmin}
      onSignup={onSignup}
    />
  );
}
