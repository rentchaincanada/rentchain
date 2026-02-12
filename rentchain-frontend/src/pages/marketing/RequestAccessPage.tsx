import React from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { MarketingLayout } from "./MarketingLayout";
import { RequestAccessModal } from "../../components/marketing/RequestAccessModal";

const RequestAccessPage: React.FC = () => {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const referralCode = params.get("ref");

  return (
    <MarketingLayout>
      <RequestAccessModal
        open
        referralCode={referralCode}
        onClose={() => navigate("/site/pricing")}
      />
    </MarketingLayout>
  );
};

export default RequestAccessPage;
