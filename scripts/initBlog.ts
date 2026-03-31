import { input } from "@inquirer/prompts";
import fs from "fs";
import path from "path";

const BLOG_DIR = path.join(process.cwd(), "src", "content", "blog");

function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-zA-Z0-9 ]/g, "")
    .replace(/ /g, "-")
    .replace(/-+/g, "-");
}

function generateFrontMatter(opts: {
  title: string;
  summary: string;
  tags: string[];
}) {
  const date = new Date().toISOString();
  const tagStr = JSON.stringify(opts.tags);

  return `---
title: ${opts.title || "Untitled"}
date: ${date}
tags: ${tagStr}
draft: true
summary: ${opts.summary || " "}
layout: PostSimple
---
`;
}

async function main() {
  const title = await input({ message: "Post title:" });
  const summary = await input({ message: "Summary:" });
  const tagsRaw = await input({
    message: "Tags (comma-separated, or empty for none):",
  });

  const tags = tagsRaw
    ? tagsRaw
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean)
    : [];

  const slug = slugify(title) || "untitled";
  const frontMatter = generateFrontMatter({ title, summary, tags });
  const filePath = path.join(BLOG_DIR, `${slug}.md`);

  if (fs.existsSync(filePath)) {
    console.error(`Error: ${filePath} already exists`);
    process.exit(1);
  }

  fs.writeFileSync(filePath, frontMatter);
  console.log(
    `Created draft: ${path.relative(process.cwd(), filePath)}`,
  );
}

main();
