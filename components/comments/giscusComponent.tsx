import { useEffect, useState, createElement } from 'react';
import type { GiscusProps } from '@giscus/react';
// vendored the react component so it would use my override of the iframe...
export default function Giscus({
  id,
  host,
  repo,
  repoId,
  category,
  categoryId,
  mapping,
  term,
  strict,
  reactionsEnabled,
  emitMetadata,
  inputPosition,
  theme,
  lang,
  loading,
}: GiscusProps) {
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
      if (mounted) return;
      void import('giscus');
      setMounted(true);
    }, []);

    if (!mounted) return null;

    return createElement("giscus-widget", {
        id: id,
        host: host,
        repo: repo,
        repoid: repoId,
        category: category,
        categoryid: categoryId,
        mapping: mapping,
        term: term,
        strict: strict,
        reactionsenabled: reactionsEnabled,
        emitmetadata: emitMetadata,
        inputposition: inputPosition,
        theme: theme,
        lang: lang,
        loading: loading,
    })
}