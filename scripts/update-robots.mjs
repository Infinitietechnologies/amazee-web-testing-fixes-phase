import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

// Get the site URL from environment variable
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;

if (!siteUrl) {
    console.warn('⚠️  NEXT_PUBLIC_SITE_URL is not set in environment variables');
    console.warn('⚠️  robots.txt will not be updated');
    process.exit(0);
}

try {
    // Read robots.txt
    const robotsPath = join(process.cwd(), 'public', 'robots.txt');
    let robotsContent = readFileSync(robotsPath, 'utf8');

    // [CHANGE 2026-09-22] This used to ONLY substitute {{SITE_URL}}. The
    // substitution consumes the placeholder, so once a substituted copy was
    // committed — which is exactly what happened upstream — every later build
    // replaced nothing, wrote the file back unchanged, and printed
    // "updated successfully". The Sitemap: line kept pointing at whichever
    // deployment had last run a build.
    //
    // It now rewrites the Sitemap LINE, whatever is currently in it, so the
    // committed state of the file cannot make the build a no-op again. The
    // placeholder still works, for a fresh checkout.
    const base = siteUrl.replace(/\/+$/, '');
    const before = robotsContent;

    robotsContent = robotsContent.replaceAll('{{SITE_URL}}', base);
    robotsContent = robotsContent.replace(/^Sitemap:\s*\S*\s*$/m, `Sitemap: ${base}/sitemap.xml`);

    if (!/^Sitemap:\s*\S+/m.test(robotsContent)) {
        robotsContent = robotsContent.trimEnd() + `\n\nSitemap: ${base}/sitemap.xml\n`;
    }

    // Write back to robots.txt
    writeFileSync(robotsPath, robotsContent, 'utf8');

    console.log(before === robotsContent
        ? '✅ robots.txt already correct'
        : '✅ robots.txt updated successfully');
    console.log(`   Site URL: ${base}`);
} catch (error) {
    console.error('❌ Error updating robots.txt:', error.message);
    process.exit(1);
}
