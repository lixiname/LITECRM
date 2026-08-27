<template>
  <div class="app">
    <router-view />
    <!-- 底部 Tabbar：计划/客户/安排/我的 -->
    <van-tabbar v-if="showTabbar" route safe-area-inset-bottom>
      <van-tabbar-item replace to="/" icon="calendar-o">计划</van-tabbar-item>
      <van-tabbar-item replace to="/customers" icon="manager-o">客户</van-tabbar-item>
      <van-tabbar-item replace to="/quick-add" icon="add-o">记录</van-tabbar-item>
      <van-tabbar-item replace to="/mine" icon="user-o">我的</van-tabbar-item>
    </van-tabbar>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()
const showTabbar = computed(() => ['/', '/customers', '/quick-add', '/mine'].includes(route.path))
</script>
