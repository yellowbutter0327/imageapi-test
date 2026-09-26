// @vitest-environment node
import path from 'node:path';
import { ESLint } from 'eslint';
import { expect, it } from 'vitest';

const eslint = new ESLint();
async function violations(
  code: string,
  file = 'src/features/example/ui/example.tsx',
) {
  const [result] = await eslint.lintText(code, {
    filePath: path.resolve(file),
  });
  return result!.messages.filter(
    (message) => message.ruleId === 'architecture/boundaries',
  );
}
it('rejects upward imports and relative escapes', async () => {
  expect(await violations("import '@/widgets/image-explorer';")).toHaveLength(
    1,
  );
  expect(
    await violations("import '../../../widgets/image-explorer';"),
  ).toHaveLength(1);
});
it('rejects cross-slice imports and private implementations', async () => {
  expect(await violations("import '@/features/search-images';")).toHaveLength(
    1,
  );
  expect(
    await violations("import '@/entities/image/model/search';"),
  ).toHaveLength(1);
});
it('allows a lower-layer public entry and same-slice modules', async () => {
  expect(await violations("import '@/entities/image';")).toHaveLength(0);
  expect(await violations("import '../model/state';")).toHaveLength(0);
});
it('rejects server imports from a client component', async () => {
  expect(
    await violations("'use client';\nimport '@/entities/image/index.server';"),
  ).toHaveLength(1);
});
