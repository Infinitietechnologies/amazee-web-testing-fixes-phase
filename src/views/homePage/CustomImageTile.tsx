import type { CSSProperties, FC } from "react";
import Link from "next/link";

/**
 * [v3.2 port 2026-09-28] One tile of a Home Builder `custom_image` category or
 * brand rail: the admin's own artwork, linked, at its natural aspect ratio.
 *
 * The resolver already swaps the section artwork into `category.image` /
 * `brand.logo` (and may send it as `custom_image_url`), so the caller passes
 * whichever is present. The title stays available to assistive technology as
 * the image's alt text and the link's title.
 */
interface CustomImageTileProps {
  href: string;
  image: string;
  title: string;
  onClick?: () => void;
  className?: string;
  imageStyle?: CSSProperties;
}

const CustomImageTile: FC<CustomImageTileProps> = ({
  href,
  image,
  title,
  onClick,
  className = "",
  imageStyle,
}) => (
  <Link
    href={href}
    title={title}
    onClick={onClick}
    className={`block max-w-full overflow-hidden rounded-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${className}`}
    data-testid="home-custom-image-tile"
  >
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img
      src={image}
      alt={title}
      loading="lazy"
      className="block h-auto max-h-56 w-auto max-w-full rounded-xl object-contain"
      style={imageStyle}
    />
  </Link>
);

export default CustomImageTile;
