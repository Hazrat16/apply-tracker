import { type CheerioAPI, load } from 'cheerio';

const MAX_DESCRIPTION = 50_000;

/** HTML fragment → readable plain text (paragraphs and bullet points preserved). */
export function htmlToText(html: string): string {
  const $ = load(`<div id="root">${html}</div>`);
  $('script, style, noscript, template').remove();
  // Source formatting (indentation, newlines between tags) means nothing in HTML:
  // collapse it like a browser does before adding line breaks for block elements.
  $('#root')
    .find('*')
    .addBack()
    .contents()
    .each((_, node) => {
      if (node.type === 'text') node.data = node.data.replace(/\s+/g, ' ');
    });
  $('br').replaceWith('\n');
  $('li').each((_, el) => {
    $(el).prepend('• ').append('\n');
  });
  $('p, div, h1, h2, h3, h4, h5, h6, ul, ol, section, tr').each((_, el) => {
    $(el).append('\n');
  });
  return $('#root')
    .text()
    .replace(/[ \t\u00a0]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{2,}/g, '\n')
    .trim()
    .slice(0, MAX_DESCRIPTION);
}

/**
 * Text that may contain HTML (JSON-LD descriptions are often entity-encoded HTML)
 * → plain text.
 */
export function decodeHtmlText(value: string): string {
  const decoded = load(`<div>${value}</div>`)('div').text();
  return /<[a-z][\s\S]*>/i.test(decoded) ? htmlToText(decoded) : htmlToText(value);
}

/** Visible text of a whole page, for AI extraction. */
export function pageText($: CheerioAPI, maxLength = 20_000): string {
  const root = $('main').length ? $('main') : $('article').length ? $('article') : $('body');
  const clone = root.clone();
  clone.find('script, style, noscript, nav, footer, header, svg, form').remove();
  return htmlToText(clone.html() ?? '').slice(0, maxLength);
}

export const clean = (value: string | undefined | null): string | null => {
  const text = value?.replace(/\s+/g, ' ').trim();
  return text ? text : null;
};
