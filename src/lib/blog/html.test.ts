import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

test('server blog HTML boundary preserves article formatting and removes executable markup before first render',async()=>{
 const mod=await import('./html').catch(()=>null);assert.ok(mod,'server-side blog sanitizer must exist');
 const html='<h2>עברית</h2><p><strong>חשוב</strong> <em>טקסט</em></p><ul><li>אחד</li></ul><pre><code>let x = 1;</code></pre><img src="/blog/content/example.webp" alt="תמונה"><a href="https://example.invalid" target="_blank">קישור</a>';
 const safe=mod.sanitizeBlogHtml(html+'<script>alert(1)</script><img src="x" onerror="alert(2)"><svg><animate attributeName="href" values="javascript:alert(1)"></animate></svg><a href="javascript:alert(3)">bad</a><iframe srcdoc="<script>alert(4)</script>"></iframe>');
 for(const value of ['<h2>עברית</h2>','<strong>חשוב</strong>','<li>אחד</li>','<code>let x = 1;</code>','/blog/content/example.webp'])assert.ok(safe.includes(value));
 for(const value of ['<script','onerror','javascript:','<svg','<animate','<iframe','srcdoc'])assert.equal(safe.toLowerCase().includes(value),false);
 assert.ok(safe.includes('noopener'));
});
test('JSON-LD serialization cannot close its HTML script element',async()=>{
 const mod=await import('./html').catch(()=>null);assert.ok(mod);
 const value={headline:'</script><script>alert(1)</script>',description:'שלום'};
 const result=mod.jsonForHtmlScript(value);assert.equal(result.includes('<'),false);assert.deepEqual(JSON.parse(result),value);
});
test('blog page sanitizes at the server/client boundary and client has no raw-first hydration window',()=>{
 const page=readFileSync(new URL('../../app/(public)/blog/[slug]/page.tsx',import.meta.url),'utf8');
 const client=readFileSync(new URL('../../app/(public)/blog/[slug]/BlogPostClient.tsx',import.meta.url),'utf8');
 assert.match(page,/content:\s*sanitizeBlogHtml\(post\.content\)/);
 assert.match(page,/jsonForHtmlScript\(jsonLd\)/);
 assert.doesNotMatch(client,/useState<string>\(post\.content\)|import\("dompurify"\)/);
});

test('server allowlist rejects encoded URL schemes and legacy raw-text reparse payloads',async()=>{
 const {sanitizeBlogHtml}=await import('./html');
 const fixtures=[
  ['<a href="jav&#x61;script:alert(1)">x</a>','<a rel="noopener noreferrer">x</a>'],
  ['<img src="data:image/svg+xml,<svg onload=alert(1)>">','<img />'],
  ['<xmp><img src=x onerror=alert(1)></xmp>',''],
  ['<textarea>&lt;img src=x onerror=alert(1)&gt;</textarea>',''],
  // The apparent event handler stays escaped INSIDE a title string. It is inert text.
  ['<math><mtext><table><mglyph><style><!--</style><img title="--><img src=x onerror=alert(1)>">','<table><img title="--&gt;&lt;img src=x onerror=alert(1)&gt;" /></table>'],
 ];
 for(const [payload,expected] of fixtures)assert.equal(sanitizeBlogHtml(payload),expected);
});
