const core = require('@actions/core');
const github = require('@actions/github');

const util = require('util');
const exec = util.promisify(require('child_process').exec);


async function run(defaultTag) {
  try {
    const [oldSize, newSize] = await Promise.all([getDefaultSize(defaultTag), getNewSize()])

    const summary = `
Default image size: ${oldSize}
New image size: ${newSize}`

    let title
    const change = (newSize/oldSize-1)*100
    if (change > 0) {
      title = `⚠️ ${change.toFixed(3)}% larger than ${defaultTag}`
    } else if (change < 0) {
      title = `🎉 ${Math.abs(change.toFixed(3))}% smaller than ${defaultTag}`
    } else {
      title = `🐋 No change`
    }

    await createCheck(title, summary)
  } catch (error) {
    core.setFailed(error.message);
  }
} 

async function getDefaultSize(tag) {
  await exec('docker pull ' + tag);
  const { stdout } = await exec('docker image inspect ' + tag + ' --format="{{.Size}}"');
  return stdout
}

async function getNewSize() {
  await exec('docker build . -t $GITHUB_SHA');
  const { stdout } = await exec('docker image inspect $GITHUB_SHA --format="{{.Size}}"');
  return stdout
}

async function createCheck(title, summary) {
  const token = core.getInput('token')
  const octokit = github.getOctokit(token)
  await octokit.checks.create(
    {
      ...github.context.repo,
      name: 'Docker image size',
      head_sha: github.context.sha,
      conclusion: 'neutral',
      output: {
        title: title,
        summary: summary
      }
    }
  )
}

run(core.getInput('defaultTag')).then((val) => console.log(val))
