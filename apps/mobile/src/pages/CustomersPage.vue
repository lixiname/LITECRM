<template>
  <div class="customers">
    <van-nav-bar title="客户" left-arrow @click-left="router.push('/')" />
    <van-search v-model="keyword" placeholder="搜索名称/城市" @search="onSearch" />

    <van-list
      v-model:loading="loading"
      :finished="finished"
      finished-text="没有更多了"
      @load="onLoad"
    >
      <van-cell
        v-for="c in items"
        :key="c.id"
        :title="c.name"
        :label="`${c.city ?? '-'} · ${statusLabel(c.status)}`"
        is-link
        @click="router.push(`/customers/${c.id}`)"
      />
    </van-list>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import {
  listCustomers,
  CUSTOMER_STATUS_OPTIONS,
  type CustomerItem,
  type CustomerStatus,
} from '@crm/domain'

const router = useRouter()
const keyword = ref('')
const items = ref<CustomerItem[]>([])
const loading = ref(false)
const finished = ref(false)
const page = ref(1)
const PAGE_SIZE = 20

async function onLoad() {
  try {
    const res = await listCustomers({
      keyword: keyword.value.trim(),
      page: page.value,
      pageSize: PAGE_SIZE,
    })
    items.value.push(...res.items)
    finished.value = items.value.length >= res.total
    page.value += 1
  } catch {
    finished.value = true
  } finally {
    loading.value = false
  }
}

function onSearch() {
  items.value = []
  page.value = 1
  finished.value = false
  void onLoad()
}

function statusLabel(status: CustomerStatus): string {
  return CUSTOMER_STATUS_OPTIONS.find((s) => s.value === status)?.label ?? status
}
</script>
