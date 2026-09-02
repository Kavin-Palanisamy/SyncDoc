import { JSDOM } from 'jsdom';
import DOMPurify from 'dompurify';

const dom = new JSDOM('');
const purify = DOMPurify(dom.window as any);

/**
 * Server-side HTML Sanitizer utilizing DOMPurify on JSDOM.
 * Strictly neutralizes XSS vectors, inline event handlers, script injections, and dangerous schemes.
 */
export class Sanitizer {
  private static readonly PURIFY_CONFIG: Record<string, unknown> = {
    ALLOWED_TAGS: [
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'p', 'span', 'strong', 'em', 'u', 's', 'code', 'pre',
      'ul', 'ol', 'li', 'input', 'blockquote', 'hr',
      'table', 'thead', 'tbody', 'tr', 'th', 'td',
      'div', 'section', 'article', 'a',
    ],
    ALLOWED_ATTR: [
      'class', 'id', 'data-node-id', 'data-node-type',
      'type', 'checked', 'disabled', 'href', 'target', 'rel',
      'title', 'lang', 'aria-label',
    ],
    FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form', 'base', 'link', 'meta'],
    FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'onfocus', 'onblur', 'style'],
    ALLOW_DATA_ATTR: true,
  };

  /**
   * Sanitizes an HTML string to ensure safe rendering
   */
  public static sanitize(rawHTML: string): string {
    if (!rawHTML || typeof rawHTML !== 'string') {
      return '';
    }
    const clean = purify.sanitize(rawHTML, this.PURIFY_CONFIG as any);
    return typeof clean === 'string' ? clean : String(clean);
  }

  /**
   * Escapes plain text content to avoid raw HTML character interpretation
   */
  public static escapeText(text: string): string {
    if (!text || typeof text !== 'string') return '';
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}
