import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const forbidden = ["service_role", "SUPABASE_SERVICE_ROLE_KEY"];

async function scan(directory) {
  const matches = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const filePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      matches.push(...await scan(filePath));
    } else {
      const content = await readFile(filePath, "utf8");
      if (forbidden.some((value) => content.includes(value))) matches.push(filePath);
    }
  }
  return matches;
}

const matches = await scan(path.resolve("src"));
if (matches.length) {
  console.error("Forbidden service-role references in src/:\n" + matches.join("\n"));
  process.exit(1);
}
console.log("No service-role references found in src/.");
