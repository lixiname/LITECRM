<template>
  <div class="quick-add">
    <van-nav-bar title="记一笔" left-arrow @click-left="router.back()" />

    <!-- 日期快捷（§3.2 补录刚需） -->
    <div class="quick-add__date">
      <span class="quick-add__date-label">日期</span>
      <van-button
        size="small"
        :type="date === yesterday ? 'primary' : 'default'"
        @click="setDate(yesterday)"
        >昨天</van-button
      >
      <van-button
        size="small"
        :type="date === today ? 'primary' : 'default'"
        @click="setDate(today)"
        >今天</van-button
      >
      <van-button
        size="small"
        :type="date === tomorrow ? 'primary' : 'default'"
        @click="setDate(tomorrow)"
        >明天</van-button
      >
      <span class="quick-add__date-val">{{ date }}</span>
    </div>

    <!-- 类型面板（§4.1 超兔式：意图直接） -->
    <van-cell-group inset title="记什么">
      <van-cell title="记拜访" icon="guide-o" is-link @click="pickType('visit')" />
      <van-cell title="建商机" icon="chart-trending-o" is-link @click="pickType('opportunity')" />
      <van-cell title="登客诉" icon="warning-o" is-link @click="pickType('complaint')" />
    </van-cell-group>

    <!-- 选类型后：选客户（预填日期） -->
    <template v-if="type">
      <div class="quick-add__pick">
        <van-search v-model="keyword" placeholder="搜索客户（名称/城市）" @search="load" />
        <van-cell-group inset>
          <van-cell
            v-for="c in customers"
            :key="c.id"
            :title="c.name"
            :label="c.city ?? ''"
            is-link
            @click="goForm(c.id)"
          />
          <van-cell v-if="!loading && customers.length === 0" title="暂无客户" />
        </van-cell-group>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { listCustomers, type CustomerItem } from '@crm/domain'

const route = useRoute()
const router = useRouter()

const fmt = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

const today = fmt(new Date())
const yesterday = fmt(new Date(Date.now() - 86400000))
const tomorrow = fmt(new Date(Date.now() + 86400000))

// 日期：优先路由 query（周览空 card 传入），默认今天
const date = ref<string>((route.query.date as string) || today)
const type = ref<'visit' | 'opportunity' | 'complaint' | null>(null)
const keyword = ref('')
const customers = ref<CustomerItem[]>([])
const loading = ref(false)

function setDate(d: string) {
  date.value = d
}
function pickType(t: 'visit' | 'opportunity' | 'complaint') {
  type.value = t
  void load()
}
async function load() {
  loading.value = true
  try {
    const page = await listCustomers({ page: 1, pageSize: 20, keyword: keyword.value.trim() })
    customers.value = page.items
  } finally {
    loading.value = false
  }
}

function goForm(customerId: string) {
  const pathMap: Record<string, string> = {
    visit: `/customers/${customerId}/visit/new`,
    opportunity: `/customers/${customerId}/opportunity/new`,
    complaint: `/customers/${customerId}/complaint/new`,
  }
  void router.push({ path: pathMap[type.value!], query: { date: date.value } })
}
</script>
