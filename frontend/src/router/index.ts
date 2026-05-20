import { createRouter, createWebHistory } from "vue-router";


const routes = [
    {
        path: '/',
        name: 'Light',
        component: () => import("../views/Light.vue")
    },
    {
        path: '/karaoke',
        name: 'Karaoke',
        component: () => import("../views/Karaoke.vue")
    },
    {
        path: '/info',
        name: 'Info',
        component: () => import("../views/Info.vue")
    }
]

const router = createRouter({
    history: createWebHistory(),
    routes
})

export default router
