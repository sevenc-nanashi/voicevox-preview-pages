import fs from "node:fs/promises";
import {
  appInfo,
  commentMarker,
  guestRepoName,
  guestRepoOwner,
  octokit,
  pagesUrl,
  rootLogger,
  DownloadData,
} from "./common.ts";

const downloadData = JSON.parse(
  await fs.readFile(
    `${import.meta.url.replace("updateComments.ts", "")}downloads.json`,
    "utf-8",
  ),
) as DownloadData[];

for (const { dirname, source } of downloadData) {
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
