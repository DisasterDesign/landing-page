import sanitizeHtml from 'sanitize-html';

/** Opaque HTML produced by the server allowlist, never raw CMS HTML. */
export type SanitizedBlogHtml = string & { readonly __sanitizedBlogHtml: unique symbol };

/** Keep article formatting in SSR while denying executable HTML before hydration. */
export function sanitizeBlogHtml(input: string): SanitizedBlogHtml {
  return sanitizeHtml(input, {
    allowedTags: ['p', 'br', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'strong', 'b', 'em', 'i', 'u', 's', 'del', 'blockquote', 'pre', 'code', 'ul', 'ol', 'li', 'hr', 'a', 'img', 'figure', 'figcaption', 'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td'],
    allowedAttributes: {
      a: ['href', 'title', 'target', 'rel'],
      img: ['src', 'alt', 'title', 'width', 'height', 'loading'],
      ol: ['start'],
      th: ['colspan', 'rowspan'],
      td: ['colspan', 'rowspan'],
      code: ['class'],
    },
    allowedClasses: { code: [/^language-[a-z0-9-]+$/i] },
    allowedSchemes: ['http', 'https', 'mailto', 'tel'],
    allowedSchemesByTag: { img: ['http', 'https'] },
    allowProtocolRelative: false,
    disallowedTagsMode: 'discard',
    nonTextTags: ['script', 'style', 'textarea', 'option', 'noscript', 'xmp', 'noembed', 'noframes', 'iframe', 'title', 'template'],
    nestingLimit: 50,
    transformTags: {
      a: (_tag, attributes) => ({ tagName: 'a', attribs: { ...attributes, rel: 'noopener noreferrer' } }),
    },
  }) as SanitizedBlogHtml;
}

/** JSON in an HTML script element must never contain a literal tag opener. */
export function jsonForHtmlScript(value: unknown): string {
  const json = JSON.stringify(value);
  if (json === undefined) throw new TypeError('Expected JSON data');
  return json.replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
}
