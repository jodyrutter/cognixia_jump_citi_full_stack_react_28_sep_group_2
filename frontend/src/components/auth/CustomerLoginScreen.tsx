import { authApi } from "../../api/auth";
import { LoginForm } from "./LoginForm";

interface Props {
  onSwitchToAdmin: () => void;
  onSignup: () => void;
}

export function CustomerLoginScreen({ onSwitchToAdmin, onSignup }: Props) {
  return (
    <LoginForm
      title="Sign in"
      subtitle="Use your Citi customer credentials to continue."
      emailPlaceholder="you@example.com"
      onLogin={authApi.loginCustomer}
      switchLabel="Are you a Citi administrator?"
      switchActionLabel="Sign in here"
      onSwitch={onSwitchToAdmin}
      onSignup={onSignup}
    />
  );
}
