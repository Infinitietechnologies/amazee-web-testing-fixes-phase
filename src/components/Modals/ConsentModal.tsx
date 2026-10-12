import { FC, useEffect, useState } from "react";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Checkbox,
  addToast,
} from "@heroui/react";
import { ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { useDispatch, useSelector } from "react-redux";
import { acceptConsents } from "@/routes/api";
import { setUserDataRedux } from "@/lib/redux/slices/authSlice";
import { updateUserDataInRedux } from "@/helpers/functionalHelpers";
import { RootState } from "@/lib/redux/store";

// The signed-in user is persisted (redux-persist) and not re-read on load, so
// a session from before a Terms/Privacy change would never be asked. Re-read
// the profile once per page load; module scope survives client navigation.
let profileRefreshed = false;

/**
 * [2026-10-04] Terms & Privacy acceptance (PDF §1.3).
 *
 * Shown to a signed-in customer whose `consent.required` is true: they never
 * accepted, or the Terms / Privacy version changed since. It cannot be
 * dismissed; the acceptance is recorded server-side with the version, channel,
 * IP and user agent (api/user/consents), as the customer app does.
 */
export const ConsentModal: FC = () => {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const isLoggedIn = useSelector((state: RootState) => state.auth.isLoggedIn);
  const consent = useSelector((state: RootState) => state.auth.user?.consent);
  const [agreed, setAgreed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isLoggedIn && !profileRefreshed) {
      profileRefreshed = true;
      updateUserDataInRedux();
    }
  }, [isLoggedIn]);

  const isOpen = Boolean(isLoggedIn && consent?.required);

  const handleAccept = async () => {
    if (!consent || !agreed) return;
    setIsLoading(true);
    try {
      const res = await acceptConsents(
        consent.terms_version,
        consent.privacy_version,
      );
      if (res.success && res.data) {
        dispatch(setUserDataRedux({ consent: res.data }));
        return;
      }
      addToast({
        title: res.message || t("consent.failed"),
        color: "danger",
      });
      // The versions may have changed while the dialog was open: re-read them
      // so the user accepts what is current.
      await updateUserDataInRedux();
      setAgreed(false);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      isDismissable={false}
      isKeyboardDismissDisabled={true}
      hideCloseButton={true}
      backdrop="blur"
      placement="center"
    >
      <ModalContent>
        <ModalHeader className="flex items-center gap-2">
          <ShieldCheck className="text-primary" size={24} />
          <span className="font-bold">{t("consent.title")}</span>
        </ModalHeader>
        <ModalBody className="py-4 space-y-3">
          <p className="text-sm text-default-500">{t("consent.intro")}</p>
          <div className="flex flex-col gap-1 text-sm">
            <Link
              href="/terms-and-conditions"
              target="_blank"
              className="text-primary underline"
            >
              {t("footer.policies.terms_conditions")}
            </Link>
            <Link
              href="/privacy-policy"
              target="_blank"
              className="text-primary underline"
            >
              {t("footer.policies.privacy_policy")}
            </Link>
          </div>
          <Checkbox isSelected={agreed} onValueChange={setAgreed} size="sm">
            {t("consent.agree")}
          </Checkbox>
        </ModalBody>
        <ModalFooter>
          <Button
            color="primary"
            className="w-full"
            isLoading={isLoading}
            isDisabled={!agreed}
            onPress={handleAccept}
          >
            {t("consent.accept")}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

export default ConsentModal;
