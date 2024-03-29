/* eslint-disable react/display-name */
import React, { useMemo } from 'react';
import { ComponentMap, getMDXComponent } from 'mdx-bundler/client';
import Image from './mdxComponents/Image';
import CustomLink from './Link';
import TOCInline from './mdxComponents/TOCInline';
import Pre from './mdxComponents/Pre';
import Note from './mdxComponents/Note';
import { SeriesInfo } from 'pages/blog/[...slug]';

const Wrapper: React.ComponentType<{ layout: string }> = ({ layout, ...rest }) => {
  const Layout = require(`../layouts/${layout}`).default;
  return <Layout {...rest} />;
};

export const MDXComponents: ComponentMap = {
  Image,
  //@ts-ignore
  TOCInline,
  a: CustomLink,
  pre: Pre,
  Note: Note,
  wrapper: Wrapper,
};

interface Props {
  layout: string;
  mdxSource: string;
  series?: SeriesInfo;
  [key: string]: unknown;
}

export const MDXLayoutRenderer = ({ layout, mdxSource, ...rest }: Props) => {
  const MDXLayout = useMemo(() => getMDXComponent(mdxSource), [mdxSource]);

  return <MDXLayout layout={layout} components={MDXComponents} {...rest} />;
};
