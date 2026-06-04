import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const sidebarPath = join(process.cwd(), "src", "components", "Sidebar.tsx");
const buildVersion = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, "");

const source = readFileSync(sidebarPath, "utf8");
const pattern = /const\s+buildVersion\s*=\s*"\d{12}";/;

if (!pattern.test(source)) {
  throw new Error("Could not find buildVersion constant in Sidebar.tsx");
}

const updated = source.replace(pattern, `const buildVersion = "${buildVersion}";`);

if (updated !== source) {
  writeFileSync(sidebarPath, updated, "utf8");
  console.log(`Updated build number to ${buildVersion}`);
} else {
  console.log(`Build number already up to date: ${buildVersion}`);
}
