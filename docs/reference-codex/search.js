import { LRUCache } from "lru-cache";
import { search as searchEmag, source as emagSource } from "./connectors/emag.js";
import { search as searchNotino, source as notinoSource } from "./connectors/notino.js";
import { search as searchBebetei, source as bebeteiSource } from "./connectors/bebetei.js";

const cache = new LRUCache({
  max: 500,
  ttl: 1000 * 60 * 20
});

export async function searchAll(query) {
  const cacheKey = query.toLowerCase();
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const [emag, notino, bebetei] = await Promise.all([
    searchEmag(query),
    searchNotino(query),
    searchBebetei(query)
  ]);

  const results = {
    [emagSource]: emag,
    [notinoSource]: notino,
    [bebeteiSource]: bebetei
  };

  const grouped = groupResults(results);
  const payload = { results, groups: grouped };

  cache.set(cacheKey, payload);
  return payload;
}

function groupResults(resultsBySource) {
  const items = [];
  Object.entries(resultsBySource).forEach(([source, payload]) => {
    (payload?.items || []).forEach((item) => {
      items.push({ ...item, source });
    });
  });

  const groups = new Map();

  items.forEach((item) => {
    const normalizedName = normalizeText(item.name || "");
    if (!normalizedName) return;

    const brand = normalizeText(item.brand || inferBrand(normalizedName));
    const sizeStage = extractSizeStage(normalizedName);
    const productLine = extractProductLine(normalizedName, brand, sizeStage);

    const key = `${brand || "unknown"}|${productLine || "unknown"}|${sizeStage || ""}`;
    const group = groups.get(key) || {
      key,
      brand: brand || null,
      sizeStage: sizeStage || null,
      productLine: productLine || null,
      items: [],
      sources: new Set()
    };

    group.items.push(item);
    group.sources.add(item.source);
    groups.set(key, group);
  });

  return Array.from(groups.values())
    .map((group) => {
      const displayName = pickDisplayName(group.items);
      const score =
        group.sources.size * 100 +
        (group.sizeStage ? 10 : 0) +
        (group.brand ? 5 : 0);
      return {
        key: group.key,
        name: displayName,
        brand: group.brand,
        sizeStage: group.sizeStage,
        productLine: group.productLine,
        sources: Array.from(group.sources),
        score,
        items: group.items
      };
    })
    .sort((a, b) => b.score - a.score);
}

function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9+]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function inferBrand(normalizedName) {
  const [first] = normalizedName.split(" ");
  return first || "";
}

function extractSizeStage(normalizedName) {
  const tokens = normalizedName.split(" ");
  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i];
    const plusMatch = token.match(/^([0-9]{1,2})\+$/);
    if (plusMatch) return `${plusMatch[1]}+`;

    if (/^[0-9]{1,2}$/.test(token)) {
      const prev = tokens[i - 1] || "";
      const next = tokens[i + 1] || "";
      if (isSizeContext(prev) || isSizeContext(next)) return token;
      if (Number(token) <= 8) return token;
    }
  }
  return null;
}

function isSizeContext(token) {
  return ["nr", "no", "numar", "marime", "marimea", "size", "stage", "etapa"].includes(token);
}

function extractProductLine(normalizedName, brand, sizeStage) {
  const stopwords = new Set([
    brand,
    sizeStage,
    "scutece",
    "diapers",
    "pampers",
    "buc",
    "bucati",
    "pack",
    "pachet",
    "jumbo",
    "value",
    "maxi",
    "premium",
    "pants",
    "dry",
    "soft",
    "extra",
    "plus",
    "care"
  ]);

  const tokens = normalizedName
    .split(" ")
    .filter((token) => token && !stopwords.has(token));

  return tokens.slice(0, 4).join(" ");
}

function pickDisplayName(items) {
  const withNames = items.filter((item) => item?.name);
  if (!withNames.length) return "Unnamed product";
  return withNames.sort((a, b) => b.name.length - a.name.length)[0].name;
}
