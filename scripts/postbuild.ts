import rss from './rss'

async function postbuild() {
  await rss()
}

postbuild()
