import * as logtape from "@logtape/logtape";
import { config } from "dotenv";

config({
  path: `${import.meta.dirname}/../.env`,
});

// 設定

// 収集対象のリポジトリ
export const guestRepo = "voicevox/voicevox";
// デプロイ情報を書き込むコメントの最初に付けるマーカー
export const commentMarker = "<!-- voiccevox preview-pages info -->";
// ダウンロードしたファイルを展開するディレクトリ
export const destinationDir = `${import.meta.dirname}/../public/preview`;
// ビルドチェックのJobの名前
export const pagesBuildCheckName = "build_preview_pages";
// ダウンロードするアーティファクトの名前
export const artifactName = "preview-pages";
// PagesのURL
export const pagesUrl = "https://voicevox.github.io/preview-pages";

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
