import React, { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { tenantLogin } from "../api/tenantAuthApi";
import { LoginForm } from "../components/auth/LoginForm";
import { setAuthToken } from "../lib/apiClient";

const TenantLoginPage: React.FC = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const returnTo = params.get("returnTo") || "/tenant/dashboard";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await tenantLogin(email, password);
      if (res?.token) {
        setAuthToken(res.token);
        navigate(returnTo, { replace: true });
      } else {
        setError("Invalid response from server");
      }
    } catch (err: any) {
      setError(err?.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <LoginForm
      title="Tenant login"
      subtitle="Sign in to continue to your tenant workspace."
      roleLabel="Tenant access"
      email={email}
      onEmailChange={setEmail}
      password={password}
      onPasswordChange={setPassword}
      onSubmit={handleSubmit}
      isLoading={loading}
      error={error}
      loadingLabel="Signing in..."
      statusMessage="Use the email associated with your tenant profile."
    />
  );
};

export default TenantLoginPage;
