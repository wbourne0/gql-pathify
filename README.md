# gql-pathify

A lightweight + simple package for translating graphql requests into an array of paths to the nodes.

It won't add fields multiple times that gql will merge when resolving.

Eg:
```graphql

query {
    a {
        a
        b
    }
    ...QueryFragment
}

fragment QueryFragment on RootQueryType {
    a {
        b 
        c
    }
}
```
will get translated to:
```js
[
    'query',
    'query.a',
    'query.a.a',
    'query.a.b',
    'query.a.c',
]
```


When a field is aliased thoguh, gql will resolve that multiple times, so its added multiple times.

EG:
```graphql
query {
    a {
        a
        b
    }
    ...QueryFragment
}

fragment QueryFragment on RootQueryType {
    b: a {
        b
        c
    }
}
```

will be translated to
```js
[
    'query',
    'query.a',
    'query.a.a',
    'query.a.b',
    'query.a',
    'query.a.b',
    'query.a.c',
]
```

Features:
- Handles Inline fragments (recursively)
- Handles normal Fragments (recursively)
- Handles aliases
- Returns the paths as many times as they are resolved - a field's path will only be added as much as it will be resolved. 
- 0 dependencies
- Enforces a maximum field depth (handy if you don't want people querying too much data)
- Enforces a maximum fragment depth (mostly since its recursive) 

TODO: 
- Consider supporting skip directives.