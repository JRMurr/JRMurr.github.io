---
title: Type Safe GroupBy In TypeScript
slug: type-safe-groupby-in-typescript
date: '2022-05-25'
tags: ['typescript', 'types', 'code', 'guide']
draft: false
summary: Create a better groupBy function that only allows valid keys to be grouped on
images: []
layout: PostLayout
---


```ts twoslash
import _ from 'lodash';

interface Foo {
  num: number;
  someLiteral: 'a' | 'b' | 'c';
  object: Record<string, any>;
}

const vals: Foo[] = [
  { num: 1, someLiteral: 'a', object: { key: 'value' } },
  { num: 2, someLiteral: 'a', object: { key: 'diffValue' } },
  { num: 1, someLiteral: 'b', object: {} },
];
```

```ts twoslash
console.dir(_.groupBy(vals, 'num'));
/*
{
  '1': [ { num: 1, someLiteral: 'a' }, { num: 1, someLiteral: 'b' } ],
  '2': [ { num: 2, someLiteral: 'a' } ]
}
*/
console.dir(_.groupBy(vals, 'someLiteral'));
/*
{
  a:[
      { num: 1, someLiteral: 'a', object: [Object] },
      { num: 2, someLiteral: 'a', object: [Object] }
  ],
  b: [ { num: 1, someLiteral: 'b', object: {} } ]
}
*/
```