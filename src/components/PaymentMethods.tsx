import { useSettings } from "@/contexts/SettingsContext";
import { formatAmount } from "@/helpers/functionalHelpers";
import { RootState } from "@/lib/redux/store";
import { Image, Radio, RadioGroup, ScrollShadow } from "@heroui/react";
import { FC } from "react";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";

interface PaymentMethodsProps {
  selectedPayment: string;
  setSelectedPayment: (value: string) => void;
  hideCOD: boolean;
  isLoading: boolean;
}

/** Provider artwork, keyed by the gateway id the server resolves to. */
const ONLINE_GATEWAY_ICONS: Record<string, string> = {
  razorpayPayment: "/Payments/razorpay.png",
  stripePayment: "/Payments/stripe.png",
  paystackPayment: "/Payments/paystack.png",
  flutterwavePayment: "/Payments/flutterwave.png",
  xenditPayment: "/Payments/xendit.png",
  cashfreePayment: "/Payments/cashfree.png",
};

const PaymentMethods: FC<PaymentMethodsProps> = ({
  selectedPayment,
  setSelectedPayment,
  hideCOD = false,
  isLoading = false,
}) => {
  const { t } = useTranslation();
  const { paymentSettings, currencySymbol } = useSettings();
  const codCharges = useSelector(
    (state: RootState) => state.cart.cartData?.payment_summary?.cod_charges
  );

  // [CHANGE 2026-09-22] One "Pay Online" entry, not a list of providers.
  //
  // The checkout used to name every gateway — Stripe, Razorpay, Paystack,
  // Flutterwave, Xendit — and let the customer pick one. That put the choice of
  // payment provider in the CLIENT, so changing provider meant releasing four
  // clients, and a customer was asked a question that is not theirs to answer.
  //
  // The server now resolves the administrator's configured gateway and reports
  // it as `resolvedOnlineGateway`. The entry below carries that value as its
  // id, so every existing gateway component behind PaymentModal keeps working
  // untouched — only the number of things the customer sees has changed.
  //
  // This restores the flow shipped on 15 September and lost with the sandbox
  // reclaim; the reverted state is what put "Pay with Razorpay" back on screen.
  const resolvedOnlineGateway = paymentSettings?.resolvedOnlineGateway ?? "";

  const allMethods = [
    {
      id: "cod",
      name: t("payments.cod.name"),
      tagline: t("payments.cod.tagline"),
      icon: "/Payments/cod.png",
      isEnabled: paymentSettings?.cod === true && !hideCOD,
    },
    {
      // The one online entry. `isEnabled` is false when nothing resolved —
      // no gateway configured, or two enabled with no preference — so the
      // customer is never offered a payment that cannot be taken.
      id: resolvedOnlineGateway,
      name: t("payments.online.name"),
      tagline: t("payments.online.tagline"),
      // The provider's own mark, so the customer can still see WHO takes the
      // payment even though choosing one is not their job. Falls back to a
      // neutral card icon for a gateway with no artwork here.
      icon: ONLINE_GATEWAY_ICONS[resolvedOnlineGateway] ?? "/Payments/cod.png",
      isEnabled: resolvedOnlineGateway !== "",
    },
    {
      id: "directBankTransfer",
      name: t("payments.directBankTransfer.name"),
      tagline: t("payments.directBankTransfer.tagline"),
      icon: "/Payments/bank_transfer.png",
      isEnabled: false,
    },
    {
      id: "paypal",
      name: t("payments.paypal.name"),
      tagline: t("payments.paypal.tagline"),
      icon: "/Payments/paypal.png",
      isEnabled: false,
    },
    {
      id: "phonepe",
      name: t("payments.phonepe.name"),
      tagline: t("payments.phonepe.tagline"),
      icon: "/Payments/phonepe-logo.png",
      isEnabled: false,
    },
  ];

  const paymentMethods = allMethods.filter((method) => method.isEnabled);

  return (
    <ScrollShadow className="w-full h-full max-h-[50vh] pr-2 py-1">
      <RadioGroup
        value={selectedPayment}
        onValueChange={setSelectedPayment}
        className="gap-3"
        isDisabled={isLoading}
      >
        {paymentMethods.map((method) => (
          <Radio
            key={method.id}
            value={method.id}
            classNames={{
              base: "inline-flex m-0 items-center justify-between flex-row-reverse max-w-full cursor-pointer rounded-lg gap-4 p-3 border border-gray-200 dark:border-default-100 data-[selected=true]:border-primary-500 data-[selected=true]:bg-primary-50 dark:data-[selected=true]:bg-content1",
              control: "text-primary-600",
            }}
          >
            <div className="flex items-center gap-4">
              <Image
                src={method.icon}
                alt={method.name}
                width={32}
                height={32}
                className="rounded-md"
              />
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h4 className="font-medium text-sm">{method.name}</h4>
                </div>
                {method.id === "cod" && Number(codCharges || 0) > 0 ? (
                  <p className="text-xs opacity-50">
                    {t("checkout.codFeeMessage", {
                      amount: `${currencySymbol}${formatAmount(
                        Number(codCharges)
                      )}`,
                    })}
                  </p>
                ) : (
                  <p className="text-xs opacity-50">{method.tagline}</p>
                )}
              </div>
            </div>
          </Radio>
        ))}
      </RadioGroup>
    </ScrollShadow>
  );
};

export default PaymentMethods;
