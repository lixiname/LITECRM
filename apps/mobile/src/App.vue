<template>
  <div class="app">
    <router-view />
    <!-- 底部 Tabbar（§5.5 + 交互设计 §2：日程/客户/记一笔/我的） -->
    <van-tabbar v-if="showTabbar" route safe-area-inset-bottom>
      <van-tabbar-item replace to="/" icon="calendar-o">日程</van-tabbar-item>
      <van-tabbar-item replace to="/customers" icon="manager-o">客户</van-tabbar-item>
      <van-tabbar-item replace to="/quick-add" icon="gold-coin-o">记一笔</van-tabbar-item>
      <van-tabbar-item replace to="/mine" icon="user-o">我的</van-tabbar-item>
    </van-tabbar>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()
const showTabbar = computed(() => ['/', '/customers', '/expenses', '/mine'].includes(route.path))
</script>
