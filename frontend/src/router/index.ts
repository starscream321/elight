import { createRouter, createWebHistory } from "vue-router";
import Light from "../views/Light.vue";
import Karaoke from "../views/Karaoke.vue";
import Info from "../views/Info.vue"


const routes = [
    {
        path: '/',
        name: 'Light',
        component: Light
    },
    {
        path: '/karaoke',
        name: 'Karaoke',
        component: Karaoke
    },
    {
        path: '/info',
        name: 'Info',
        component: Info
    }
]

const router = createRouter({
    history: createWebHistory(),
    routes
})

export default router