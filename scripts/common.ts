import fs from "node:fs/promises";
import * as logtape from "@logtape/logtape";
import { config } from "dotenv";
import { App, Octokit } from "octokit";
import { paginateRest } from "@octokit/plugin-paginate-rest";
import { throttling } from "@octokit/plugin-throttling";
import { Endpoints } from "@octokit/types";

export type Branch =
  Endpoints["GET /repos/{owner}/{repo}/branches"]["response"]["data"][0];
export type PullRequest =
  Endpoints["GET /repos/{owner}/{repo}/pulls"]["response"]["data"][0];
export type DownloadData = {
  source:
    | {
        type: "branch";
        branch: Branch;
      }
    | {
        type: "pullRequest";
        pullRequest: PullRequest;
      };
  dirname: string;
};

config({
  path: `${import.meta.dirname}/../.env`,
});

// 設定

// 収集対象のリポジトリ
export const guestRepo = "voicevox/voicevox";
// デプロイ情報を書き込むコメントの最初に付けるマーカー
export const commentMarker = "<!-- voicevox preview-pages info -->";
// 過去に使われていたマーカーも含めたマーカーの一覧
export const commentMarkers = [
  commentMarker,
  "<!-- voiccevox preview-pages info -->",
];

// ダウンロードしたファイルを展開するディレクトリ
export const destinationDir = `${import.meta.dirname}/../public/preview`;
// ビルドチェックのJobの名前
export const pagesBuildCheckName = "build_preview_pages";
// ダウンロードするアーティファクトの名前
export const artifactName = "preview-pages";
// PagesのURL
export const pagesUrl = "https://voicevox.github.io/preview-pages";

export const [guestRepoOwner, guestRepoName] = guestRepo.split("/");

await logtape.configure({
  sinks: {
    console: logtape.getConsoleSink({
      formatter: logtape.getAnsiColorFormatter({
        level: "full",
        categoryColor: "cyan",
      }),
    }),
  },
  loggers: [
    {
      category: "app",
      level: "info",
      sinks: ["console"],
    },

    {
      category: ["logtape", "meta"],
      level: "warning",
      sinks: ["console"],
    },
  ],
});

export const rootLogger = logtape.getLogger("app");

const getEnv = (name: string) => {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
};

export const app = new App({
  appId: Number.parseInt(getEnv("APP_ID")),
  privateKey:
    process.env.PRIVATE_KEY ||
    (await fs.readFile(`${import.meta.dirname}/../private-key.pem`, "utf8")),
  oauth: {
    clientId: getEnv("CLIENT_ID"),
    clientSecret: getEnv("CLIENT_SECRET"),
  },
  Octokit: Octokit.plugin(paginateRest, throttling),
});

export const appInfo = await app.octokit.request("GET /app");
if (!appInfo.data) {
  throw new Error("Failed to get app info.");
}
rootLogger.info`Running as ${appInfo.data.name}.`;

const { data: installations } = await app.octokit.request(
  "GET /app/installations",
);
const installationId = installations[0].id;

export const octokit = await app.getInstallationOctokit(installationId);
