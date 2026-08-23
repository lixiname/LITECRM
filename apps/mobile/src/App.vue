<template>
  <div class="app">
    <router-view />
    <!-- 底部 Tabbar（§5.5）：客户 / 记一笔 / 我的；详情·表单页隐藏 -->
    <van-tabbar v-if="showTabbar" route safe-area-inset-bottom>
      <van-tabbar-item replace to="/customers" icon="manager-o">客户</van-tabbar-item>
      <van-tabbar-item replace to="/expenses" icon="gold-coin-o">记一笔</van-tabbar-item>
      <van-tabbar-item replace to="/" icon="user-o">我的</van-tabbar-item>
    </van-tabbar>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()
const showTabbar = computed(() => ['/', '/customers', '/expenses'].includes(route.path))
</script>
