import { PrismaClient } from '@prisma/client';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

const prisma = new PrismaClient();

function parseArticle(content) {
  const titleMatch = content.match(/^# (.+)$/m);
  const title = titleMatch?.[1]?.trim() || 'Untitled';

  // Body = everything after ---
  const parts = content.split('---');
  const body = parts.length > 1 ? parts.slice(1).join('---').trim() : content;

  return { title, body };
}

async function main() {
  // Read all article files
  const dir = join(process.cwd(), 'seo', 'blog-posts');
  const files = readdirSync(dir)
    .filter(f => f.endsWith('.md') && f !== 'content-plan-50.md')
    .filter(f => /^\d+/.test(f));

  console.log(`Found ${files.length} article files`);

  // Get all existing posts from DB
  const existing = await prisma.blogPost.findMany({
    select: { id: true, title: true },
  });

  // Create title-to-id map
  const titleToId = {};
  for (const post of existing) {
    titleToId[post.title] = post.id;
  }

  let updated = 0;
  let skipped = 0;

  for (const file of files) {
    const content = readFileSync(join(dir, file), 'utf-8');
    const article = parseArticle(content);

    // Find matching post in DB by title prefix match
    let postId = titleToId[article.title];
    if (!postId) {
      // Try partial match
      const prefix = article.title.slice(0, 30);
      for (const [dbTitle, id] of Object.entries(titleToId)) {
        if (dbTitle.startsWith(prefix)) {
          postId = id;
          break;
        }
      }
    }

    if (!postId) {
      console.log(`  SKIP: ${article.title.slice(0, 50)}... (not found in DB)`);
      skipped++;
      continue;
    }

    // Update content in DB
    await prisma.blogPost.update({
      where: { id: postId },
      data: { content: article.body },
    });

    updated++;
    console.log(`  ✓ ${article.title.slice(0, 60)}`);

    // Small delay
    await new Promise(r => setTimeout(r, 30));
  }

  console.log(`\nDone! Updated: ${updated}, Skipped: ${skipped}`);
  await prisma.$disconnect();
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
