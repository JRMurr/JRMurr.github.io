interface Project {
  title: string
  description: string
  href?: string
  imgSrc?: string
}

const projectsData: Project[] = [
  {
    title: 'SqlJr',
    description: `A toy database to learn more lower level rust.`,
    imgSrc: '/static/images/db-icon.png',
    href: '/blog/build-a-db/part01',
  },
  {
    title: 'ThiccBot',
    description: `My custom discord bot I have re-made about 4 times now. 
    Its been a great project to come back to when I get the urge to make a small new thing.`,
    imgSrc: '/static/images/thiccBot.jpg',
    href: 'https://github.com/JRMurr/ThiccBot',
  },
]

export default projectsData
