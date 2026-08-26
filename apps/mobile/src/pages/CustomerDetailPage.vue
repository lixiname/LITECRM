<template>
  <div class="detail">
    <van-nav-bar :title="detail?.name ?? '客户详情'" left-arrow @click-left="router.back()" />

    <van-cell-group
      v-if="auth.hasAbility('customer.write') && detail?.status === 'active'"
      inset
      title="快速登记"
    >
      <van-cell
        title="记一笔拜访"
        icon="guide-o"
        is-link
        @click="router.push(`/customers/${customerId}/visit/new`)"
      />
      <van-cell
        title="新建商机"
        icon="chart-trending-o"
        is-link
        @click="router.push(`/customers/${customerId}/opportunity/new`)"
      />
      <van-cell
        title="登记客诉"
        icon="warning-o"
        is-link
        @click="router.push(`/customers/${customerId}/complaint/new`)"
      />
    </van-cell-group>

    <van-cell-group v-if="detail" inset title="基本信息">
      <van-cell title="城市" :value="detail.city ?? '-'" />
      <van-cell title="产业" :value="detail.industry ?? '-'" />
      <van-cell title="等级" :value="detail.grade" />
      <van-cell title="状态" :value="statusLabel(detail.status)" />
      <van-cell title="负责人" :value="detail.ownerId === auth.user?.id ? '我' : '他人'" />
      <van-cell title="地址" :value="detail.address ?? '-'" />
    </van-cell-group>

    <van-cell-group v-if="detail" inset title="联系人">
      <van-cell
        v-for="c in detail.contacts"
        :key="c.id"
        :title="c.name ?? '（无名）'"
        :label="c.phone ?? ''"
      >
        <template #value>
          <van-tag v-if="c.isKeyContact" type="success">首要</van-tag>
        </template>
      </van-cell>
      <van-cell v-if="detail.contacts.length === 0" title="暂无联系人" />
    </van-cell-group>
  </div>
</template>

<script setup lang="ts">
import { useRoute, useRouter } from 'vue-router'
import {
  useQuery,
  getCustomer,
  useAuthStore,
  CUSTOMER_STATUS_OPTIONS,
  type CustomerStatus,
} from '@crm/domain'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const customerId = route.params.id as string

const { data: detail } = useQuery(`customer:detail:${customerId}`, () => getCustomer(customerId))

function statusLabel(status: CustomerStatus): string {
  return CUSTOMER_STATUS_OPTIONS.find((s) => s.value === status)?.label ?? status
}
</script>
