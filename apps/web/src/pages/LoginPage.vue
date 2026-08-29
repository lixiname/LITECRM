<template>
  <div class="login-page">
    <div class="login-card">
      <h1 class="login-title">Lite CRM · 管理后台</h1>
      <el-form class="login-form" @submit.prevent="handleLogin">
        <el-form-item>
          <el-input
            v-model="form.username"
            placeholder="用户名"
            autocomplete="username"
            size="large"
          />
        </el-form-item>
        <el-form-item>
          <el-input
            v-model="form.password"
            type="password"
            placeholder="密码"
            autocomplete="current-password"
            size="large"
            show-password
            @keyup.enter="handleLogin"
          />
        </el-form-item>
        <el-alert
          v-if="error"
          class="login-error"
          :title="error"
          type="error"
          show-icon
          :closable="false"
        />
        <el-button
          class="login-submit"
          type="primary"
          size="large"
          :loading="loading"
          @click="handleLogin"
        >
          登 录
        </el-button>
      </el-form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@crm/domain'

const router = useRouter()
const auth = useAuthStore()

const form = reactive({ username: '', password: '' })
const loading = ref(false)
const error = ref('')

async function handleLogin() {
  if (!form.username.trim() || !form.password) {
    error.value = '请输入用户名和密码'
    return
  }
  loading.value = true
  error.value = ''
  try {
    await auth.login(form.username.trim(), form.password)
    void router.push(
      auth.hasAbility('dashboard.view')
        ? '/management'
        : auth.hasAbility('customer.write')
          ? '/week-view'
          : '/customers',
    )
  } catch (e) {
    error.value = e instanceof Error ? e.message : '登录失败，请稍后重试'
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.login-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--crm-spacing-xl);
  background: var(--crm-color-bg-page);
}
.login-card {
  width: 100%;
  max-width: 400px;
  padding: var(--crm-spacing-xl);
  background: var(--crm-color-bg-card);
  border-radius: var(--crm-radius-lg);
  box-shadow: 0 2px 12px rgb(0 0 0 / 8%);
}
.login-title {
  margin: 0 0 var(--crm-spacing-xl);
  font-size: var(--crm-font-size-xl);
  color: var(--crm-color-text-primary);
  text-align: center;
}
.login-error {
  margin-bottom: var(--crm-spacing-md);
}
.login-submit {
  width: 100%;
}
</style>
