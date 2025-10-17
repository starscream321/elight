import { createApp } from 'vue'
import './main.css'
import './assets/fonts.css'

import App from './App.vue'
import router from "./router";

createApp(App).use(router).mount('#app')
