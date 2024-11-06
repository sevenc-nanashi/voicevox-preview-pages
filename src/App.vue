<template>
  <header class="header">VOICEVOX Preview Pages</header>
  <main class="main">
    <p>プレビューするBranchまたはPull Requestを選択してください。</p>
    <section class="downloads">
      <template v-if="downloads">
        <ElCard
          v-for="download in downloads"
          :key="download.dirname"
          class="download-card"
        >
          <template #header>
            <template v-if="download.source.type === 'branch'">
              <ElTag effect="dark" type="primary" disableTransitions
                >Branch</ElTag
              >
              <a
                class="download-source"
                :href="`https://github.com/VOICEVOX/voicevox/tree/${download.source.branch.name}`"
                @click.stop
              >
                {{ download.source.branch.name }}
              </a>
              ：
              <a
                :href="`https://github.com/VOICEVOX/voicevox/commit/${download.source.branch.commit.sha}`"
                @click.stop
              >
                {{ download.source.branch.commit.sha.slice(0, 7) }}
              </a>
            </template>
            <template v-if="download.source.type === 'pullRequest'">
              <ElTag effect="dark" type="success" disableTransitions>Pull Request</ElTag>
              <a
                class="download-source"
                :href="download.source.pullRequest.html_url"
                @click.stop
              >
                #{{ download.source.pullRequest.number }} （{{
                  download.source.pullRequest.title
                }}）
              </a>
              ：
              <a
                :href="`https://github.com/${download.source.pullRequest.head.repo.full_name}/commit/${download.source.pullRequest.head.sha}`"
                @click.stop
              >
                {{ download.source.pullRequest.head.sha.slice(0, 7) }}（{{
                  download.source.pullRequest.head.repo.full_name
                }}）
              </a>
            </template>
          </template>

          <a :href="joinUrl(`${download.dirname}/editor/index.html`)">
            <ElButton type="success">エディタ</ElButton>
          </a>
          <a :href="joinUrl(`${download.dirname}/storybook/index.html`)">
            <ElButton type="danger">Storybook</ElButton>
          </a>
        </ElCard>
      </template>
      <template v-else>
        <ElLoading />
      </template>
    </section>
  </main>
</template>

<script setup lang="ts">
import { ElButton, ElCard, ElLoading, ElTag } from "element-plus";
import { useDownloadData } from "./composables/useDownloadData.ts";

const downloads = useDownloadData();
const baseUrl = import.meta.env.BASE_URL;

const joinUrl = (path: string) => {
  return `${baseUrl}/preview/${path}`.replace(/\/+/g, "/");
};
</script>

<style scoped lang="scss">
@use "@/styles/index.scss" as main;

.header {
  align-content: center;
  background: main.$theme;
  color: white;
  padding: 1rem;

  font-size: 1.5rem;
  font-weight: bold;
}

.main {
  padding: 1rem;
  margin-left: auto;
  margin-right: auto;
}

.download-source {
  padding-left: 0.5rem;
}

.downloads {
  display: grid;
  gap: 1rem;
  grid-template-columns: repeat(auto-fill, minmax(600px, 1fr));
}

.download-card :deep(.el-card__body) {
  display: flex;
  gap: 1rem;
}
</style>
