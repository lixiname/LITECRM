<template>
  <div class="create-customer">
    <AppPageHeader
      title="新建客户"
      description="先查重，再建立客户和首要联系人"
      back-to="/customers"
      back-label="客户列表"
    />

    <el-card class="create-customer__card">
      <CustomerCreateForm @created="handleCreated" @claimed="handleClaimed" />
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router'
import type { CustomerItem } from '@crm/domain'
import AppPageHeader from '../components/AppPageHeader.vue'
import CustomerCreateForm from '../components/customers/CustomerCreateForm.vue'

const router = useRouter()

function handleCreated(_customer: CustomerItem) {
  void router.push('/customers')
}

function handleClaimed(customerId: string) {
  void router.push(`/customers/${customerId}`)
}
</script>

<style scoped>
.create-customer {
  padding: var(--crm-spacing-xl);
}
.create-customer__card {
  max-width: 920px;
}
</style>
