import { getCookie } from "@/lib/cookies";
import { AxiosInstance, AxiosResponse, AxiosError } from "axios";
import { maintenanceStore } from "@/stores/maintenanceStore";
import { addToast } from "@heroui/react";

let restrictedAccountLogoutInProgress = false;
const DEVICE_ID_STORAGE_KEY = "amazee_device_id";

/**
 * Return one random, non-personal identifier for this browser installation.
 * The API hashes it before storage and uses the hash only to enforce the
 * registration-bonus per-device limit.
 */
const getDeviceId = (): string => {
  if (typeof window === "undefined") return "";

  try {
    const stored = window.localStorage.getItem(DEVICE_ID_STORAGE_KEY);
    if (stored) return stored;

    const generated =
      typeof window.crypto?.randomUUID === "function"
        ? window.crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random()
            .toString(36)
            .slice(2)}`;

    window.localStorage.setItem(DEVICE_ID_STORAGE_KEY, generated);
    return generated;
  } catch {
    // Storage can be unavailable in strict privacy modes. Keep the request
    // working; the backend still applies its IP and phone safeguards.
    return "";
  }
};

// Helper function to clean token (remove quotes if present)
const cleanToken = (token: string): string => {
  if (!token) return "";

  // Remove surrounding quotes if they exist
  return token.replace(/^["']|["']$/g, "").trim();
};

export const setupInterceptors = (instance: AxiosInstance): void => {
  // Request Interceptor - Combined logic
  instance.interceptors.request.use(
    (config) => {
      // First, check if we have a token in params (for SSR)
      const paramToken = config?.params?.access_token || "";

      if (paramToken) {
        const cleanedToken = cleanToken(paramToken);
        if (config.headers) {
          config.headers.set("Authorization", `Bearer ${cleanedToken}`);
        }
        // Remove the token from params to avoid sending it in the URL
        delete config.params.access_token;
      } else if (typeof window !== "undefined") {
        // If no param token and not SSR, try to get from cookies (client-side)
        const access_token = getCookie("access_token") || "";
        if (access_token) {
          if (config.headers) {
            config.headers.set("Authorization", `Bearer ${access_token}`);
          }
        }
      }

      if (typeof window !== "undefined" && config.headers) {
        const deviceId = getDeviceId();
        if (deviceId) {
          config.headers.set("X-Device-Id", deviceId);
        }
      }

      if (config?.params?.scope_category_slug === "all") {
        delete config.params.scope_category_slug;
      }

      return config;
    },
    (error: AxiosError) => {
      return Promise.reject(error);
    }
  );

  // Response Interceptor
  instance.interceptors.response.use(
    (response: AxiosResponse) => {
      // Clear maintenance state on successful response (non-503)
      if (typeof window !== "undefined") {
        maintenanceStore.setMaintenance(false, null);
      }
      return response;
    },
    (error: AxiosError) => {
      if (error.response) {
        switch (error.response.status) {
          case 401:
            console.error("Unauthorized request");
            if (typeof window !== "undefined") {
              const { handleLogout } = require("@/helpers/auth");
              handleLogout(false);
            }
            break;
          case 403:
            console.error("Forbidden access");
            if (typeof window !== "undefined") {
              const responseData = error.response.data as {
                error_code?: string;
                message?: string;
              };
              const restrictedAccountCodes = [
                "account_suspended",
                "account_deleted",
              ];
              const requestHeaders = error.config?.headers as any;
              const hadBearerToken = Boolean(
                requestHeaders?.get?.("Authorization") ||
                  requestHeaders?.Authorization,
              );

              if (
                hadBearerToken &&
                responseData?.error_code &&
                restrictedAccountCodes.includes(responseData.error_code) &&
                !restrictedAccountLogoutInProgress
              ) {
                restrictedAccountLogoutInProgress = true;
                const { handleLogout } = require("@/helpers/auth");

                void handleLogout(false, true).finally(() => {
                  addToast({
                    title: "Account access blocked",
                    description:
                      responseData.message ||
                      "Your account is not available. Please contact support.",
                    color: "danger",
                  });
                  restrictedAccountLogoutInProgress = false;
                });
              }
            }
            break;
          case 500:
            console.error("Server error");
            break;
          case 503:
            // Check for maintenance mode in 503 response
            if (typeof window !== "undefined") {
              try {
                const responseData = error.response.data;
                // Check if response has maintenance: true
                if (
                  responseData &&
                  typeof responseData === "object" &&
                  (responseData as any).maintenance === true
                ) {
                  const message =
                    (responseData as any).message || null;
                  maintenanceStore.setMaintenance(true, message);
                } else {
                  // If 503 but no maintenance flag, clear maintenance state
                  maintenanceStore.setMaintenance(false, null);
                }
              } catch (e) {
                console.error("Error parsing 503 response:", e);
                maintenanceStore.setMaintenance(false, null);
              }
            }
            break;
          case 422:
            /**
             * Validation response, not a system fault — the caller inspects the
             * body and decides. Several endpoints answer this way as normal
             * flow (e.g. /scheduled-delivery/.../dates for a store that doesn't
             * offer scheduling), so logging it at error level filled the
             * console on an ordinary cart view.
             */
            console.warn(`Validation error: ${error.response.status}`);
            if (typeof window !== "undefined") {
              maintenanceStore.setMaintenance(false, null);
            }
            break;
          default:
            console.error(`Error: ${error.response.status}`);
            // Clear maintenance state for other errors
            if (typeof window !== "undefined") {
              maintenanceStore.setMaintenance(false, null);
            }
        }
      } else if (error.request) {
        console.error("No response received from server");
      } else {
        console.error("Request setup error:", error.message);
      }
      return Promise.reject(error);
    }
  );
};
