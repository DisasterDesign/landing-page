import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import ts from "typescript";

const projectRoot = process.cwd();
const srcRoot = path.join(projectRoot, "src");
const apiRoot = path.join(srcRoot, "app", "api");

const models = [
  "contactSubmission",
  "contactNote",
  "leadEvent",
  "leadInteraction",
  "leadFollowUp",
  "agreement",
  "sellerCommission",
] as const;

type ModelName = (typeof models)[number];
type MutationMethod =
  | "create"
  | "createMany"
  | "update"
  | "updateMany"
  | "upsert"
  | "delete"
  | "deleteMany";

interface DelegateMutation {
  file: string;
  line: number;
  model: ModelName;
  method: MutationMethod;
  call: ts.CallExpression;
  sourceFile: ts.SourceFile;
}

const modelNames = new Set<string>(models);
const mutationMethods = new Set<MutationMethod>([
  "create",
  "createMany",
  "update",
  "updateMany",
  "upsert",
  "delete",
  "deleteMany",
]);

function relative(file: string): string {
  return path.relative(projectRoot, file).split(path.sep).join("/");
}

function walk(
  directory: string,
  predicate: (file: string) => boolean,
): string[] {
  return fs
    .readdirSync(directory, { withFileTypes: true })
    .flatMap((entry) => {
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) return walk(absolute, predicate);
      return predicate(absolute) ? [absolute] : [];
    })
    .sort();
}

function isSourceFile(file: string): boolean {
  return /\.(?:ts|tsx)$/.test(file);
}

function isTestFile(file: string): boolean {
  return /\.test\.(?:ts|tsx)$/.test(file);
}

function parse(file: string): ts.SourceFile {
  return ts.createSourceFile(
    file,
    fs.readFileSync(file, "utf8"),
    ts.ScriptTarget.Latest,
    true,
    file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
}

function memberName(node: ts.Node): string | null {
  if (ts.isPropertyAccessExpression(node)) return node.name.text;
  if (
    ts.isElementAccessExpression(node) &&
    node.argumentExpression &&
    (ts.isStringLiteral(node.argumentExpression) ||
      ts.isNoSubstitutionTemplateLiteral(node.argumentExpression))
  ) {
    return node.argumentExpression.text;
  }
  return null;
}

function memberReceiver(node: ts.Node): ts.Expression | null {
  if (ts.isPropertyAccessExpression(node)) return node.expression;
  if (ts.isElementAccessExpression(node)) return node.expression;
  return null;
}

function collectDelegateAliases(sourceFile: ts.SourceFile): Map<string, ModelName> {
  const aliases = new Map<string, ModelName>();

  function visit(node: ts.Node): void {
    if (ts.isVariableDeclaration(node)) {
      if (ts.isIdentifier(node.name) && node.initializer) {
        const directModel = memberName(node.initializer);
        if (directModel && modelNames.has(directModel)) {
          aliases.set(node.name.text, directModel as ModelName);
        } else if (
          ts.isIdentifier(node.initializer) &&
          aliases.has(node.initializer.text)
        ) {
          aliases.set(node.name.text, aliases.get(node.initializer.text)!);
        }
      }

      if (ts.isObjectBindingPattern(node.name)) {
        for (const element of node.name.elements) {
          if (!ts.isIdentifier(element.name)) continue;
          const importedName = element.propertyName
            ? memberName(element.propertyName) ??
              (ts.isIdentifier(element.propertyName)
                ? element.propertyName.text
                : null)
            : element.name.text;
          if (importedName && modelNames.has(importedName)) {
            aliases.set(element.name.text, importedName as ModelName);
          }
        }
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return aliases;
}

function scanDelegateMutations(file: string): DelegateMutation[] {
  const sourceFile = parse(file);
  const aliases = collectDelegateAliases(sourceFile);
  const found: DelegateMutation[] = [];

  function visit(node: ts.Node): void {
    if (ts.isCallExpression(node)) {
      const method = memberName(node.expression);
      const receiver = memberReceiver(node.expression);
      if (method && receiver && mutationMethods.has(method as MutationMethod)) {
        const directModel = memberName(receiver);
        const aliasModel =
          ts.isIdentifier(receiver) && aliases.has(receiver.text)
            ? aliases.get(receiver.text)!
            : null;
        const model =
          directModel && modelNames.has(directModel)
            ? (directModel as ModelName)
            : aliasModel;
        if (model) {
          const { line } = sourceFile.getLineAndCharacterOfPosition(
            node.getStart(sourceFile),
          );
          found.push({
            file: relative(file),
            line: line + 1,
            model,
            method: method as MutationMethod,
            call: node,
            sourceFile,
          });
        }
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return found;
}

function formatMutation(mutation: DelegateMutation, reason: string): string {
  return `${mutation.file}:${mutation.line} ${mutation.model}.${mutation.method} — ${reason}`;
}

function assertNoViolations(title: string, violations: string[]): void {
  assert.deepEqual(
    violations,
    [],
    `${title}\n${violations.map((violation) => `- ${violation}`).join("\n")}`,
  );
}

function containingFunctionName(node: ts.Node): string | null {
  let current: ts.Node | undefined = node;
  while (current) {
    if (
      (ts.isFunctionDeclaration(current) ||
        ts.isFunctionExpression(current) ||
        ts.isMethodDeclaration(current)) &&
      current.name
    ) {
      return current.name.getText();
    }
    if (
      ts.isArrowFunction(current) &&
      ts.isVariableDeclaration(current.parent) &&
      ts.isIdentifier(current.parent.name)
    ) {
      return current.parent.name.text;
    }
    current = current.parent;
  }
  return null;
}

function objectPropertyNames(node: ts.Expression | undefined): Set<string> | null {
  if (!node || !ts.isObjectLiteralExpression(node)) return null;
  const names = new Set<string>();
  for (const property of node.properties) {
    if (ts.isSpreadAssignment(property)) return null;
    if (
      ts.isPropertyAssignment(property) ||
      ts.isShorthandPropertyAssignment(property) ||
      ts.isMethodDeclaration(property)
    ) {
      const propertyName = property.name;
      const name =
        ts.isIdentifier(propertyName) ||
        ts.isStringLiteral(propertyName) ||
        ts.isNoSubstitutionTemplateLiteral(propertyName) ||
        ts.isNumericLiteral(propertyName)
          ? propertyName.text
          : ts.isComputedPropertyName(propertyName) &&
              (ts.isStringLiteral(propertyName.expression) ||
                ts.isNoSubstitutionTemplateLiteral(propertyName.expression))
            ? propertyName.expression.text
            : null;
      if (!name) return null;
      names.add(name);
      continue;
    }
    return null;
  }
  return names;
}

function mutationDataKeys(mutation: DelegateMutation): Set<string> | null {
  const options = mutation.call.arguments[0];
  if (!options || !ts.isObjectLiteralExpression(options)) return null;
  const dataProperty = options.properties.find(
    (property): property is ts.PropertyAssignment =>
      ts.isPropertyAssignment(property) &&
      (memberName(property.name) ??
        (ts.isIdentifier(property.name) ? property.name.text : null)) ===
        "data",
  );
  return objectPropertyNames(dataProperty?.initializer);
}

test("spread lifecycle payloads are treated as unknown writes", () => {
  const sourceFile = ts.createSourceFile(
    "spread-writer.ts",
    "prisma.agreement.update({ data: { ...payload } });",
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const statement = sourceFile.statements[0];
  assert.ok(statement && ts.isExpressionStatement(statement));
  assert.ok(ts.isCallExpression(statement.expression));

  const mutation: DelegateMutation = {
    file: "spread-writer.ts",
    line: 1,
    model: "agreement",
    method: "update",
    call: statement.expression,
    sourceFile,
  };

  assert.equal(mutationDataKeys(mutation), null);
});

test("API routes never mutate canonical Lead history directly", () => {
  const forbiddenModels = new Set<ModelName>([
    "contactSubmission",
    "contactNote",
    "leadEvent",
    "leadInteraction",
    "leadFollowUp",
  ]);
  const violations = walk(
    apiRoot,
    (file) => path.basename(file) === "route.ts",
  )
    .flatMap(scanDelegateMutations)
    .filter((mutation) => forbiddenModels.has(mutation.model))
    .map((mutation) =>
      formatMutation(
        mutation,
        "API mutations must call a canonical writer under src/lib/leads",
      ),
    );

  assertNoViolations("Direct canonical Lead writers found in API routes", violations);
});

test("non-test source files obey exact model writer allow-lists", () => {
  const allowedContactSubmissionWriters = new Set([
    "src/lib/leads/lifecycle.ts",
    "src/lib/leads/interactions.ts",
    "src/lib/leads/follow-ups.ts",
    "src/lib/leads/corrections.ts",
    "src/lib/leads/agreement-lifecycle.ts",
  ]);
  const allowedLeadFollowUpWriters = new Set([
    "src/lib/leads/follow-ups.ts",
    "src/lib/leads/lifecycle.ts",
  ]);
  const agreementLifecycle = "src/lib/leads/agreement-lifecycle.ts";
  const violations: string[] = [];

  const mutations = walk(
    srcRoot,
    (file) => isSourceFile(file) && !isTestFile(file),
  ).flatMap(scanDelegateMutations);

  for (const mutation of mutations) {
    const { file, model, method } = mutation;
    const destructive = method === "delete" || method === "deleteMany";

    if (model === "contactSubmission") {
      if (destructive) {
        violations.push(
          formatMutation(mutation, "Lead records are permanent CRM history"),
        );
      } else if (!allowedContactSubmissionWriters.has(file)) {
        violations.push(
          formatMutation(
            mutation,
            "ContactSubmission writes are outside the exact canonical allow-list",
          ),
        );
      }
      continue;
    }

    if (model === "leadEvent") {
      if (
        !destructive &&
        (method === "create" || method === "createMany") &&
        file === "src/lib/leads/events.ts"
      ) {
        continue;
      }
      violations.push(
        formatMutation(
          mutation,
          destructive
            ? "Lead events are append-only"
            : "LeadEvent creation belongs only in src/lib/leads/events.ts",
        ),
      );
      continue;
    }

    if (model === "leadInteraction") {
      if (
        !destructive &&
        (method === "create" || method === "createMany") &&
        file === "src/lib/leads/interactions.ts"
      ) {
        continue;
      }
      violations.push(
        formatMutation(
          mutation,
          destructive
            ? "Lead interactions are append-only"
            : "LeadInteraction creation belongs only in src/lib/leads/interactions.ts",
        ),
      );
      continue;
    }

    if (model === "contactNote") {
      const functionName = containingFunctionName(mutation.call);
      const isAddLeadNoteImplementation =
        file === "src/lib/leads/interactions.ts" &&
        (functionName === "addLeadNote" ||
          functionName === "addLeadNoteInTransaction") &&
        (method === "create" || method === "createMany");
      if (!isAddLeadNoteImplementation) {
        violations.push(
          formatMutation(
            mutation,
            destructive
              ? "Lead notes are append-only"
              : "ContactNote creation belongs only in the addLeadNote implementation",
          ),
        );
      }
      continue;
    }

    if (model === "leadFollowUp") {
      if (destructive) {
        violations.push(
          formatMutation(mutation, "Follow-up history may not be deleted"),
        );
      } else if (!allowedLeadFollowUpWriters.has(file)) {
        violations.push(
          formatMutation(
            mutation,
            "LeadFollowUp writes belong only in follow-ups.ts or lifecycle ownership helpers",
          ),
        );
      }
      continue;
    }

    if (model === "agreement") {
      if (destructive) {
        violations.push(
          formatMutation(mutation, "Agreement history may not be deleted"),
        );
        continue;
      }
      if (
        (method === "create" ||
          method === "createMany" ||
          method === "upsert") &&
        file !== agreementLifecycle
      ) {
        violations.push(
          formatMutation(
            mutation,
            "Agreement creation belongs only in agreement-lifecycle.ts",
          ),
        );
        continue;
      }
      if (
        (method === "update" || method === "updateMany") &&
        file !== agreementLifecycle
      ) {
        const keys = mutationDataKeys(mutation);
        if (!keys || keys.has("status") || keys.has("paymentStatus")) {
          violations.push(
            formatMutation(
              mutation,
              "Agreement lifecycle status writes belong only in agreement-lifecycle.ts",
            ),
          );
        }
      }
      continue;
    }

    if (model === "sellerCommission") {
      if (destructive) {
        violations.push(
          formatMutation(mutation, "Seller commission history may not be deleted"),
        );
      } else if (file !== agreementLifecycle) {
        violations.push(
          formatMutation(
            mutation,
            "SellerCommission writes belong only in agreement-lifecycle.ts",
          ),
        );
      }
    }
  }

  assertNoViolations("Canonical model writer-boundary violations", violations);
});

function exportedFunction(
  sourceFile: ts.SourceFile,
  name: string,
): ts.FunctionDeclaration | null {
  return (
    sourceFile.statements.find(
      (statement): statement is ts.FunctionDeclaration =>
        ts.isFunctionDeclaration(statement) &&
        statement.name?.text === name &&
        statement.modifiers?.some(
          (modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword,
        ) === true,
    ) ?? null
  );
}

function isUnconditional405(file: string, method: string): boolean {
  const sourceFile = parse(file);
  const handler = exportedFunction(sourceFile, method);
  if (!handler) return true;
  const firstStatement = handler.body?.statements[0];
  return (
    Boolean(firstStatement && ts.isReturnStatement(firstStatement)) &&
    /\bstatus\s*:\s*405\b/.test(firstStatement!.getText(sourceFile))
  );
}

test("legacy read routes use lifecycle writers and destructive requests return 405", () => {
  const violations: string[] = [];
  const singleReadRoute = path.join(apiRoot, "contacts", "[id]", "route.ts");
  const bulkReadRoute = path.join(apiRoot, "contacts", "bulk", "route.ts");
  const singleSource = fs.readFileSync(singleReadRoute, "utf8");
  const bulkSource = fs.readFileSync(bulkReadRoute, "utf8");

  if (!/\bmarkLeadRead\s*\(/.test(singleSource)) {
    violations.push(
      `${relative(singleReadRoute)} must call markLeadRead for legacy isRead changes`,
    );
  }
  if (!/\bmarkLeadsRead\s*\(/.test(bulkSource)) {
    violations.push(
      `${relative(bulkReadRoute)} must call markLeadsRead for legacy bulk isRead changes`,
    );
  }

  const destructiveRouteFiles = [
    singleReadRoute,
    path.join(apiRoot, "leads", "[id]", "route.ts"),
    path.join(apiRoot, "seller", "leads", "[id]", "route.ts"),
    path.join(apiRoot, "leads", "[id]", "notes", "route.ts"),
    path.join(apiRoot, "seller", "leads", "[id]", "notes", "route.ts"),
    path.join(apiRoot, "agreements", "[id]", "route.ts"),
  ];
  for (const file of destructiveRouteFiles) {
    if (!isUnconditional405(file, "DELETE")) {
      violations.push(
        `${relative(file)} DELETE must return 405 before authentication or mutation`,
      );
    }
  }

  if (
    !/action\s*===\s*["']delete["'][\s\S]{0,500}?\bstatus\s*:\s*405\b/.test(
      bulkSource,
    )
  ) {
    violations.push(
      `${relative(bulkReadRoute)} bulk delete action must explicitly return 405`,
    );
  }

  assertNoViolations("Legacy compatibility boundary violations", violations);
});

function importedLifecycleBindings(sourceFile: ts.SourceFile): Set<string> {
  const bindings = new Set<string>();
  for (const statement of sourceFile.statements) {
    if (
      !ts.isImportDeclaration(statement) ||
      !ts.isStringLiteral(statement.moduleSpecifier) ||
      statement.moduleSpecifier.text !== "@/lib/leads/agreement-lifecycle"
    ) {
      continue;
    }
    const clause = statement.importClause;
    if (!clause?.namedBindings || !ts.isNamedImports(clause.namedBindings)) {
      continue;
    }
    for (const element of clause.namedBindings.elements) {
      bindings.add(element.name.text);
    }
  }
  return bindings;
}

function calledIdentifiers(sourceFile: ts.SourceFile): Set<string> {
  const called = new Set<string>();
  function visit(node: ts.Node): void {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) {
      called.add(node.expression.text);
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
  return called;
}

test("agreement and first-payment routes delegate lifecycle effects", () => {
  const routeFiles = [
    "src/app/api/agreements/route.ts",
    "src/app/api/seller/agreements/route.ts",
    "src/app/api/agreements/[id]/route.ts",
    "src/app/api/agreements/[id]/sent/route.ts",
    "src/app/api/agreements/sign/[token]/route.ts",
    "src/app/api/payments/webhook/route.ts",
  ];
  const violations: string[] = [];

  for (const routeFile of routeFiles) {
    const file = path.join(projectRoot, routeFile);
    const sourceFile = parse(file);
    const imported = importedLifecycleBindings(sourceFile);
    const called = calledIdentifiers(sourceFile);
    if (![...imported].some((binding) => called.has(binding))) {
      violations.push(
        `${routeFile} must call an imported agreement-lifecycle service`,
      );
    }

    for (const mutation of scanDelegateMutations(file)) {
      const keys = mutationDataKeys(mutation);
      const directAgreementLifecycleWrite =
        mutation.model === "agreement" &&
        (mutation.method === "create" ||
          mutation.method === "createMany" ||
          mutation.method === "upsert" ||
          mutation.method === "delete" ||
          mutation.method === "deleteMany" ||
          ((mutation.method === "update" ||
            mutation.method === "updateMany") &&
            (!keys || keys.has("status") || keys.has("paymentStatus"))));
      const directCommissionCreation =
        mutation.model === "sellerCommission" &&
        (mutation.method === "create" || mutation.method === "createMany");
      const directLeadStageWrite =
        mutation.model === "contactSubmission" &&
        (mutation.method === "create" ||
          mutation.method === "createMany" ||
          mutation.method === "upsert" ||
          ((mutation.method === "update" ||
            mutation.method === "updateMany") &&
            (!keys || keys.has("stage"))));
      if (
        directAgreementLifecycleWrite ||
        directCommissionCreation ||
        directLeadStageWrite
      ) {
        violations.push(
          formatMutation(
            mutation,
            "route must delegate Agreement/payment/Lead lifecycle effects",
          ),
        );
      }
    }
  }

  assertNoViolations("Agreement lifecycle route-boundary violations", violations);
});

test("migration-only agreement primitives are runtime-imported only by the resolver", () => {
  const migrationOnly = new Set([
    "cancelDuplicateAgreementForMigrationInTransaction",
    "linkHistoricalCommissionInTransaction",
    "classifyLegacyOrphanCommissionInTransaction",
  ]);
  const allowedImporter = "scripts/resolve-unified-lead-exceptions.ts";
  const roots = [srcRoot, path.join(projectRoot, "scripts")];
  const violations: string[] = [];

  for (const file of roots.flatMap((root) =>
    walk(root, (candidate) => isSourceFile(candidate) && !isTestFile(candidate)),
  )) {
    const sourceFile = parse(file);
    for (const statement of sourceFile.statements) {
      if (
        !(
          ts.isImportDeclaration(statement) ||
          ts.isExportDeclaration(statement)
        ) ||
        !statement.moduleSpecifier ||
        !ts.isStringLiteral(statement.moduleSpecifier)
      ) {
        continue;
      }
      const moduleSpecifier = statement.moduleSpecifier.text;
      const clause = ts.isImportDeclaration(statement)
        ? statement.importClause?.namedBindings
        : statement.exportClause;
      if (!clause) continue;
      if (
        ts.isNamespaceImport(clause) &&
        /(?:^|\/)leads\/agreement-lifecycle$/.test(moduleSpecifier) &&
        relative(file) !== allowedImporter
      ) {
        violations.push(
          `${relative(file)} namespace-imports a module that can expose migration-only primitives`,
        );
        continue;
      }
      if (!ts.isNamedImports(clause) && !ts.isNamedExports(clause)) continue;
      for (const element of clause.elements) {
        const importedName = element.propertyName?.text ?? element.name.text;
        if (
          migrationOnly.has(importedName) &&
          relative(file) !== allowedImporter
        ) {
          const { line } = sourceFile.getLineAndCharacterOfPosition(
            element.getStart(sourceFile),
          );
          violations.push(
            `${relative(file)}:${line + 1} imports/re-exports migration-only ${importedName}`,
          );
        }
      }
    }
  }

  assertNoViolations("Migration-only primitive import violations", violations);
});
