// components/HTMLRenderer.tsx

import { FC } from "react";
import { sanitizeHtml } from "@/helpers/sanitizeHtml";

interface HTMLRendererProps {
  html: string;
  className?: string;
}

const HTMLRenderer: FC<HTMLRendererProps> = ({ html, className }) => {
  return (
    <div
      className={`html-content ${className ?? ""}`}
      dangerouslySetInnerHTML={{ __html: sanitizeHtml(html) }}
    />
  );
};

export default HTMLRenderer;
