const childProcess = require('child_process')
const util = require('util')

const exec = util.promisify(childProcess.exec)

const core = require('@actions/core')
const github = require('@actions/github')

const run = async function (defaultTag, currentTag) {
  try {
    const [oldSize, newSize] = await Promise.all([getDefaultSize(defaultTag), getNewSize(currentTag)])

    const summary = `
Default image size: ${oldSize}
New image size: ${newSize}`
    const title = buildTitle(newSize, oldSize, defaultTag)
    await createCheck(title, summary)
  } catch (error) {
    core.setFailed(error.message)
  }
}

const getDefaultSize = async function (tag) {
  await exec(`docker pull ${tag}`)
  const { stdout } = await exec(`docker image inspect ${tag} --format="{{.Size}}"`)
  return stdout
}

const getNewSize = async function (prebuiltTag) {
  if (prebuiltTag === undefined) {
    await exec('docker build . -t $GITHUB_SHA')
  }
  const tag = prebuiltTag || '$GITHUB_SHA'
  const { stdout } = await exec(`docker image inspect ${tag} --format="{{.Size}}"`)
  return stdout
}

const buildTitle = function (newSize, oldSize, defaultTag) {
  const change = (newSize / oldSize - 1) * 100
  if (change > 0) {
    return `⚠️ ${change.toFixed(3)}% larger than ${defaultTag}`
  }
  if (change < 0) {
    return `🎉 ${Math.abs(change.toFixed(3))}% smaller than ${defaultTag}`
  }
  return `🐋 No change`
}

const createCheck = async function (title, summary) {
  const token = core.getInput('token')
  const octokit = github.getOctokit(token)
  await octokit.checks.create({
    ...github.context.repo,
    name: 'Docker image size',
    head_sha: github.context.sha,
    conclusion: 'neutral',
    output: {
      title,
      summary,
    },
  })
}

run(core.getInput('defaultTag'), core.getInput('currentTag')).catch((error) => console.log(error))
