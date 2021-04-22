/* eslint-disable @typescript-eslint/no-non-null-assertion */
import gql from 'graphql-tag';
import { getPaths } from 'src/index';
import {
  getOperationAST,
  DocumentNode,
  OperationDefinitionNode,
} from 'graphql';

function testFor(
  type: 'query' | 'mutation' | 'subscription',
  {
    fields,
    operation,
    document,
  }: {
    fields: Array<string>;
    operation?: OperationDefinitionNode;
    document: DocumentNode;
  },
): void {
  if (!operation) {
    operation = getOperationAST(
      typeof document === 'string' ? gql(document) : document,
    )!;
  }

  const expected = [type, ...fields.map((field) => `${type}.${field}`)];

  const results = getPaths(operation, document);

  expect(results).toEqual(expected);
}

describe('getPaths', () => {
  beforeAll(() => {
    gql.disableFragmentWarnings();
  });

  it('correctly orders paths', () => {
    const document = gql`
      query {
        a
        c
        b
      }
    `;

    testFor('query', { document, fields: ['a', 'c', 'b'] });
  });

  it('returns fields on a basic document', () => {
    const document = gql`
      query {
        a
        b
        c {
          d
          e {
            f
          }
        }
      }
    `;

    testFor('query', {
      document,
      fields: ['a', 'b', 'c', 'c.d', 'c.e', 'c.e.f'],
    });
  });

  it("doesn't add duplicate fields on the root object", () => {
    const document = gql`
      query {
        a
        a
      }
    `;

    testFor('query', { document, fields: ['a'] });
  });

  it('does add aliased fields multiple times on the root object', () => {
    const document = gql`
      query {
        a
        b: a
      }
    `;

    testFor('query', { document, fields: ['a', 'a'] });
  });

  it('merges the same aliased field with the same alias', () => {
    const document = gql`
      query {
        a
        a
        b: a
        b: a
      }
    `;

    testFor('query', { document, fields: ['a', 'a'] });
  });

  it('merges duplicate aliases for fields but not single ones', () => {
    const document = gql`
      query {
        c: a
        b: a
        b: a
      }
    `;

    testFor('query', { document, fields: ['a', 'a'] });
  });

  it('handles aliases and other fields', () => {
    const document = gql`
      query {
        c
        b: a
        b: a
      }
    `;

    testFor('query', { document, fields: ['c', 'a'] });
  });

  it('handles inline fragments on the root documents', () => {
    const document = gql`
      query {
        ... on RootQueryType {
          a
          b
        }
      }
    `;

    testFor('query', { document, fields: ['a', 'b'] });
  });

  it('handles recursive inline fragments on the root documents', () => {
    const document = gql`
      query {
        ... on RootQueryType {
          a
          ... on RootQueryType {
            b
            ... on RootQueryType {
              c
            }
          }
        }
      }
    `;

    testFor('query', { document, fields: ['a', 'b', 'c'] });
  });

  it('handles inline fragments on fields in a root object type', () => {
    const document = gql`
      query {
        a {
          ... on RootQueryType {
            b
          }
        }
      }
    `;

    testFor('query', { document, fields: ['a', 'a.b'] });
  });

  it('handles duplicate fields with inline fragments', () => {
    const document = gql`
      query {
        ... on RootQueryType {
          a
          b
        }
        ... on RootQueryType {
          b
          c
        }
      }
    `;

    testFor('query', { document, fields: ['a', 'b', 'c'] });
  });

  it('handles duplicate and aliased fields with inline fragments ', () => {
    const document = gql`
      query {
        ... on RootQueryType {
          a
          d: a
        }
        ... on RootQueryType {
          b
          c
          f: e
          d: a
        }
      }
    `;

    testFor('query', { document, fields: ['a', 'a', 'b', 'c', 'e'] });
  });

  it('gets the fields from named fragments', () => {
    const document = gql`
      query {
        ...MyQuery
      }

      fragment MyQuery on RootFragmentType {
        e
        f
        g
      }
    `;

    testFor('query', { document, fields: ['e', 'f', 'g'] });
  });

  it('recursively gets fields from named fragments', () => {
    const document = gql`
      query {
        ...MyQuery
      }

      fragment MyQuery on RootFragmentType {
        a
        b
        c
        ...MyQuery2
      }

      fragment MyQuery2 on RootFragmentType {
        d
        e
        f
      }
    `;

    testFor('query', { document, fields: ['a', 'b', 'c', 'd', 'e', 'f'] });
  });

  it('only gets fields from the requested operation', () => {
    const document = gql`
      query A {
        a
        b
        c
      }
      query B {
        d
        e
        f
      }
    `;

    const operation = getOperationAST(document, 'A')!;

    testFor('query', { document, fields: ['a', 'b', 'c'], operation });
  });

  it("doesn't just get fields from the first op", () => {
    const document = gql`
      query A {
        a
        b
        c
      }
      query B {
        d
        e
        f
      }
    `;

    const operation = getOperationAST(document, 'B')!;

    testFor('query', { document, fields: ['d', 'e', 'f'], operation });
  });

  it('enforces a maximum field depth', () => {
    const document = gql`
      query a {
        b {
          # 1
          c {
            # 2
            d {
              # 3
              e {
                # 4
                f {
                  # 5
                  g # 6! This is too far!
                }
              }
            }
          }
        }
      }
    `;

    expect(() => {
      getPaths(getOperationAST(document)!, document, { maxFieldDepth: 5 });
    }).toThrow();
  });

  it('enforces a maximum fragment depth', () => {
    const document = gql`
      query a {
        ... on RootQueryType {
          # 1
          ... on RootQueryType {
            # 2
            ... on RootQueryType {
              # 3
              ... on RootQueryType {
                # 4
                ... on RootQueryType {
                  # 5
                  ... on RootQueryType {
                    # 6! Too far!
                    a
                  }
                }
              }
            }
          }
        }
      }
    `;

    expect(() => {
      getPaths(getOperationAST(document)!, document, { maxFragmentDepth: 4 });
    }).toThrow();
  });
});
