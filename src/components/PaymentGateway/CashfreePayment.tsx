import { handleCheckout } from "@/helpers/functionalHelpers";
import { Button } from "@heroui/react";
import { FC } from "react";
import { useTranslation } from "react-i18next";

/**
 * [CHANGE 2026-09-23] Pay Online through Cashfree.
 *
 * The order is created first; the server opens a Cashfree session for the
 * order's own total (never a client amount) and returns the hosted page as
 * `payment_response.link`, which handleCheckout follows. Payment is captured
 * only on Cashfree's signed webhook or the verified return — nothing here
 * marks anything paid.
 */
const CashfreePayment: FC<{
  onSuccess: () => void;
  onError: () => void;
  setIsLoading: (value: boolean) => void;
  isLoading: boolean;
}> = ({ onSuccess, onError, isLoading, setIsLoading }) => {
  const { t } = useTranslation();

  const handlePayment = async () => {
    setIsLoading(true);

    try {
      await handleCheckout("cashfreePayment", {});

      onSuccess();
    } catch (err) {
      console.error(err);
      onError();
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Button color="primary" isLoading={isLoading} onPress={handlePayment} className="w-full">
      {t("payments.online.pay_now")}
    </Button>
  );
};

export default CashfreePayment;
