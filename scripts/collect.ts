import fs from "node:fs/promises";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { Semaphore } from "@core/asyncutil";
import unzip from "unzip-stream";
import {
  guestRepo,
  pagesBuildCheckName,
  artifactName,
  destinationDir,
  pagesUrl,
  commentMarker,
  rootLogger,
  octokit,
  appInfo,
} from "./common.ts";

const [guestRepoOwner, guestRepoName] = guestRepo.split("/");

const branches = await octokit.paginate("GET /repos/{owner}/{repo}/branches", {
  owner: guestRepoOwner,
  repo: guestRepoName,
});
const filteredBranches = branches.filter(
  (branch) => branch.name.startsWith("project-") || branch.name === "main",
);

const semaphore = new Semaphore(5);

const pullRequests = await octokit.paginate("GET /repos/{owner}/{repo}/pulls", {
  owner: guestRepoOwner,
  repo: guestRepoName,
  state: "open",
});
const downloadTargets = await Promise.all(
  [
    filteredBranches.map(
      (branch) =>
        ({
          type: "branch",
          branch,
        }) as const,
    ),
    pullRequests.map(
      (pullRequest) =>
        ({
          type: "pullRequest",
          pullRequest,
        }) as const,
    ),
  ]
    .flat()
    .map(async (source) => {
      const log = rootLogger.getChild(
        source.type === "branch"
          ? `Branch ${source.branch.name}`
          : `PR #${source.pullRequest.number}`,
      );
      try {
        log.info("Checking...");
        const {
          data: { check_runs: checkRuns },
        } = await octokit.request(
          "GET /repos/{owner}/{repo}/commits/{ref}/check-runs",
          {
            owner: guestRepoOwner,
            repo: guestRepoName,
            ref:
              source.type === "branch"
                ? source.branch.name
                : source.pullRequest.head.sha,
          },
        );
        const buildPageCheck = checkRuns.find(
          (checkRun) => checkRun.name === pagesBuildCheckName,
        );
        if (!buildPageCheck) {
          log.info("No build check found");
          return;
        }
        if (!buildPageCheck.details_url) {
          log.info("Build check has no details URL");
          return;
        }
        const runId =
          buildPageCheck.details_url.match(/(?<=\/runs\/)[0-9]+/)?.[0];
        if (!runId) {
          log.error(
            `Failed to extract check run ID from details URL: ${buildPageCheck.details_url}`,
          );
          return;
        }
        const jobId = buildPageCheck.id;
        let success = false;
        let done = false;
        // タイムアウト：5分
        for (let i = 0; i < 20; i++) {
          done = await semaphore.lock(async () => {
            const { data: job } = await octokit.request(
              "GET /repos/{owner}/{repo}/actions/jobs/{job_id}",
              {
                owner: guestRepoOwner,
                repo: guestRepoName,
                job_id: jobId,
              },
            );
            if (job.status === "completed") {
              success = job.conclusion === "success";
              return true;
            }
            log.info`Waiting for job #${jobId} to complete...`;
            await new Promise((resolve) => setTimeout(resolve, 15000));
            return false;
          });
          if (done) {
            break;
          }
        }
        if (!done) {
          log.error("Job did not complete");
          return;
        }
        if (!success) {
          log.error("Build check did not succeed");
          return;
        }
        const buildPage = await octokit.request(
          "GET /repos/{owner}/{repo}/actions/runs/{run_id}/artifacts",
          {
            owner: guestRepoOwner,
            repo: guestRepoName,
            run_id: Number.parseInt(runId),
          },
        );
        const artifact = buildPage.data.artifacts.find(
          (artifact) => artifact.name === artifactName,
        );
        if (!artifact) {
          log.error("No artifact found");
          return;
        }

        const downloadUrl = artifact.archive_download_url;
        if (!downloadUrl) {
          log.error("No download URL found");
          return;
        }
        log.info`Fetching artifact URL from ${downloadUrl}`;

        const { url: innerDownloadUrl } = await octokit.request(
          "GET /repos/{owner}/{repo}/actions/artifacts/{artifact_id}/{archive_format}",
          {
            owner: guestRepoOwner,
            repo: guestRepoName,
            artifact_id: artifact.id,
            archive_format: "zip",
          },
        );

        log.info`Downloading artifact from ${innerDownloadUrl}`;
        const response = await fetch(innerDownloadUrl);
        if (!response.ok) {
          log.error`Failed to download artifact: ${response.statusText}`;
          return;
        }
        if (!response.body) {
          log.error("Response has no body");
          return;
        }
        const dirname =
          source.type === "branch"
            ? `branch-${source.branch.name}`
            : `pr-${source.pullRequest.number}`;
        const destination = `${destinationDir}/${dirname}`;
        log.info`Extracting artifact to ${destination}`;
        await fs.mkdir(destination, { recursive: true });
        await pipeline(
          Readable.fromWeb(response.body),
          unzip.Extract({
            path: destination,
          }),
        );
        log.info("Done.");

        return { source, dirname };
      } catch (e) {
        log.error`Failed to process: ${e}`;
      }
    }),
);
const successfulDownloads = downloadTargets.filter(
  (downloadTarget) => downloadTarget !== undefined,
);
if (successfulDownloads.length === 0) {
  throw new Error("No successful downloads");
}

for (const { dirname, source } of successfulDownloads) {
  if (source.type === "branch") {
    continue;
  }
  const log = rootLogger.getChild(`PR #${source.pullRequest.number}`);
  log.info("Fetching comments...");
  const comments = await octokit.paginate(
    "GET /repos/{owner}/{repo}/issues/{issue_number}/comments",
    {
      owner: guestRepoOwner,
      repo: guestRepoName,
      issue_number: source.pullRequest.number,
    },
  );
  const deployInfoMessage = [
    ":rocket: プレビュー用ページを作成しました :rocket:",
    "",
    `- <a href="${pagesUrl}/preview/${dirname}/editor" target="_blank">:pencil: エディタ</a>`,
    `- <a href="${pagesUrl}/preview/${dirname}/storybook" target="_blank">:book: Storybook</a>`,
    "",
    `更新時点でのコミットハッシュ：[\`${source.pullRequest.head.sha.slice(0, 7)}\`](https://github.com/${
      source.pullRequest.head.repo.full_name
    }/commit/${source.pullRequest.head.sha})`,
    commentMarker,
  ].join("\n");
  const maybePreviousDeployInfo = comments.find(
    (comment) =>
      comment.user &&
      appInfo.data &&
      comment.user.login === `${appInfo.data.slug}[bot]` &&
      comment.body?.endsWith(commentMarker),
  );
  if (!maybePreviousDeployInfo) {
    log.info("Adding deploy info...");
    await octokit.request(
      "POST /repos/{owner}/{repo}/issues/{issue_number}/comments",
      {
        owner: guestRepoOwner,
        repo: guestRepoName,
        issue_number: source.pullRequest.number,
        body: deployInfoMessage,
      },
    );
  } else if (maybePreviousDeployInfo.body === deployInfoMessage) {
    log.info("No update in deploy info, skipped.");
  } else {
    log.info("Updating deploy info...");
    await octokit.request(
      "PATCH /repos/{owner}/{repo}/issues/comments/{comment_id}",
      {
        owner: guestRepoOwner,
        repo: guestRepoName,
        comment_id: maybePreviousDeployInfo.id,
        body: deployInfoMessage,
      },
    );
  }
}

await fs.writeFile(
  `${destinationDir}/downloads.json`,
  JSON.stringify(successfulDownloads, null, 2),
);
rootLogger.info`Done: ${successfulDownloads.length} successful downloads / ${downloadTargets.length} total targets.`;
