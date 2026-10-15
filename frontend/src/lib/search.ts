import type { Country } from "@/types/api";

export interface ParsedSearch {
  keyword: string;
  location: string;
  country: string | null;
}

const COUNTRY_ALIASES: Record<string, string[]> = {
  CO: ["colombia"],
  ES: ["españa", "espana", "spain"],
  US: ["estados unidos", "eeuu", "ee. uu.", "ee.uu.", "usa", "united states", "us"],
};

export function normalize(text: string): string {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

/**
 * Interpreta frases como "dentistas en Madrid", "dentists in Miami" o
 * "gimnasios en Medellín, Colombia" y deduce el país por la ciudad o por su nombre.
 */
export function parseSearch(text: string, countries: Country[]): ParsedSearch {
  const match = text.trim().match(/^(.*\S)\s+(?:en|in|de)\s+(.+)$/i);
  const keyword = (match ? match[1] : text).trim();
  let location = (match ? match[2] : "").trim();

  let country: string | null = null;
  const normalizedLocation = normalize(location);
  for (const [code, aliases] of Object.entries(COUNTRY_ALIASES)) {
    const alias = aliases.find((item) => normalizedLocation === item || normalizedLocation.endsWith(`, ${item}`) || normalizedLocation.endsWith(` ${item}`));
    if (alias) {
      country = code;
      if (normalizedLocation === alias) location = "";
      break;
    }
  }
  if (!country && location) {
    const city = normalize(location.split(",")[0]);
    country = countries.find((item) => item.cities.some((candidate) => normalize(candidate) === city))?.code ?? null;
  }
  return { keyword, location, country };
}
