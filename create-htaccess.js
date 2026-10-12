import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// ESM does not provide __dirname by default. Create it from import.meta.url.
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** The admin panel origin allowed to frame the storefront (Home Page Builder live preview). */
export function adminOrigin() {
  try {
    const raw = (process.env.NEXT_PUBLIC_ADMIN_PANEL_URL || "").trim();
    return raw ? new URL(raw).origin : "";
  } catch {
    return "";
  }
}

function generateHtaccess() {
  const outputPath = path.join(__dirname, "out", ".htaccess");

  // Construct the .htaccess content
  // [2026-09-24 security hardening] Static export ignores next.config
  // headers(), so the baseline security headers are sent from here.
  // [2026-09-28] The admin panel's Home Page Builder embeds the storefront
  // in a device frame for live preview, so its origin (from
  // NEXT_PUBLIC_ADMIN_PANEL_URL) is allowed to frame the site alongside the
  // site itself. CSP frame-ancestors supersedes X-Frame-Options in every
  // current browser; XFO stays as the fallback for the no-admin-URL case.
  const frameAncestors = adminOrigin() ? `'self' ${adminOrigin()}` : "'self'";
  const htaccessContent = `<IfModule mod_headers.c>
    Header always set X-Content-Type-Options "nosniff"
    Header always set Referrer-Policy "strict-origin-when-cross-origin"
    Header always set Content-Security-Policy "frame-ancestors ${frameAncestors}"
${adminOrigin() ? "" : '    Header always set X-Frame-Options "SAMEORIGIN"\n'}  </IfModule>
  <IfModule mod_rewrite.c>
    RewriteEngine On
    RewriteBase /
     
    # Dynamic routes (Index pages)
    RewriteRule ^brands/?$ brands/index.html [L]
    RewriteRule ^categories/?$ categories/index.html [L]
    RewriteRule ^delivery-zones/?$ delivery-zones/index.html [L]
    RewriteRule ^feature-sections/?$ feature-sections/index.html [L]
    RewriteRule ^my-account/orders/?$ my-account/orders/index.html [L]
    RewriteRule ^stores/?$ stores/index.html [L]
     
    # Dynamic routes (Slug pages)
    RewriteCond %{REQUEST_FILENAME} !-f
    RewriteRule ^brands/([^/]+)/?$ brands/[slug]/index.html [L]

    RewriteCond %{REQUEST_FILENAME} !-f
    RewriteRule ^categories/([^/]+)/?$ categories/[slug]/index.html [L]

    RewriteCond %{REQUEST_FILENAME} !-f
    RewriteRule ^delivery-zones/([^/]+)/?$ delivery-zones/[slug]/index.html [L]

    RewriteCond %{REQUEST_FILENAME} !-f
    RewriteRule ^feature-sections/([^/]+)/?$ feature-sections/[slug]/index.html [L]

    RewriteCond %{REQUEST_FILENAME} !-f
    RewriteRule ^my-account/orders/([^/]+)/?$ my-account/orders/[slug]/index.html [L]

    # Exclude 'search' from products slug rule
    RewriteCond %{REQUEST_URI} !^/products/search
    RewriteCond %{REQUEST_FILENAME} !-f
    RewriteRule ^products/([^/]+)/?$ products/[slug]/index.html [L]

    RewriteCond %{REQUEST_FILENAME} !-f
    RewriteRule ^section/([^/]+)/?$ section/[id]/index.html [L]

    RewriteCond %{REQUEST_FILENAME} !-f
    RewriteRule ^stores/([^/]+)/?$ stores/[slug]/index.html [L]

    RewriteCond %{REQUEST_FILENAME} !-f
    RewriteRule ^share/products/([^/]+)/?$ share/products/[slug]/index.html [L]
    
    # If the request is not for a valid directory
    RewriteCond %{REQUEST_FILENAME} !-d
    # If the request is not for a valid file
    RewriteCond %{REQUEST_FILENAME} !-f
    # If the request is not for a valid link
    RewriteCond %{REQUEST_FILENAME} !-l

    # Rewrite all other URLs to index.html
    RewriteRule . index.html [L]
  </IfModule>`;

  // Write the content to .htaccess file
  fs.writeFileSync(outputPath, htaccessContent.trim());
  console.log(".htaccess file has been generated successfully.");
}

// Call the function to generate .htaccess
generateHtaccess();
