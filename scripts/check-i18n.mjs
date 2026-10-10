import fs from "node:fs";

const source = fs.readFileSync(new URL("../src/i18n/messages.ts", import.meta.url), "utf8");
const split = source.split("export const en:");
if (split.length !== 2) throw new Error("Unable to locate Arabic and English dictionaries.");
const keyPattern = /\n\s*"([^"]+)"\s*:/gu;
const arKeys = [...split[0].matchAll(keyPattern)].map((match) => match[1]);
const enKeys = [...split[1].matchAll(keyPattern)].map((match) => match[1]);
const missingEn = arKeys.filter((key) => !enKeys.includes(key));
const extraEn = enKeys.filter((key) => !arKeys.includes(key));
const duplicates = (keys) => keys.filter((key, index) => keys.indexOf(key) !== index);
if (missingEn.length || extraEn.length || duplicates(arKeys).length || duplicates(enKeys).length) {
  throw new Error(JSON.stringify({ missingEn, extraEn, duplicateAr: [...new Set(duplicates(arKeys))], duplicateEn: [...new Set(duplicates(enKeys))] }, null, 2));
}
console.log(`i18n check passed: ${arKeys.length} keys in Arabic and English.`);
