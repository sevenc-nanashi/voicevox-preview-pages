import { ref } from "vue";
import type { DownloadData } from "../../scripts/common.ts";

const downloadDataRef = ref<DownloadData[] | null>(null);

void fetch(
  `${import.meta.env.BASE_URL}/preview/downloads.json`.replace(/\/\//g, "/"),
).then(async (response) => {
  if (!response.ok) {
    throw new Error(`Failed to fetch downloads.json: ${response.statusText}`);
  }
  const downloadData = (await response.json()) as DownloadData[];
  downloadDataRef.value = downloadData;
});

export function useDownloadData() {
  return downloadDataRef;
}
