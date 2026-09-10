const SOURCE_URL = "https://www.noticiasagricolas.com.br/cotacoes";

const PRODUCTS = [
  { slug: "soja", label: "SOJA", nameStartsWith: "soja", prefix: "R$ " },
  { slug: "milho", label: "MILHO", nameStartsWith: "milho", prefix: "R$ " },
  { slug: "algodao", label: "ALGODÃO", nameStartsWith: "algod", prefix: "" },
];

function parseCepeaTable(html) {
  const startIdx = html.indexOf("INDICADORES CEPEA");
  if (startIdx === -1) return null;

  const tbodyIdx = html.indexOf("<tbody", startIdx);
  const tbodyEnd = html.indexOf("</tbody>", tbodyIdx);
  if (tbodyIdx === -1 || tbodyEnd === -1) return null;
  const tbodyHtml = html.slice(tbodyIdx, tbodyEnd);

  let date = null;
  const dateMatch = tbodyHtml.match(/Valores do dia:\s*([\d/]+)/);
  if (dateMatch) date = dateMatch[1].trim();

  const rows = [];
  const rowRe = /<tr[^>]*>([\s\S]*?)<\/tr>/g;
  let m;
  while ((m = rowRe.exec(tbodyHtml))) {
    const rowHtml = m[1];
    const spans = [...rowHtml.matchAll(/<span>([^<]*)<\/span>/g)].map(s => s[1].trim());
    if (spans.length >= 3) {
      rows.push({ name: spans[0], value: spans[1], variation: spans[2] });
    }
  }

  return { rows, date };
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

    const table = parseCepeaTable(html);
    const result = {};
    for (const p of PRODUCTS) {
      const row = table && table.rows.find(r =>
        r.name.toLowerCase().startsWith(p.nameStartsWith)
      );
      const unitMatch = row && row.name.match(/\(([^)]+)\)/);
      result[p.slug] = row
        ? {
            label: p.label,
            unit: unitMatch ? unitMatch[1].toUpperCase() : "",
            prefix: p.prefix,
            source: "CEPEA/ESALQ",
            date: (table && table.date) || "",
            value: row.value,
            variation: row.variation.replace(/\s+/g, ""),
          }
        : null;
    }

    res.status(200).json(result);
  } catch (err) {
    res.status(502).json({ error: "Falha ao buscar cotações agrícolas", message: err.message });
  }
};
