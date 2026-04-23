import { PrismaClient } from '@prisma/client';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

const prisma = new PrismaClient();

function generateSlug(title) {
  return (
    title
      .trim()
      .replace(/\s+/g, '-')
      .replace(/[^\w֐-׿-]/g, '')
      .toLowerCase() +
    '-' +
    Date.now().toString(36) +
    '-' +
    Math.random().toString(36).slice(2, 6)
  );
}

function parseArticle(content) {
  const titleMatch = content.match(/^# (.+)$/m);
  const keywordMatch = content.match(/^## מילת מפתח ראשית:\s*(.+)$/m);
  const categoryMatch = content.match(/^## קטגוריה:\s*(.+)$/m);
  const tagsMatch = content.match(/^## תגיות:\s*(.+)$/m);

  const title = titleMatch?.[1]?.trim() || 'Untitled';
  const targetKeyword = keywordMatch?.[1]?.trim() || '';
  const category = categoryMatch?.[1]?.trim() || '';
  const tags = tagsMatch ? tagsMatch[1].split(',').map(t => t.trim()) : [];

  // Body = everything after ---
  const parts = content.split('---');
  const body = parts.length > 1 ? parts.slice(1).join('---').trim() : content;

  // Excerpt = first paragraph
  const paragraphs = body.split('\n\n').filter(p => p.trim() && !p.trim().startsWith('#'));
  const excerpt = paragraphs[0]?.slice(0, 200) + '...' || '';

  return { title, targetKeyword, category, tags, body, excerpt };
}

async function main() {
  // Find admin user
  const admin = await prisma.user.findFirst({
    where: { role: 'ADMIN' },
    select: { id: true },
  });

  if (!admin) {
    console.error('No admin user found');
    process.exit(1);
  }

  console.log(`Admin user: ${admin.id}`);

  // Read all article files
  const dir = join(process.cwd(), 'seo', 'blog-posts');
  const files = readdirSync(dir)
    .filter(f => f.endsWith('.md') && f !== 'content-plan-50.md')
    .filter(f => /^\d+/.test(f))
    .sort((a, b) => {
      const numA = parseInt(a.match(/^(\d+)/)[1]);
      const numB = parseInt(b.match(/^(\d+)/)[1]);
      return numA - numB;
    });

  console.log(`Found ${files.length} article files`);

  // Check which titles already exist
  const existing = await prisma.blogPost.findMany({
    select: { title: true },
  });
  const existingTitles = new Set(existing.map(e => e.title));
  console.log(`Existing posts in DB: ${existingTitles.size}`);

  let created = 0;
  let skipped = 0;

  for (const file of files) {
    const content = readFileSync(join(dir, file), 'utf-8');
    const article = parseArticle(content);

    // Skip if already exists
    if (existingTitles.has(article.title)) {
      console.log(`  SKIP: ${article.title.slice(0, 50)}... (already exists)`);
      skipped++;
      continue;
    }

    const slug = generateSlug(article.title);

    await prisma.blogPost.create({
      data: {
        title: article.title,
        slug,
        content: article.body,
        excerpt: article.excerpt,
        category: article.category,
        tags: article.tags,
        targetKeyword: article.targetKeyword,
        keywords: [article.targetKeyword, ...article.tags.slice(0, 5)],
        metaTitle: article.title.slice(0, 60),
        metaDesc: article.excerpt.slice(0, 155),
        status: 'DRAFT',
        published: false,
        authorId: admin.id,
      },
    });

    created++;
    console.log(`  ✓ ${article.title.slice(0, 60)}`);

    // Small delay to avoid slug collision (timestamp-based)
    await new Promise(r => setTimeout(r, 50));
  }

  console.log(`\nDone! Created: ${created}, Skipped: ${skipped}`);
  await prisma.$disconnect();
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
