<template>
  <div class="app" :class="{ 'app--with-tabbar': showTabbar }">
    <router-view />
    <!-- 底部 Tabbar：工作聚合填报，费用承载台账；只读角色不显示费用入口。 -->
    <van-tabbar v-if="showTabbar" route safe-area-inset-bottom>
      <van-tabbar-item replace to="/" icon="todo-list-o">工作</van-tabbar-item>
      <van-tabbar-item replace to="/customers" icon="manager-o">客户</van-tabbar-item>
      <van-tabbar-item v-if="canWrite" replace to="/expenses" icon="balance-list-o">
        费用
      </van-tabbar-item>
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
const showTabbar = computed(() => ['/', '/customers', '/expenses', '/mine'].includes(route.path))
</script>
