// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import remarkMath from 'remark-math';
import rehypeMathjax from 'rehype-mathjax/svg';

// Match renrua52/domain: pandoc --mathjax + hexo-filter-mathjax (SVG).
export default defineConfig({
  site: 'https://renrua52.github.io',
  integrations: [sitemap()],
  markdown: {
    shikiConfig: {
      theme: 'github-light',
    },
    remarkPlugins: [remarkMath],
    rehypePlugins: [
      [
        rehypeMathjax,
        {
          tex: {
            tags: 'none',
            inlineMath: [
              ['$', '$'],
              ['\\(', '\\)'],
            ],
            displayMath: [
              ['$$', '$$'],
              ['\\[', '\\]'],
            ],
          },
          svg: {
            fontCache: 'global',
          },
        },
      ],
    ],
  },
});
