import { ref } from "vue";
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

const downloadDataRef = ref<DownloadData[] | null>(null);

void fetch("/preview/downloads.json").then(async (response) => {
  if (!response.ok) {
    throw new Error(`Failed to fetch downloads.json: ${response.statusText}`);
  }
  const downloadData = (await response.json()) as DownloadData[];
  downloadDataRef.value = downloadData;
});

export function useDownloadData() {
  return downloadDataRef;
}
