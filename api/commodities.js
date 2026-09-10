const SOURCE_URL = "https://www.noticiasagricolas.com.br/cotacoes";

const PRODUCTS = [
  { slug: "soja", label: "SOJA", unit: "R$/SACA 60KG" },
  { slug: "milho", label: "MILHO", unit: "R$/SACA 60KG" },
  { slug: "algodao", label: "ALGODÃO", unit: "CENT R$/LB" },
];

function extractRow(html, slug, titleMatch) {
  const marker = `href="/cotacoes/${slug}" title="${titleMatch}"`;
  const anchorIdx = html.indexOf(marker);
  if (anchorIdx === -1) return null;

  const tbodyIdx = html.indexOf("<tbody", anchorIdx);
  if (tbodyIdx === -1) return null;

  const chunk = html.slice(tbodyIdx, tbodyIdx + 2000);
  const rowMatch = chunk.match(
    /<td>\s*([\d/]+)\s*<\/td>\s*<td>\s*([-\d,.]+)\s*<\/td>\s*<td>\s*(-?[\d,.]+%)\s*<\/td>/
  );
  if (!rowMatch) return null;

  return {
    date: rowMatch[1].trim(),
    value: rowMatch[2].trim(),
    variation: rowMatch[3].trim(),
  };
}

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "s-maxage=1800, stale-while-revalidate=3600");

  try {
    const response = await fetch(SOURCE_URL, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; Totem7Bot/1.0)" },
    });
    if (!response.ok) throw new Error("HTTP " + response.status);
    const html = await response.text();

    const titleBySlug = { soja: "Soja", milho: "Milho", algodao: "Algodão" };
    const result = {};
    for (const p of PRODUCTS) {
      const row = extractRow(html, p.slug, titleBySlug[p.slug]);
      result[p.slug] = row
        ? { label: p.label, unit: p.unit, source: "CEPEA/ESALQ", ...row }
        : null;
    }

    res.status(200).json(result);
  } catch (err) {
    res.status(502).json({ error: "Falha ao buscar cotações agrícolas", message: err.message });
  }
};
