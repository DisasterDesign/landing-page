/** Requires owner-reviewed private --manifest=FILE. Dry run by default; no provider writes. */
import { readFileSync } from 'node:fs';
import { PrismaClient } from '@prisma/client';
import { parseLegacyImportManifest, planPersonalImport } from '../src/lib/finance/legacy-import';

const prisma = new PrismaClient();
const apply = process.argv.includes('--apply');
async function main() {
    const manifestPath = process.argv.find(arg => arg.startsWith('--manifest='))?.slice('--manifest='.length);
    if (!manifestPath) throw new Error('An owner-reviewed private --manifest=FILE is required');
    let manifestInput: unknown;
    try { manifestInput = JSON.parse(readFileSync(manifestPath, 'utf8')); }
    catch { throw new Error('Unable to read private import manifest'); }
    const manifest = parseLegacyImportManifest(manifestInput);
    const clients = await prisma.client.findMany({ include: { products: { select: { id: true } }, agreements: { select: { id: true, financeBook: true } } } });
    const owner = await prisma.user.findFirst({ where: { isOwner: true }, select: { id: true } });
    if (!owner) throw new Error('Owner missing');
    const operations = planPersonalImport(clients, manifest);
    console.log(JSON.stringify({
        mode: apply ? 'APPLY' : 'DRY_RUN', operations,
        warnings: ['Unapproved missing accounts remain REVIEW_NO_WRITE.', 'Existing client names and archive state are preserved.', 'Ambiguous shared mappings require separate owner-reviewed evidence.'],
    }, null, 2));
    if (!apply) return;
    await prisma.$transaction(async tx => {
        for (const op of operations) {
            if (op.type === 'EXISTING') {
                for (const product of op.products) await tx.clientProduct.upsert({ where: { id: product.data.id }, create: product.data, update: {} });
            }
            if (op.type === 'CREATE_APPROVED') {
                const { evidence } = op;
                const monthlyAmount = evidence.currency === 'ILS' ? evidence.amountMinor / 100 : null;
                const client = await tx.client.upsert({
                    where: { id: op.clientId },
                    create: {
                        id: op.clientId, name: evidence.name,
                        partner: evidence.financeBook === 'PRIVATE' ? 'personal' : 'fuzion', status: 'בוצע',
                        monthlyAmount, cardcomAccountIds: [evidence.accountId], ownerId: owner.id, source: 'import',
                        notes: 'Owner-approved legacy import from private evidence. No legal agreement fabricated.',
                    },
                    update: {},
                });
                await tx.clientProduct.upsert({
                    where: { id: `legacy-product-${client.id}` },
                    create: {
                        id: `legacy-product-${client.id}`, clientId: client.id, name: 'ריטיינר',
                        financeBook: evidence.financeBook, monthlyAmount, status: 'בוצע',
                        notes: `Owner-approved original billing currency ${evidence.currency}. No legal agreement fabricated.`,
                    },
                    update: {},
                });
            }
        }
    }, { timeout: 120000, maxWait: 10000 });
}
main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
