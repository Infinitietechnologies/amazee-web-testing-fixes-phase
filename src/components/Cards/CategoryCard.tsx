import { useScreenType } from "@/hooks/useScreenType";
import { trackCategoryView } from "@/lib/analytics";
import { Category } from "@/types/ApiResponse";
import { CategorySectionStyle } from "@/helpers/categoryStyle";
import { Card, Image } from "@heroui/react";
import Link from "next/link";
import { FC, memo } from "react";

interface CategoryCardProps {
  category: Category;
  /**
   * [2026-09-23 final approval, item 4] Admin-chosen section style. Omitted
   * or "default" renders exactly the card the storefront always had.
   */
  variant?: CategorySectionStyle;
}

const CategoryCard: FC<CategoryCardProps> = ({ category, variant = "default" }) => {
  const link = category?.parent_slug
    ? `/categories/${category.parent_slug}?subcategory=${category.slug}`
    : `/categories/${category.slug}`;

  const screen = useScreenType();

  const track = () =>
    trackCategoryView(category?.id?.toString(), category?.title);

  if (variant === "card") {
    return (
      <Link
        href={link}
        title={category.title}
        onClick={track}
        data-category-style="card"
        className="flex flex-col items-center w-full min-w-0 rounded-2xl border border-default-200 bg-content1 shadow-sm p-2 sm:p-3 transition-shadow hover:shadow-md"
      >
        <div className="w-full aspect-square flex items-center justify-center rounded-xl bg-default-50 overflow-hidden">
          <Image
            src={category.image}
            alt={category.title}
            className="w-3/4 h-3/4 object-contain block"
            loading="eager"
            removeWrapper
          />
        </div>
        <h2
          title={category.title}
          className="mt-2 text-center truncate w-full text-xs sm:text-sm font-medium"
        >
          {category.title}
        </h2>
      </Link>
    );
  }

  if (variant === "full" || variant === "overlay") {
    const overlay = variant === "overlay";

    return (
      <Link
        href={link}
        title={category.title}
        onClick={track}
        data-category-style={variant}
        className="flex flex-col items-center w-full min-w-0 group"
      >
        <div className="relative w-full aspect-square rounded-2xl overflow-hidden bg-default-100">
          <Image
            src={category.image}
            alt={category.title}
            className="absolute inset-0 w-full h-full object-cover block transition-transform duration-300 group-hover:scale-105"
            loading="eager"
            removeWrapper
          />
          {overlay && (
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 via-black/35 to-transparent px-2 pt-6 pb-2">
              <h2
                title={category.title}
                className="text-center truncate w-full text-xs sm:text-sm font-semibold text-white"
              >
                {category.title}
              </h2>
            </div>
          )}
        </div>
        {!overlay && (
          <h2
            title={category.title}
            className="mt-2 text-center truncate w-full text-xs sm:text-sm font-medium"
          >
            {category.title}
          </h2>
        )}
      </Link>
    );
  }

  return (
    <div className="flex flex-col items-center w-full min-w-0">
      <div className="w-full max-w-full overflow-hidden flex items-center justify-center">
        <Card
          className="relative overflow-hidden w-full h-24 sm:h-28 p-0 hover:scale-110 transition-transform border-none rounded-3xl bg-transparent"
          shadow="none"
          isPressable={screen !== "mobile"}
          as={Link}
          href={link}
          title={category.title}
          onPress={() =>
            trackCategoryView(category?.id?.toString(), category?.title)
          }
        >
          <div className="absolute left-1/2 bottom-0 -translate-x-1/2 flex justify-center w-full">
            <Image
              src={category.image}
              alt={category.title}
              className="w-16 h-16 sm:w-20 sm:h-20 object-contain block"
              classNames={{
                img: "rounded-lg object-contain block",
              }}
              loading="eager"
              removeWrapper
            />
          </div>
        </Card>
      </div>
      <div className="h-8 flex items-center w-full min-w-0">
        <h2
          title={category.title}
          className="text-center truncate w-full text-xs font-medium px-1"
        >
          {category.title}
        </h2>
      </div>
    </div>
  );
};

export default memo(CategoryCard);
