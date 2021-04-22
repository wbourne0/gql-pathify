import type {
  DocumentNode,
  FragmentSpreadNode,
  DefinitionNode,
  InlineFragmentNode,
  SelectionNode,
  FieldNode,
  FragmentDefinitionNode,
  OperationDefinitionNode,
} from 'graphql';

export interface Options {
  maxFieldDepth: number;
  maxFragmentDepth: number;
}

export interface ExtractionContext extends Options {
  fieldDepth: number;
  fragmentDepth: number;
}

const clone = <T>(v: T): T => ({ ...v });

function extractFragmentFields(
  definitions: readonly DefinitionNode[],
  selection: FragmentSpreadNode | InlineFragmentNode,
  context: ExtractionContext,
): Array<FieldNode> {
  context = clone(context);

  if (context.fragmentDepth > context.maxFragmentDepth) {
    throw new Error('Max fragment depth exceeded!');
  }

  context.fragmentDepth++;


  const fields: Array<FieldNode> = [];

  let selections: readonly SelectionNode[] = [];

  if (selection.kind === 'FragmentSpread') {
    // This is after the graphql is validated, so this should always return a value
    const fragmentDefinition = definitions.find(
      (d) =>
        d.kind === 'FragmentDefinition' &&
        d.name.value === selection.name.value,
    ) as FragmentDefinitionNode;

    selections = fragmentDefinition.selectionSet.selections;
  } else {
    selections = selection.selectionSet.selections;
  }

  selections.forEach((s) => {
    switch (s.kind) {
      case 'Field':
        fields.push(s);

        return;
      case 'FragmentSpread':
      case 'InlineFragment':
        fields.push(...extractFragmentFields(definitions, s, context));
    }
  });

  return fields;
}

function extractFields(
  doc: DocumentNode,
  selection: SelectionNode,
  prefix: string,
  paths: Array<string>,
  context: ExtractionContext,
): void {
  context = clone(context);

  if (context.fieldDepth > context.maxFieldDepth) {
    throw new Error('Max field depth exceeded!');
  }

  context.fieldDepth++;

  const addField = (s: FieldNode) => {
    const nameWithAlias = s.alias
      ? `${s.name.value}:${s.alias.value}`
      : s.name.value;
    const fieldPath = prefix ? `${prefix}.${nameWithAlias}` : nameWithAlias;

    if (!paths.includes(fieldPath)) {
      paths.push(fieldPath);
    }

    if (s.selectionSet) {
      s.selectionSet.selections.forEach((sel) => {
        extractFields(doc, sel, fieldPath, paths, context);
      });
    }
  };

  switch (selection.kind) {
    case 'Field':
      addField(selection);
      break;
    case 'FragmentSpread':
    case 'InlineFragment':
      extractFragmentFields(doc.definitions, selection, context).forEach(
        addField,
      );
      break;
    default:
      throw new Error(`Unknown selection type: ${(selection as any).kind}`);
  }
}

/**
 * getPaths is used to return a list of paths to all of the fields in a GraphQL query.
 * @param {OperationDefinitionNode} operation - The operation that is being used in the document. If you don't
 * have this, you can use getOprationAST from graphql with the document and the name of the query being used (none if t
 * ere is only 1 query)
 * @param {DocumentNode} document - The GraphQL document that should be parsed. You can get this by calling the function exported from
 * 'graphql=tag' with the string graphql document if you don't have it.
 */
export function getPaths(
  operation: OperationDefinitionNode,
  doc: DocumentNode,
  options?: Partial<Options>,
): Array<string> {
  const context: ExtractionContext = {
    maxFieldDepth: 100,
    maxFragmentDepth: 100,
    ...options,
    fragmentDepth: 1,
    fieldDepth: 1,
  };
  const paths: Array<string> = [];

  paths.push(operation.operation);

  operation.selectionSet.selections.forEach((selection) => {
    extractFields(doc, selection, operation.operation, paths, context);
  });

  return paths.map((path) =>
    path.includes(':') ? path.replace(/:[a-z]+/gi, '') : path,
  );
}
