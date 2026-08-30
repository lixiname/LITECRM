<template>
  <div class="app" :class="{ 'app--with-tabbar': showTabbar }">
    <router-view />
    <!-- 底部 Tabbar：工作/客户/记录/我的；只读角色不显示写入入口 -->
    <van-tabbar v-if="showTabbar" route safe-area-inset-bottom>
      <van-tabbar-item replace to="/" icon="todo-list-o">工作</van-tabbar-item>
      <van-tabbar-item replace to="/customers" icon="manager-o">客户</van-tabbar-item>
      <van-tabbar-item v-if="canWrite" replace to="/quick-add" icon="add-o">记录</van-tabbar-item>
      <van-tabbar-item replace to="/mine" icon="user-o">我的</van-tabbar-item>
    </van-tabbar>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useAuthStore } from '@crm/domain'

const route = useRoute()
const auth = useAuthStore()
const canWrite = computed(() => auth.hasAbility('customer.write'))
const showTabbar = computed(() => ['/', '/customers', '/quick-add', '/mine'].includes(route.path))
</script>
