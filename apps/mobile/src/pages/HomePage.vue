<template>
  <div class="home">
    <van-nav-bar title="Lite CRM">
      <template #right>
        <van-button v-if="auth.isLoggedIn" size="small" plain type="danger" @click="handleLogout">
          退出
        </van-button>
      </template>
    </van-nav-bar>

    <div v-if="auth.isLoggedIn" class="home__body">
      <van-cell-group inset title="当前用户">
        <van-cell title="姓名" :value="auth.user?.displayName" />
        <van-cell title="账号" :value="auth.user?.username" />
        <van-cell title="角色" :value="ROLE_LABELS[auth.user?.role ?? 'sales']" />
        <van-cell title="数据范围" :value="DATA_SCOPE_LABELS[auth.dataScope ?? 'self']" />
        <van-cell title="能力点" :value="auth.capabilities.join(' / ')" />
      </van-cell-group>
    </div>

    <p v-else class="home__hint">登录后查看会话信息</p>
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
.home__body {
  padding: var(--crm-spacing-lg) 0;
}
.home__hint {
  padding: var(--crm-spacing-xl);
  text-align: center;
  color: var(--crm-color-text-secondary);
}
</style>
