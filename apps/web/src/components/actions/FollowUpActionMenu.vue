<template>
  <el-dropdown trigger="click" @command="emitCommand" @click.stop>
    <el-button link type="primary">处理⌄</el-button>
    <template #dropdown>
      <el-dropdown-menu>
        <el-dropdown-item command="open">打开来源</el-dropdown-item>
        <el-dropdown-item command="complete">标记完成</el-dropdown-item>
        <el-dropdown-item command="reschedule">改期</el-dropdown-item>
        <el-dropdown-item command="cancel" divided>取消行动</el-dropdown-item>
      </el-dropdown-menu>
    </template>
  </el-dropdown>
</template>

<script setup lang="ts">
import type { FollowUpAction } from '@crm/domain'

type ActionCommand = 'open' | 'complete' | 'reschedule' | 'cancel'

const props = defineProps<{ action: FollowUpAction }>()
const emit = defineEmits<{
  command: [command: ActionCommand, action: FollowUpAction]
}>()

function emitCommand(command: ActionCommand) {
  emit('command', command, props.action)
}
</script>
