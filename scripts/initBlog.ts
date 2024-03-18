import fs from 'fs'
import path from 'path'
import inquirer from 'inquirer'
import dedent from 'dedent'

const root = process.cwd()

const genFrontMatter = (answers) => {
  const date = new Date()
  const tagArray: string[] = answers.tags.split(',').map((x) => x.trim())
  const tagStr = JSON.stringify(tagArray)

  const frontMatter = dedent`
  ---
  title: ${answers.title ? answers.title : 'Untitled'}
  date: ${date.toISOString()}
  tags: ${tagStr}
  draft: ${answers.draft === 'yes' ? true : false}
  summary: ${answers.summary ? answers.summary : ' '}
  images: []
  layout: PostSimple
  ---
  `

  // Remove special characters and replace space with -
  const fileName = answers.title
    .toLowerCase()
    .replace(/[^a-zA-Z0-9 ]/g, '')
    .replace(/ /g, '-')
    .replace(/-+/g, '-')

  return { frontMatter, fileName }
}

inquirer
  .prompt([
    {
      name: 'title',
      message: 'Enter post title:',
      type: 'input',
    },
    {
      name: 'summary',
      message: 'Enter post summary:',
      type: 'input',
    },
    {
      name: 'draft',
      message: 'Set post as draft?',
      type: 'list',
      choices: ['yes', 'no'],
    },
    {
      name: 'tags',
      message: 'Any Tags? Separate them with , or leave empty if no tags.',
      type: 'input',
    },
  ])
  .then((answers) => {
    const { frontMatter, fileName } = genFrontMatter(answers)
    const filePath = `content/blog/${fileName ? fileName : 'untitled'}.md`
    fs.writeFile(filePath, frontMatter, { flag: 'wx' }, (err) => {
      if (err) {
        throw err
      } else {
        console.log(`Blog post generated successfully at ${filePath}`)
      }
    })
  })
  .catch((error) => {
    if (error.isTtyError) {
      console.log("Prompt couldn't be rendered in the current environment")
    } else {
      console.log('Something went wrong, sorry!')
    }
  })
