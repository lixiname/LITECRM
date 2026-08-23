<template>
  <div class="mine">
    <van-nav-bar title="我的" />

    <van-cell-group inset title="当前用户">
      <van-cell title="姓名" :value="auth.user?.displayName" />
      <van-cell title="账号" :value="auth.user?.username" />
      <van-cell title="角色" :value="ROLE_LABELS[auth.user?.role ?? 'sales']" />
      <van-cell title="数据范围" :value="DATA_SCOPE_LABELS[auth.dataScope ?? 'self']" />
      <van-cell title="能力点" :value="auth.capabilities.join(' / ')" />
    </van-cell-group>

    <div class="mine__logout">
      <van-button round block type="danger" plain @click="handleLogout">退出登录</van-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router'
import { useAuthStore, ROLE_LABELS, DATA_SCOPE_LABELS } from '@crm/domain'

const router = useRouter()
const auth = useAuthStore()

function handleLogout() {
  auth.logout()
  void router.push('/login')
}
</script>

<style scoped>
.mine__logout {
  margin: var(--crm-spacing-lg) var(--crm-spacing-md);
}
</style>
