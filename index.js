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
      title = `Increases image size ${change.toFixed(3)}% compared to ${defaultTag}`
    } else if (change < 0) {
      title = `Decreases image size ${change.toFixed(3)}% compared to ${defaultTag}`
    } else {
      title = `No change to Docker image size`
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
      repo: core.github.repo,
      name: 'Image size change',
      head_sha: core.github.head_sha,
      conclusion: neutral,
      output: {
        title: title,
        summary: summary
      }
    }
  )
}

run(core.getInput('defaultTag')).then((val) => console.log(val))
// run("alpine:3.11").then((val) => console.log(val))
