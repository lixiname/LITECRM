import { createApp } from 'vue'
import { createPinia } from 'pinia'
import ElementPlus from 'element-plus'
import zhCn from 'element-plus/es/locale/lang/zh-cn'
import 'element-plus/dist/index.css'
import '@crm/design-tokens/tokens.css'
import { useAuthStore } from '@crm/domain'
import './style.css'
import './styles/operations-surface.css'
import App from './App.vue'
import router from './router'

const app = createApp(App)
const pinia = createPinia()
app.use(pinia)

// 恢复登录会话（§8.1）：先于路由守卫执行，避免刷新后误跳登录页
const auth = useAuthStore(pinia)
auth.restoreSession()

app.use(router)
app.use(ElementPlus, { locale: zhCn })
app.mount('#app')
