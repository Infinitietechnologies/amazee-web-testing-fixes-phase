import { Product } from "@/types/ApiResponse";
import { Card, CardBody, CardHeader, Avatar, Chip } from "@heroui/react";
import Link from "next/link";
import { FC } from "react";
import { useTranslation } from "react-i18next";
import { Star, BadgeCheck, MapPin, Phone, Mail } from "lucide-react"; // ⭐ Lucide icon

const SoldBySection: FC<{ product: Product }> = ({ product }) => {
  const { t } = useTranslation();
  const {
    seller,
    variants,
    store_status = {
      is_open: false,
      current_slot: null,
      next_opening_time: null,
    },
    seller_ratings,
    seller_details,
  } = product || {};
  const defaultVariant = variants?.[0];
  const seller_rating = seller_ratings?.average_rating || 0;

  return (
    <Card className="w-full">
      <CardHeader className="flex items-center gap-3">
        <Avatar
          size="lg"
          src="https://placehold.co/600x400/000000/FFFFFF.png?text=Seller"
          name={seller || t("soldBySection.noLogo")}
          radius="lg"
        />
        <div className="flex flex-col">
          <div className="flex gap-2 justify-start items-center">
            <h3 className="text-medium font-semibold">
              {seller || t("soldBySection.noSellerInfo")}
            </h3>

            {/* Seller rating */}
            <div className="flex items-center gap-1 mt-0.5">
              <Star size={16} className="text-yellow-500 fill-yellow-500" />
              <span className="text-sm font-medium">
                {!isNaN(Number(seller_rating))
                  ? Number(seller_rating).toFixed(1)
                  : ""}
              </span>
            </div>
          </div>

          {/* Store link */}
          {defaultVariant?.store_slug && (
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs text-foreground/50">
                {t("soldBySection.storeLabel")}
              </span>
              <Link
                href={`/stores/${defaultVariant.store_slug}`}
                className="text-xs text-foreground/50"
                title={defaultVariant.store_name}
              >
                {defaultVariant.store_name}
              </Link>
            </div>
          )}
        </div>
      </CardHeader>

      <CardBody className="pt-1">
        {store_status?.is_open !== undefined && (
          <Chip
            color={store_status.is_open ? "success" : "danger"}
            variant="flat"
            className="mb-2"
          >
            {store_status.is_open
              ? t("soldBySection.open")
              : t("soldBySection.closed")}
          </Chip>
        )}

        <p className="text-sm text-foreground/50 mb-1">
          {store_status?.is_open
            ? t("soldBySection.acceptingOrders")
            : t("soldBySection.storeClosed")}
        </p>

        {/* Show next opening time only if closed */}
        {!store_status?.is_open && store_status?.next_opening_time && (
          <p className="text-sm text-primary font-medium">
            {t("soldBySection.opensAt")} {store_status.next_opening_time}
          </p>
        )}

        {/*
          [CHANGE 2026-09-13] §10 — who the customer is actually buying from.
          Until now this card said "Sold by <store>" and nothing else: no
          business name, no registration status, no address, no way to contact
          the seller before ordering.

          Every value comes from `product.seller_details`, the one block the
          website, Android and iOS all read — no seller data is hardcoded here
          or duplicated per client. Each line renders only when the backend
          actually has that value, so a seller with no contact number shows one
          fewer row rather than an empty label.
        */}
        {seller_details && (
          <div className="mt-3 border-t border-default-200 pt-3 flex flex-col gap-1.5">
            {seller_details.business_name && (
              <p className="text-sm font-medium">{seller_details.business_name}</p>
            )}

            {seller_details.legal_name &&
              seller_details.legal_name !== seller_details.business_name && (
                <p className="text-xs text-foreground/50">
                  {seller_details.legal_name}
                </p>
              )}

            <div className="flex items-center gap-2 flex-wrap">
              <Chip
                size="sm"
                variant="flat"
                color={
                  seller_details.gst_registration_status === "REGISTERED"
                    ? "success"
                    : "default"
                }
              >
                {seller_details.gst_registration_status === "REGISTERED"
                  ? t("soldBySection.gstRegistered")
                  : t("soldBySection.gstNotRegistered")}
              </Chip>

              {/* Shown only for a registration an admin has verified. */}
              {seller_details.gstin && (
                <span className="inline-flex items-center gap-1 text-xs text-foreground/70">
                  <BadgeCheck size={14} className="text-success" />
                  {t("soldBySection.gstin")}: {seller_details.gstin}
                </span>
              )}
            </div>

            {(seller_details.address ||
              seller_details.city ||
              seller_details.state) && (
              <p className="flex items-start gap-1.5 text-xs text-foreground/60">
                <MapPin size={14} className="mt-0.5 shrink-0" />
                <span>
                  {[
                    seller_details.address,
                    seller_details.city,
                    seller_details.state,
                  ]
                    .filter(Boolean)
                    .join(", ")}
                </span>
              </p>
            )}

            {seller_details.customer_care_number && (
              <a
                href={`tel:${seller_details.customer_care_number}`}
                className="flex items-center gap-1.5 text-xs text-foreground/60 hover:text-primary"
              >
                <Phone size={14} className="shrink-0" />
                {seller_details.customer_care_number}
              </a>
            )}

            {seller_details.email && (
              <a
                href={`mailto:${seller_details.email}`}
                className="flex items-center gap-1.5 text-xs text-foreground/60 hover:text-primary break-all"
              >
                <Mail size={14} className="shrink-0" />
                {seller_details.email}
              </a>
            )}
          </div>
        )}
      </CardBody>
    </Card>
  );
};

export default SoldBySection;
