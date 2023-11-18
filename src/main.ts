import { createApp } from 'vue'
import './style.css'
import App from './App.vue'
import VueKonva from 'vue-konva'

createApp(App)
  .use(VueKonva, {prefix: 'k'})
  .mount('#app')
