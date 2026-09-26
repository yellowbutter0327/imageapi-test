import path from 'node:path';

const layers = ['_app', '_pages', 'widgets', 'features', 'entities', 'shared'];
function location(filename, root) {
  const relative = path
    .relative(path.join(root, 'src'), filename)
    .replaceAll(path.sep, '/');
  if (relative.startsWith('../')) return null;
  const [layer, slice] = relative.split('/');
  return layers.includes(layer) ? { layer, slice, relative } : null;
}

const architecture = {
  meta: {
    type: 'problem',
    schema: [],
    messages: {
      upwards:
        '{{from}} cannot import {{to}}. Compose features in an upper layer.',
      sibling: 'Do not import another slice within {{layer}}.',
      private: 'Import through the public entry point of {{slice}}.',
      server: 'Client modules cannot import a server entry point.',
      routes: 'Source modules cannot depend on Next route files.',
    },
  },
  create(context) {
    const root = context.cwd;
    const filename = context.filename;
    const from = location(filename, root);
    const client = context.sourceCode.ast.body.some(
      (node) =>
        node.type === 'ExpressionStatement' && node.directive === 'use client',
    );
    function check(node) {
      const specifier = node.source?.value;
      if (
        typeof specifier !== 'string' ||
        (!specifier.startsWith('@/') && !specifier.startsWith('.'))
      )
        return;
      const destination = specifier.startsWith('@/')
        ? path.join(root, 'src', specifier.slice(2))
        : path.resolve(path.dirname(filename), specifier);
      const to = location(destination, root);
      if (from && destination.startsWith(path.join(root, 'app') + path.sep))
        context.report({ node, messageId: 'routes' });
      if (
        client &&
        /(?:\.server(?:\.[jt]sx?)?$)|(?:\/index\.server$)/.test(destination)
      )
        context.report({ node, messageId: 'server' });
      if (!from || !to) return;
      if (layers.indexOf(from.layer) > layers.indexOf(to.layer)) {
        context.report({
          node,
          messageId: 'upwards',
          data: { from: from.layer, to: to.layer },
        });
        return;
      }
      const sameSlice = from.layer === to.layer && from.slice === to.slice;
      if (
        from.layer === to.layer &&
        !sameSlice &&
        !['_app', 'shared'].includes(from.layer)
      ) {
        context.report({
          node,
          messageId: 'sibling',
          data: { layer: from.layer },
        });
        return;
      }
      if (
        !sameSlice &&
        to.layer !== '_app' &&
        !/^[^/]+\/[^/]+(?:\/index(?:\.server)?(?:\.[jt]sx?)?)?$/.test(
          to.relative,
        )
      ) {
        context.report({
          node,
          messageId: 'private',
          data: { slice: to.slice },
        });
      }
    }
    return {
      ImportDeclaration: check,
      ExportNamedDeclaration: check,
      ExportAllDeclaration: check,
      ImportExpression: check,
    };
  },
};
export default architecture;
