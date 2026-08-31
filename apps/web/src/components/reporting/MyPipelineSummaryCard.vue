<template>
  <div class="my-pipeline-summary">
    <el-skeleton v-if="loading" :rows="2" animated />
    <el-alert v-else-if="error" :title="error" type="warning" :closable="false" show-icon>
      <template #default
        ><el-button link type="primary" @click="reload">重新加载</el-button></template
      >
    </el-alert>
    <template v-else-if="summary">
      <PipelineCompositionCard :pool="summary.pool" title="我的开放商机" compact>
        <template #header-action>
          <el-button link type="primary" @click="openMine">查看我的商机 →</el-button>
        </template>
      </PipelineCompositionCard>
    </template>
  </div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router'
import { getMyPipelineSummary, useAuthStore, useQuery } from '@crm/domain'
import PipelineCompositionCard from './PipelineCompositionCard.vue'

const router = useRouter()
const auth = useAuthStore()
const {
  data: summary,
  loading,
  error,
  reload,
} = useQuery('reporting:my-pipeline', getMyPipelineSummary)

function openMine() {
  void router.push({ path: '/opportunities', query: { ownerId: auth.user?.id } })
}
</script>

<style scoped>
.my-pipeline-summary {
  margin-bottom: var(--crm-spacing-md);
}
</style>
