import { useState, FormEvent, FC, useEffect } from "react";
import {
  Button,
  Input,
  Modal,
  ModalBody,
  ModalContent,
  ModalHeader,
  Divider,
  useDisclosure,
  Form,
  ModalFooter,
  InputOtp,
  addToast,
} from "@heroui/react";
import { LogIn, TruckElectric, User, Mail } from "lucide-react";
import { MyButton } from "../custom/MyButton";
import GoogleLoginBtn from "../Functional/GoogleLoginBtn";
import AppleLoginBtn from "../Functional/AppleLoginBtn";
import {
  handleSignUp,
  handleResendOtp,
  handlePhoneLogin,
} from "@/helpers/auth";
import { sendOtp, updateUserData, verifyOtp } from "@/routes/api";
import {
  login as ReduxLogin,
  setUserDataRedux,
} from "@/lib/redux/slices/authSlice";
import { clearRecentlyViewed } from "@/lib/redux/slices/recentlyViewedSlice";
import {
  syncOfflineCartToServer,
  updateCartData,
  updateDataOnAuth,
} from "@/helpers/updators";
import {
  setAnalyticsUserId,
  setAnalyticsUserProperties,
  trackLogin,
} from "@/lib/analytics";
import { setCookie } from "@/lib/cookies";
import { useDispatch } from "react-redux";
import { validateEmail } from "@/helpers/validator";
import { useSettings } from "@/contexts/SettingsContext";
import { useTranslation } from "react-i18next";
import { demoNumber } from "@/config/constants";
import dynamic from "next/dynamic";
import { clearRecaptchaVerifier, FirebaseInstance } from "@/lib/firebase";
import { ConfirmationResult } from "firebase/auth";
import type { userData } from "@/types/ApiResponse";

const PhoneInput = dynamic(() => import("@/components/Functional/PhoneInput"), {
  ssr: false,
});

interface LoginModalProps {
  triggerView?: "btn" | "link" | "icon";
}

// [2026-10-05] Audit 1.2: a new code can be requested after 30 s (the
// server cooldown is the same 30 s; codes expire after 10 minutes).
export const OTP_RESEND_SECONDS = 30;

/**
 * [2026-10-06] Audit 1.1 — PDF §1.1–§1.5, owner decision: sign-in is mobile
 * number + OTP only (no email, username or password). The same screen signs
 * an existing customer straight in and registers a new number: after the OTP
 * a new customer gives their full name and, optionally, an email; the Terms &
 * Privacy consent follows (ConsentModal, audit 1.3).
 */
type OtpStep = "phone" | "verify" | "details";

export const LoginModal: FC<LoginModalProps> = ({ triggerView = "btn" }) => {
  const { isOpen, onOpen, onOpenChange } = useDisclosure();
  const [isLoading, setIsLoading] = useState(false);
  const [isResendingOtp, setIsResendingOtp] = useState(false);
  const [resendIn, setResendIn] = useState(0);
  const { authSettings, demoMode } = useSettings();
  const [phoneError, setPhoneError] = useState<string | undefined>();

  const [otpStep, setOtpStep] = useState<OtpStep>("phone");
  const [otpPhoneNumber, setOtpPhoneNumber] = useState("");
  const [friendsCode] = useState("");

  // New-customer details (PDF §1.5: full name, email optional).
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [detailErrors, setDetailErrors] = useState<{
    name?: string;
    email?: string;
  }>({});

  const smsGateway =
    authSettings?.smsGateway ||
    (authSettings?.firebase
      ? "firebase"
      : authSettings?.customSms
        ? "custom"
        : "firebase");
  const isFirebaseGateway = smsGateway === "firebase";
  const isCustomGateway = smsGateway === "custom";

  const { t } = useTranslation();
  const dispatch = useDispatch();

  // Handle OTP phone input change
  const handleOtpPhoneChange = (
    _countryCode: string,
    phoneNumber: string,
    dialCode: string,
  ) => {
    const normalizedDialCode = dialCode.startsWith("+")
      ? dialCode
      : `+${dialCode}`;
    setOtpPhoneNumber(`${normalizedDialCode}${phoneNumber}`);
    if (phoneError) setPhoneError(undefined);
  };

  // Send OTP — to any number: an unregistered one becomes an account.
  const handleSendOtpForLogin = async () => {
    setIsLoading(true);

    if (!otpPhoneNumber || otpPhoneNumber.length < 5) {
      addToast({
        title: t("login_modal.errors.invalid_phone_title"),
        description: t("login_modal.errors.invalid_phone_desc"),
        color: "danger",
      });
      setIsLoading(false);
      return;
    }

    if (isFirebaseGateway) {
      const firebaseInstance = window.firebaseInstance as
        | FirebaseInstance
        | undefined;
      if (!firebaseInstance) {
        addToast({
          title: t("login_modal.errors.firebase_error_title"),
          description: t("login_modal.errors.firebase_error_desc"),
          color: "danger",
        });
        setIsLoading(false);
        return;
      }

      const success = await handleSignUp(otpPhoneNumber, firebaseInstance);
      if (success) {
        setOtpStep("verify");
        setResendIn(OTP_RESEND_SECONDS);
      }
    } else if (isCustomGateway) {
      try {
        const response = await sendOtp({
          mobile: otpPhoneNumber,
          expires_in: 600,
        });

        if (response.success) {
          addToast({
            title: t("signup_toast.otp_sent_title"),
            description: t("signup_toast.otp_sent_desc"),
            color: "success",
          });
          setOtpStep("verify");
          setResendIn(OTP_RESEND_SECONDS);
        } else {
          setPhoneError(
            response.message || "Failed to send OTP. Please try again.",
          );
        }
      } catch (error) {
        console.error("Custom SMS send OTP error:", error);
        addToast({
          title: t("login_modal.errors.verification_failed_title"),
          description: "Failed to send OTP. Please try again.",
          color: "danger",
        });
      }
    }
    setIsLoading(false);
  };

  // Signed in: store the session; a new customer goes on to their details.
  const completeSignIn = async (
    user: userData,
    accessToken: string,
    isNewCustomer: boolean,
  ) => {
    setCookie("user", user);
    setCookie("access_token", accessToken);
    dispatch(
      ReduxLogin({
        user,
        access_token: accessToken,
      }),
    );

    if (isNewCustomer) {
      dispatch(clearRecentlyViewed());
    }

    await syncOfflineCartToServer();
    updateDataOnAuth();
    updateCartData(false, false, 0);

    setAnalyticsUserId(String(user.id));
    setAnalyticsUserProperties({
      login_method: "phone_otp",
      user_type: "customer",
    });
    trackLogin("phone_otp");

    if (isNewCustomer) {
      setFullName(user.name ?? "");
      setEmail(user.email ?? "");
      setOtpStep("details");
      return;
    }

    addToast({
      title: t("login_modal.welcome_title"),
      description: t("login_modal.login_success_toast"),
      color: "success",
    });
    resetAndClose();
  };

  // Verify OTP: signs an existing customer in, or creates the account.
  const handleVerifyOtpAndLogin = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);

    const data = Object.fromEntries(new FormData(e.currentTarget));
    const otp = data.otp as string;

    if (!otp || otp.length !== 6) {
      addToast({
        title: t("login_modal.errors.invalid_otp_title"),
        description: t("login_modal.errors.invalid_otp_desc"),
        color: "danger",
      });
      setIsLoading(false);
      return;
    }

    try {
      if (isFirebaseGateway) {
        const confirmationResult = window.confirmationResult as
          | ConfirmationResult
          | undefined;
        if (!confirmationResult) {
          addToast({
            title: t("login_modal.errors.verification_error_title"),
            description: t("login_modal.errors.verification_error_desc"),
            color: "danger",
          });
          setOtpStep("phone");
          return;
        }

        const userCredential = await confirmationResult.confirm(otp);
        const idToken = await userCredential.user.getIdToken();

        // handlePhoneLogin stores the session itself; auto_register makes a
        // new number an account (same rule as the custom gateway below).
        const response = await handlePhoneLogin({
          idToken,
          dispatch,
          friends_code: friendsCode || undefined,
          renderToast: false,
          auto_register: true,
        });

        if (response && response.success) {
          const user = response.data;
          if (user?.is_register || user?.new_user) {
            setFullName(user?.name ?? "");
            setEmail(user?.email ?? "");
            setOtpStep("details");
          } else {
            addToast({
              title: t("login_modal.welcome_title"),
              description: t("login_modal.login_success_toast"),
              color: "success",
            });
            resetAndClose();
          }
        }
        return;
      }

      if (isCustomGateway) {
        const response = await verifyOtp({
          mobile: otpPhoneNumber,
          otp,
          friends_code: (friendsCode as string) || undefined,
          auto_register: true,
        });

        if (response && response.success && response.data && response.access_token) {
          const user = response.data;
          await completeSignIn(
            user,
            response.access_token,
            Boolean(user.is_register || user.new_user),
          );
        } else if (response) {
          addToast({
            title: t("login_modal.errors.verification_failed_title"),
            description: response.message || "Login failed. Please try again.",
            color: "danger",
          });
        }
      }
    } catch (error) {
      const errorMsg =
        error instanceof Error ? error.message : "Failed to verify OTP";
      console.error("OTP verification error:", errorMsg);
      addToast({
        title: t("login_modal.errors.verification_failed_title"),
        description: errorMsg,
        color: "danger",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // New customer: full name (required) and email (optional).
  const handleSaveDetails = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const errs: { name?: string; email?: string } = {};
    if (fullName.trim().length < 2) {
      errs.name = t("login_modal.errors.name_required");
    }
    if (email.trim() !== "") {
      const emailError = validateEmail(email.trim());
      if (emailError) errs.email = emailError;
    }
    setDetailErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setIsLoading(true);
    try {
      const response = await updateUserData({
        name: fullName.trim(),
        ...(email.trim() !== "" ? { email: email.trim() } : {}),
      });
      if (response && response.success) {
        if (response.data) {
          dispatch(setUserDataRedux(response.data));
          setCookie("user", response.data);
        }
        addToast({
          title: t("login_modal.welcome_title"),
          description: t("login_modal.registration_complete"),
          color: "success",
        });
        resetAndClose();
      } else {
        addToast({
          title: t("login_modal.errors.verification_failed_title"),
          description: response?.message || "Please try again.",
          color: "danger",
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Resend OTP
  const handleResendOtpForLogin = async () => {
    if (resendIn > 0) return;
    setIsResendingOtp(true);

    if (isFirebaseGateway) {
      const firebaseInstance = window.firebaseInstance as
        | FirebaseInstance
        | undefined;
      if (!firebaseInstance) {
        addToast({
          title: t("login_modal.errors.firebase_error_title"),
          description: t("login_modal.errors.firebase_error_desc"),
          color: "danger",
        });
        setIsResendingOtp(false);
        return;
      }

      await handleResendOtp(otpPhoneNumber, firebaseInstance);
      setResendIn(OTP_RESEND_SECONDS);
    } else if (isCustomGateway) {
      try {
        const response = await sendOtp({
          mobile: otpPhoneNumber,
          expires_in: 600,
        });

        if (response.success) {
          addToast({
            title: t("resend_otp_toast.otp_resent_title"),
            description: t("resend_otp_toast.otp_resent_desc"),
            color: "success",
          });
          setResendIn(OTP_RESEND_SECONDS);
        } else {
          addToast({
            title: t("login_modal.errors.verification_failed_title"),
            description:
              response.message || "Failed to resend OTP. Please try again.",
            color: "danger",
          });
        }
      } catch (error) {
        console.error("Custom SMS resend OTP error:", error);
        addToast({
          title: t("login_modal.errors.verification_failed_title"),
          description: "Failed to resend OTP. Please try again.",
          color: "danger",
        });
      }
    }
    setIsResendingOtp(false);
  };

  // Reset the dialog's state when it closes
  const handleModalClose = () => {
    setPhoneError(undefined);
    setOtpPhoneNumber("");
    setOtpStep("phone");
    setResendIn(0);
    setFullName("");
    setEmail("");
    setDetailErrors({});

    if (window.confirmationResult) {
      window.confirmationResult = undefined;
    }
    if (window.firebaseInstance) {
      clearRecaptchaVerifier(window.firebaseInstance);
    }
  };

  const resetAndClose = () => {
    handleModalClose();
    onOpenChange();
  };

  // Resend countdown (audit 1.2).
  useEffect(() => {
    if (resendIn <= 0) return;
    const id = setTimeout(() => setResendIn((s) => Math.max(0, s - 1)), 1000);
    return () => clearTimeout(id);
  }, [resendIn]);

  return (
    <>
      {/* Trigger Button */}
      {triggerView === "btn" ? (
        <MyButton
          id="login-btn"
          color="primary"
          onPress={onOpen}
          startContent={<LogIn size={16} />}
          size="responsive"
          variant="flat"
          className="p-0 text-xs"
        >
          {t("login_modal.button")}
        </MyButton>
      ) : triggerView === "icon" ? (
        <Button
          id="login-btn"
          size="sm"
          onPress={onOpen}
          isIconOnly
          className="p-0 rounded-full bg-transparent text-foreground/50 hover:text-foreground/70"
        >
          <User size={20} />
        </Button>
      ) : (
        <div
          className="text-primary-600 text-md underline cursor-pointer"
          onClick={onOpen}
          id="login-btn"
        >
          {t("login_modal.button")}
        </div>
      )}

      {/* Modal */}
      <Modal
        isOpen={isOpen}
        onOpenChange={(open) => {
          if (!open) handleModalClose();
          onOpenChange();
        }}
        placement="center"
        scrollBehavior="outside"
        backdrop="blur"
        size="md"
        isDismissable={otpStep !== "details"}
        classNames={{
          // `scrollBehavior="outside"` scrolls the whole dialog instead of
          // trapping the fields in a short strip between the pinned header
          // and footer, which left the inputs barely reachable on short
          // viewports. `my-auto` keeps it centred until it outgrows the screen.
          wrapper: "overflow-y-auto",
          base: "rounded-lg my-auto max-h-none",
          header: "border-b border-divider",
          footer: "border-t border-divider",
        }}
      >
        <ModalContent>
          {() => (
            <>
              <ModalHeader className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <TruckElectric className="text-primary" size={24} />
                  <h2 className="font-semibold">
                    {otpStep === "details"
                      ? t("login_modal.details_title")
                      : t("login_modal.welcome_title")}
                  </h2>
                </div>
                <p className="text-sm text-default-500">
                  {otpStep === "details"
                    ? t("login_modal.details_subtitle")
                    : t("login_modal.otp_only_subtitle")}
                </p>
              </ModalHeader>

              <ModalBody className="py-6">
                {otpStep === "phone" ? (
                  <Form
                    className="w-full space-y-6"
                    onSubmit={(e) => {
                      e.preventDefault();
                      handleSendOtpForLogin();
                    }}
                    autoComplete="off"
                  >
                    <div className="flex flex-col gap-6 w-full">
                      <PhoneInput
                        defaultCountry={demoMode ? "in" : undefined}
                        defaultValue={demoMode ? demoNumber : undefined}
                        onPhoneChange={handleOtpPhoneChange}
                        className="w-full"
                        label={t("login_modal.phone_label")}
                        placeholder={t("login_modal.phone_placeholder")}
                      />
                      {phoneError && (
                        <div className="mt-1 text-xs text-danger">
                          {phoneError}
                        </div>
                      )}
                    </div>

                    <Button
                      color="primary"
                      className="w-full font-medium"
                      type="submit"
                      isLoading={isLoading}
                      isDisabled={!otpPhoneNumber}
                    >
                      {t("login_modal.continue")}
                    </Button>
                  </Form>
                ) : otpStep === "verify" ? (
                  <Form
                    className="w-full space-y-6"
                    onSubmit={handleVerifyOtpAndLogin}
                    autoComplete="off"
                  >
                    <div className="flex flex-col gap-6 w-full items-center">
                      <p className="text-sm text-default-500 text-center">
                        {t("login_modal.code_sent_to", {
                          mobile: otpPhoneNumber,
                        })}
                      </p>
                      <InputOtp
                        isRequired
                        length={6}
                        placeholder={t("login_modal.otp_placeholder")}
                        variant="bordered"
                        name="otp"
                        color="primary"
                        size="lg"
                        radius="md"
                        autoComplete="one-time-code"
                        classNames={{
                          wrapper: "flex gap-2 justify-center",
                          errorMessage: "sm:text-xs text-center",
                        }}
                      />
                      <div className="text-center">
                        <p className="text-sm text-default-500 mb-2">
                          {t("login_modal.did_not_receive_code")}
                        </p>
                        <Button
                          variant="light"
                          color="primary"
                          size="sm"
                          type="button"
                          onPress={handleResendOtpForLogin}
                          isLoading={isResendingOtp}
                          isDisabled={isLoading || resendIn > 0}
                          className="text-sm"
                        >
                          {resendIn > 0
                            ? t("login_modal.resend_in", { seconds: resendIn })
                            : t("login_modal.resend_code")}
                        </Button>
                      </div>
                    </div>
                    <Button
                      color="primary"
                      className="w-full font-medium"
                      type="submit"
                      isLoading={isLoading}
                      isDisabled={isResendingOtp}
                    >
                      {t("login_modal.verify_and_login")}
                    </Button>
                    <Button
                      variant="light"
                      className="w-full"
                      onPress={() => {
                        if (window.firebaseInstance) {
                          clearRecaptchaVerifier(window.firebaseInstance);
                        }
                        if (window.confirmationResult) {
                          window.confirmationResult = undefined;
                        }
                        setOtpStep("phone");
                      }}
                      isDisabled={isLoading}
                    >
                      {t("login_modal.change_number")}
                    </Button>
                  </Form>
                ) : (
                  <Form
                    className="w-full space-y-6"
                    onSubmit={handleSaveDetails}
                    autoComplete="off"
                  >
                    <div className="flex flex-col gap-6 w-full">
                      <Input
                        isRequired
                        autoComplete="name"
                        label={t("login_modal.full_name_label")}
                        labelPlacement="outside"
                        placeholder={t("login_modal.full_name_placeholder")}
                        name="name"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        isInvalid={!!detailErrors.name}
                        errorMessage={detailErrors.name}
                        startContent={
                          <User size={18} className="text-default-400" />
                        }
                      />
                      <Input
                        autoComplete="email"
                        label={t("login_modal.email_optional_label")}
                        labelPlacement="outside"
                        placeholder={t("login_modal.email_placeholder")}
                        name="email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        isInvalid={!!detailErrors.email}
                        errorMessage={detailErrors.email}
                        startContent={
                          <Mail size={18} className="text-default-400" />
                        }
                      />
                    </div>
                    <Button
                      color="primary"
                      className="w-full font-medium"
                      type="submit"
                      isLoading={isLoading}
                    >
                      {t("login_modal.continue")}
                    </Button>
                  </Form>
                )}

                {/* Social Login */}
                {otpStep === "phone" && (
                  <>
                    <div className="flex items-center gap-4 mt-6">
                      <Divider className="flex-1" />
                      <span className="text-default-500 text-sm">
                        {t("login_modal.or")}
                      </span>
                      <Divider className="flex-1" />
                    </div>

                    <div className="flex flex-col gap-3 mt-4">
                      {authSettings?.googleLogin && (
                        <GoogleLoginBtn
                          isLoading={isLoading}
                          onOpenChange={onOpenChange}
                          setIsLoading={setIsLoading}
                          context="login"
                        />
                      )}
                      <AppleLoginBtn
                        isLoading={isLoading}
                        onOpenChange={onOpenChange}
                        setIsLoading={setIsLoading}
                        context="login"
                      />
                    </div>
                  </>
                )}
              </ModalBody>

              {otpStep === "phone" && (
                <ModalFooter className="flex items-center justify-center gap-2">
                  <p className="text-center text-sm text-default-500">
                    {t("login_modal.new_customer_hint")}
                  </p>
                </ModalFooter>
              )}
            </>
          )}
        </ModalContent>
      </Modal>
    </>
  );
};

export default LoginModal;
