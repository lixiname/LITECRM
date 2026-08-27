<template>
  <el-dropdown trigger="click" @command="emitCommand" @click.stop>
    <el-button link type="primary">处理⌄</el-button>
    <template #dropdown>
      <el-dropdown-menu>
        <el-dropdown-item command="execute">填写执行结果</el-dropdown-item>
        <el-dropdown-item command="reschedule">改期</el-dropdown-item>
        <el-dropdown-item command="cancel" divided>取消计划</el-dropdown-item>
      </el-dropdown-menu>
    </template>
  </el-dropdown>
</template>

<script setup lang="ts">
import type { SalesPlan } from '@crm/domain'

type ActionCommand = 'execute' | 'reschedule' | 'cancel'

const props = defineProps<{ action: SalesPlan }>()
const emit = defineEmits<{
  command: [command: ActionCommand, action: SalesPlan]
}>()

function emitCommand(command: ActionCommand) {
  emit('command', command, props.action)
}
</script>
