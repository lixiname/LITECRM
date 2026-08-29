<template>
  <el-dropdown trigger="click" @command="emitCommand" @click.stop>
    <el-button link type="primary">处理⌄</el-button>
    <template #dropdown>
      <el-dropdown-menu>
        <el-dropdown-item v-if="!hideExecute" command="execute">填写执行结果</el-dropdown-item>
        <el-dropdown-item command="reschedule">改期</el-dropdown-item>
      </el-dropdown-menu>
    </template>
  </el-dropdown>
</template>

<script setup lang="ts">
import type { SalesPlan } from '@crm/domain'

type ActionCommand = 'execute' | 'reschedule'

const props = withDefaults(defineProps<{ action: SalesPlan; hideExecute?: boolean }>(), {
  hideExecute: false,
})
const emit = defineEmits<{
  command: [command: ActionCommand, action: SalesPlan]
}>()

function emitCommand(command: ActionCommand) {
  emit('command', command, props.action)
}
</script>
