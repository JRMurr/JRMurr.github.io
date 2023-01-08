import fs from 'fs';
import globby from 'globby';

const getAllFilesRecursively = (folder: string): string[] => {
  const globs = ['mdx', 'md'].map((fileType) => `${folder}/**/*.${fileType}`);
  return globby.sync(globs);
};

export default getAllFilesRecursively;

export function readFileIfExists(path: string): string | undefined {
  if (fs.existsSync(path)) {
    return fs.readFileSync(path, 'utf8');
  }
  return undefined;
}
