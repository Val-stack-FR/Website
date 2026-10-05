const escape = value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
const inline = value => escape(value).replace(/\*\*([^*]+)\*\*/gu, '<strong>$1</strong>');

// Small display subset: literal headings, paragraphs and emphasis. HTML,
// links, images and code from the source cannot become executable markup.
export function renderSafeMarkdown(text) {
  const blocks = [];
  let paragraph = [];
  const flush = () => { if (paragraph.length) { blocks.push('<p>' + paragraph.map(inline).join('<br />') + '</p>'); paragraph = []; } };
  for (const line of text.split(/\r?\n/u)) {
    if (!line.trim()) { flush(); continue; }
    const heading = /^(#{1,6})\s+(.+)$/u.exec(line);
    if (heading) { flush(); const level = heading[1].length === 1 ? 4 : 5; blocks.push(`<h${level}>${inline(heading[2])}</h${level}>`); }
    else paragraph.push(line);
  }
  flush();
  return blocks.join('\n');
}
